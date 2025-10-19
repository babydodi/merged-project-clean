import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const body = await req.json();
  console.log("🔔 Webhook:", body);

  const { InvoiceId, InvoiceStatus, CustomerEmail, InvoiceValue } = body;
  const plan = InvoiceValue == 50 ? 'basic' : 'premium';

  // للتجربة: نخزن الاشتراك حتى لو ما فيه مستخدم
  await supabase.from('subscriptions').insert([{
    user_id: null,
    plan,
    status: InvoiceStatus === "Paid" ? "active" : "failed",
    invoice_id: InvoiceId,
    amount: InvoiceValue,
    customer_email: CustomerEmail,
    raw_response: body
  }]);

  return NextResponse.json({ message: "Webhook received" });
}
