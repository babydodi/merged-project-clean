import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';

const PLANS = { basic: 75, premium: 85 };

export async function POST(req) {
  try {
    // 1) ربط Supabase بالجلسة (كوكيز) مع المتغيرات الصحيحة من Vercel
    const supabase = createServerClient(
      { cookies: () => req.cookies },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, // مهم: متوفر عندك في Vercel
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY // مفتاح الـ Service Role
      }
    );

    // 2) تحقق من تسجيل الدخول
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    // 3) تحقق من الخطة
    const { plan } = await req.json();
    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // 4) جلب بيانات المستخدم من جدول users
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', user.id)
      .single();

    if (error || !dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 5) إعداد بيانات الفاتورة
    const amount = PLANS[plan];
    const emailPrefix = dbUser.email.split('@')[0];
    const customerName = `${emailPrefix} Test User`; // مناسب للـ Sandbox

    const payload = {
      PaymentMethodId: 2, // قد تغيّر حسب تفعيل طُرق الدفع في حسابك
      InvoiceValue: amount,
      CustomerName: customerName,
      CustomerEmail: dbUser.email,
      CustomerReference: dbUser.id,
      UserDefinedField: plan,
      CallBackUrl: `${process.env.NEXT_PUBLIC_DOMAIN}/payment/success`,
      ErrorUrl: `${process.env.NEXT_PUBLIC_DOMAIN}/payment/failed`
    };

    // 6) استدعاء MyFatoorah
    const res = await fetch(`${process.env.MF_BASE_URL}/v2/ExecutePayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    // تسجيل أفضل للأخطاء لتشخيص سريع
    if (!res.ok || !data.IsSuccess) {
      console.error('ExecutePayment failed:', {
        status: res.status,
        message: data?.Message,
        validationErrors: data?.ValidationErrors,
        baseUrl: process.env.MF_BASE_URL,
        callback: payload.CallBackUrl,
        errorUrl: payload.ErrorUrl
      });
      return NextResponse.json(
        {
          error: data?.Message || `ExecutePayment failed (status ${res.status})`,
          details: data
        },
        { status: 400 }
      );
    }

    // 7) تخزين الاشتراك كـ pending
    await supabase.from('subscriptions').insert([{
      user_id: dbUser.id,
      plan,
      invoice_id: String(data.Data.InvoiceId),
      amount,
      status: 'pending',
      is_active: false,
      customer_email: dbUser.email,
      raw_response: data
    }]);

    // 8) إعادة رابط الدفع
    return NextResponse.json({
      invoiceId: String(data.Data.InvoiceId),
      paymentUrl: data.Data.PaymentURL
    });
  } catch (e) {
    console.error('initiate error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
