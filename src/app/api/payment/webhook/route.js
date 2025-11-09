// src/app/api/payment/webhook/route.js

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MF_BASE_URL = process.env.MF_BASE_URL || "https://apitest.myfatoorah.com";
const MF_API_KEY = process.env.MYFATOORAH_API_KEY;

async function getPaymentStatus(invoiceId) {
  const res = await fetch(`${MF_BASE_URL}/v2/GetPaymentStatus`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MF_API_KEY}`,
    },
    body: JSON.stringify({ Key: String(invoiceId), KeyType: "InvoiceId" }),
  });
  return res.json();
}

export async function POST(req) {
  try {
    const payload = await req.json();
    const data = payload?.Data || {};
    const invoiceId = data?.InvoiceId;
    const customerRef = data?.CustomerReference;
    const txStatus = (data?.TransactionStatus ?? "").toUpperCase();

    const isPaidWebhook = ["SUCCESS", "PAID"].includes(txStatus);

    // تحقق إضافي من MyFatoorah
    const statusResp = await getPaymentStatus(invoiceId);
    const invoiceStatus = String(
      statusResp?.Data?.InvoiceStatus ?? statusResp?.Data?.TransactionStatus ?? ""
    ).toUpperCase();
    const isPaidVerified = statusResp?.IsSuccess === true &&
      ["SUCCESS", "PAID", "PAID SUCCESSFULLY"].includes(invoiceStatus);

    const isPaid = isPaidWebhook && isPaidVerified;

    // جهّز الاشتراك (50 يوم)
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 50);

    await supabase.from("subscriptions").upsert([{
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
      raw_response: statusResp
    }], { onConflict: ["invoice_id"] });

    if (isPaid && customerRef) {
      await supabase.from("users").update({ role: "subscriber" }).eq("id", customerRef);
    }

    // ✅ سجل واحد فقط في payment_logs
    await supabase.from("payment_logs").insert([{
      invoice_id: Number(invoiceId),
      customer_reference: customerRef,
      event_text: isPaid ? "subscription_active_and_role_updated" : "subscription_failed",
      transaction_status: txStatus,
      raw_payload: payload
    }]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    await supabase.from("payment_logs").insert([{
      invoice_id: null,
      customer_reference: null,
      event_text: "handler_exception",
      transaction_status: "ERROR",
      raw_payload: { message: err.message, stack: err.stack?.toString?.() }
    }]);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
