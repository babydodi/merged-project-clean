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
    const transactionStatus = (data?.TransactionStatus ?? "").toUpperCase();
    const customerRef = data?.CustomerReference;

    console.log("🔔 Webhook received:", payload);

    // نعتبر الدفع ناجح إذا الحالة SUCCESS أو PAID
    const isPaid = ["SUCCESS", "PAID"].includes(transactionStatus);

    // جهّز start_date و end_date (50 يوم)
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 50);

    // 1. تحديث أو إدخال الاشتراك
    const insertPayload = {
      user_id: customerRef,
      plan: data?.UserDefinedField ?? "basic",
      invoice_id: Number(invoiceId),
      customer_email: data?.CustomerEmail ?? null,
      amount: Number(
        data?.InvoiceValueInPayCurrency ??
        data?.InvoiceValueInDisplayCurrency ??
        data?.InvoiceValueInBaseCurrency ?? 0
      ),
      status: isPaid ? "active" : "failed",
      is_active: isPaid,
      start_date: isPaid ? startDate.toISOString().split("T")[0] : null,
      end_date: isPaid ? endDate.toISOString().split("T")[0] : null,
      raw_response: payload
    };

    const { error: subErr } = await supabase
      .from("subscriptions")
      .upsert([insertPayload], { onConflict: ["invoice_id"] });

    if (subErr) {
      console.error("❌ Subscription upsert failed:", subErr);
    } else {
      console.log("✅ Subscription upserted successfully for invoice:", invoiceId);
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
