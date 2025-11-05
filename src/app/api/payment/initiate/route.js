import { NextResponse } from 'next/server';

const PLANS = {
  basic: 75,
  premium: 85
};

export async function POST(req) {
  try {
    const { plan, customerEmail, userId } = await req.json();

    if (!plan || !PLANS[plan]) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }
    if (!customerEmail || !userId) {
      return NextResponse.json(
        { error: 'Missing customerEmail or userId' },
        { status: 400 }
      );
    }

    const amount = PLANS[plan];

    // اسم 3 كلمات للـ Sandbox
    const emailPrefix = customerEmail.split('@')[0];
    const customerName = `${emailPrefix} Test User`;

    const payload = {
      PaymentMethodId: 2, // مثال: KNET/مدى/بطاقة؛ حدده حسب بوابتك
      InvoiceValue: amount,
      CustomerName: customerName,
      CustomerEmail: customerEmail,
      // نمرر userId + plan لاسترجاعها في webhook
      CustomerReference: userId,
      UserDefinedField: plan,
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

    if (!res.ok || !data.IsSuccess) {
      return NextResponse.json(
        { error: data.Message || 'ExecutePayment failed', details: data },
        { status: 400 }
      );
    }

    return NextResponse.json({ paymentUrl: data.Data.PaymentURL, details: data });
  } catch (e) {
    console.error('initiate error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
