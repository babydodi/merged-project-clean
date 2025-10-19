import { NextResponse } from 'next/server';

export async function POST(req) {
  const { plan, customerEmail } = await req.json();

  const plans = { basic: 50, premium: 100 };
  const amount = plans[plan] || 0;

  // ✅ اسم من 3 كلمات عشان Sandbox ما يرفض
  const emailPrefix = customerEmail.split("@")[0];
  const customerName = `${emailPrefix} Test User`;

  const payload = {
    PaymentMethodId: 2,
    InvoiceValue: amount,
    CustomerName: customerName,
    CustomerEmail: customerEmail,
    CallBackUrl: `${process.env.NEXT_PUBLIC_DOMAIN}/payment/success`,
    ErrorUrl: `${process.env.NEXT_PUBLIC_DOMAIN}/payment/failed`
  };

  // 🟢 اطبع أول 6 حروف من التوكن للتأكد
  console.log("🔑 Token prefix:", process.env.MYFATOORAH_API_KEY?.slice(0, 6));

  const res = await fetch("https://apitest.myfatoorah.com/v2/ExecutePayment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.MYFATOORAH_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log("🔴 MyFatoorah response:", data);

  if (!res.ok || !data.IsSuccess) {
    return NextResponse.json(
      { error: data.Message || "Unknown error", details: data },
      { status: 400 }
    );
  }

  return NextResponse.json({ paymentUrl: data.Data.PaymentURL, details: data });
}
