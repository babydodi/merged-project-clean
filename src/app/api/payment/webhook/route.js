// src/app/api/payment/webhook/route.js

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const payload = await req.json();
    const data = payload?.Data || {};
    const invoiceId = data?.InvoiceId;
    const transactionStatus = data?.TransactionStatus;
    const customerRef = data?.CustomerReference;

    console.log("🔔 Webhook received:", payload);

    // نعتبر الدفع ناجح إذا الحالة SUCCESS أو PAID
    const isPaid = ["SUCCESS", "PAID"].includes(transactionStatus);

    // 1. تحديث الاشتراك
    const { error: subErr } = await supabase
      .from("subscriptions")
      .update({
        status: isPaid ? "active" : "failed",
        is_active: isPaid,
        start_date: isPaid ? new Date().toISOString() : null,
      })
      .eq("invoice_id", invoiceId);

    if (subErr) {
      console.error("❌ Subscription update failed:", subErr);
    } else {
      console.log("✅ Subscription updated successfully for invoice:", invoiceId);
    }

    // 2. تحديث الدور
    if (isPaid && customerRef) {
      const { error: roleErr } = await supabase
        .from("users")
        .update({ role: "subscriber" })
        .eq("id", customerRef);

      if (roleErr) {
        console.error("❌ Role update failed:", roleErr);
      } else {
        console.log("✅ Role updated successfully for user:", customerRef);
      }
    } else {
      console.log("ℹ️ Skipped role update because status not successful or customerRef missing");
    }

    // 3. تسجيل في payment_logs
    const { error: logErr } = await supabase.from("payment_logs").insert({
      invoice_id: invoiceId,
      customer_reference: customerRef,
      event_text: `Webhook processed - status: ${transactionStatus}`,
      raw_payload: payload,
    });

    if (logErr) {
      console.error("❌ Payment log insert failed:", logErr);
    } else {
      console.log("✅ Payment log inserted for invoice:", invoiceId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("💥 Webhook exception:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
