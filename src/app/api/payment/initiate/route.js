// /app/api/payment/initiate/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PLANS = { basic: 75, premium: 85 };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export async function POST(req) {
  try {
    const { plan, customerEmail, userId } = await req.json();

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    if (!customerEmail || !userId) {
      return NextResponse.json({ error: 'Missing customerEmail or userId' }, { status: 400 });
    }

    const amount = PLANS[plan];
    const emailPrefix = customerEmail.split('@')[0];
    const customerName = `${emailPrefix} Test User`; // Sandbox-friendly

    const payload = {
      PaymentMethodId: 2,
      InvoiceValue: amount,
      CustomerName: customerName,
      CustomerEmail: customerEmail,
      CustomerReference: String(userId),
      UserDefinedField: String(plan),
      CallBackUrl: `${process.env.NEXT_PUBLIC_DOMAIN}/payment/success`,
      ErrorUrl: `${process.env.NEXT_PUBLIC_DOMAIN}/payment/failed`
    };

    console.log('🔑 Token prefix:', process.env.MYFATOORAH_API_KEY?.slice(0, 6));

    const res = await fetch(`${process.env.MF_BASE_URL}/v2/ExecutePayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('🟣 MyFatoorah response:', data);

    // سجّل المحاولة في payment_logs مهما كانت النتيجة
    try {
      await supabase.from('payment_logs').insert([{
        invoice_id: data?.Data?.InvoiceId ?? null,
        customer_reference: String(userId),
        event_type: data?.IsSuccess ? 200 : 1001,
        event_text: data?.IsSuccess ? 'execute_payment_success' : 'execute_payment_failed',
        transaction_status: data?.Message ?? (data?.IsSuccess ? 'OK' : 'ERROR'),
        raw_payload: data
      }]);
    } catch (logErr) {
      console.warn('payment_logs insert failed', logErr?.message ?? logErr);
    }

    if (!res.ok || !data?.IsSuccess) {
      return NextResponse.json({ error: data?.Message || 'ExecutePayment failed', details: data }, { status: 400 });
    }

    const invoiceId = String(data.Data?.InvoiceId ?? '');
    const paymentUrl = data.Data?.PaymentURL ?? null;

    // خزّن سجل subscription مبدئي كـ pending (لا تُفعّل حتى يأتي webhook)
    try {
      await supabase.from('subscriptions').insert([{
        user_id: String(userId),
        plan,
        invoice_id: invoiceId,
        amount,
        status: 'pending',
        is_active: false,
        raw_response: data,
        created_at: new Date().toISOString()
      }]);
    } catch (dbErr) {
      // سجّل فشل الإدخال لكن لا تمنع إعادة paymentUrl للعميل
      try {
        await supabase.from('payment_logs').insert([{
          invoice_id,
          customer_reference: String(userId),
          event_type: 1002,
          event_text: 'subscriptions_insert_failed',
          transaction_status: 'PENDING',
          raw_payload: { dbErr }
        }]);
      } catch (_) { /* ignore */ }
    }

    return NextResponse.json({ invoiceId, paymentUrl, raw: data });
  } catch (e) {
    console.error('initiate error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
