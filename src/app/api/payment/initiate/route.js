// /app/api/payment/initiate/route.js
import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

const PLANS = { basic: 75, premium: 85 };

export async function POST(req) {
  try {
    const supabase = createServerComponentClient(
      { cookies: () => req.cookies },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    );

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const { plan } = await req.json();
    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const { data: dbUser, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', user.id)
      .single();

    if (error || !dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const amount = PLANS[plan];
    const emailPrefix = dbUser.email.split('@')[0];
    const customerName = `${emailPrefix} Test User`;

    const payload = {
      PaymentMethodId: 2,
      InvoiceValue: amount,
      CustomerName: customerName,
      CustomerEmail: dbUser.email,
      CustomerReference: dbUser.id, // UUID من جدول users
      UserDefinedField: plan,
      CallBackUrl: `${process.env.NEXT_PUBLIC_DOMAIN}/payment/success`,
      ErrorUrl: `${process.env.NEXT_PUBLIC_DOMAIN}/payment/failed`
    };

    const res = await fetch(`${process.env.MF_BASE_URL}/v2/ExecutePayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.IsSuccess) {
      console.error('ExecutePayment failed:', {
        status: res.status,
        message: data?.Message,
        validationErrors: data?.ValidationErrors
      });
      return NextResponse.json(
        { error: data?.Message || `ExecutePayment failed (status ${res.status})`, details: data },
        { status: 400 }
      );
    }

    await supabase.from('subscriptions').insert([{
      user_id: dbUser.id,
      plan,
      invoice_id: Number(data.Data.InvoiceId), // ✅ رقم وليس نص
      amount,
      status: 'pending',
      is_active: false,
      customer_email: dbUser.email,
      raw_response: data
    }]);

    return NextResponse.json({
      invoiceId: Number(data.Data.InvoiceId), // ✅ رقم
      paymentUrl: data.Data.PaymentURL
    });
  } catch (e) {
    console.error('initiate error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
