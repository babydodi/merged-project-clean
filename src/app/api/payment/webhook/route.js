// src/app/api/payment/webhook/route.js

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MF_BASE_URL = process.env.MF_BASE_URL || "https://apitest.myfatoorah.com";
const MF_API_KEY = process.env.MYFATOORAH_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getPaymentStatus(invoiceId) {
  const res = await fetch(`${MF_BASE_URL}/v2/GetPaymentStatus`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MF_API_KEY}`,
    },
    // ✅ لازم نحدد KeyType عشان MyFatoorah يفهم إننا نبحث بالـ InvoiceId
    body: JSON.stringify({ Key: String(invoiceId), KeyType: "InvoiceId" }),
  });
  return res.json();
}

export async function POST(req) {
  try {
    const body = await req.json();
    const data = body?.Data ?? {};
    const invoiceId = data?.InvoiceId ?? null;
    const customerRef = data?.CustomerReference ?? null;
    const txStatus = (data?.TransactionStatus ?? "").toUpperCase();

    // سجل الويبهوك الخام
    await supabase.from("payment_logs").insert([
      {
        invoice_id: Number(invoiceId),
        customer_reference: customerRef,
        event_type: body?.EventType ?? null,
        event_text: body?.Event ?? null,
        transaction_status: txStatus,
        raw_payload: body,
      },
    ]);

    // نقبل SUCCESS أو PAID كحالات دفع ناجحة
    if (!["SUCCESS", "PAID"].includes(txStatus)) {
      return new Response("ignored", { status: 200 });
    }

    // تحقق إضافي من MyFatoorah
    const statusResp = await getPaymentStatus(invoiceId);
    const isSuccess = statusResp?.IsSuccess === true;
    const invoiceStatus = String(
      statusResp?.Data?.InvoiceStatus ??
        statusResp?.Data?.TransactionStatus ??
        ""
    ).toUpperCase();

    // ✅ وسعنا الشرط لقبول أكثر من صيغة
    if (!isSuccess || !["SUCCESS", "PAID", "PAID SUCCESSFULLY"].includes(invoiceStatus)) {
      await supabase.from("payment_logs").insert([
        {
          invoice_id: Number(invoiceId),
          customer_reference: customerRef,
          event_type: 999,
          event_text: "verification_failed",
          transaction_status: invoiceStatus,
          raw_payload: statusResp,
        },
      ]);
      return new Response("verification_failed", { status: 200 });
    }

    // جهّز بيانات الاشتراك (ثابت: 50 يوم)
    const plan = data?.UserDefinedField ?? "basic";
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 50);

    const insertPayload = {
      user_id: customerRef,
      plan,
      invoice_id: Number(invoiceId),
      customer_email: data?.CustomerEmail ?? null,
      amount: Number(
        data?.InvoiceValueInPayCurrency ??
          data?.InvoiceValueInDisplayCurrency ??
          data?.InvoiceValueInBaseCurrency ??
          0
      ),
      status: "active",
      is_active: true,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      raw_response: statusResp,
    };

    // upsert على subscription حسب invoice_id
    const { error: upsertErr } = await supabase
      .from("subscriptions")
      .upsert([insertPayload], { onConflict: ["invoice_id"] });

    if (upsertErr) {
      await supabase.from("payment_logs").insert([
        {
          invoice_id: Number(invoiceId),
          customer_reference: customerRef,
          event_type: 998,
          event_text: "subscription_upsert_error",
          transaction_status: "PAID",
          raw_payload: { upsertErr },
        },
      ]);
      return new Response("ok", { status: 200 });
    }

    // بعد نجاح upsert: حدّث دور المستخدم
    if (customerRef) {
      const { error: roleErr } = await supabase
        .from("users")
        .update({ role: "subscriber" })
        .eq("id", customerRef);

      await supabase.from("payment_logs").insert([
        {
          invoice_id: Number(invoiceId),
          customer_reference: customerRef,
          event_type: roleErr ? 996 : 995,
          event_text: roleErr
            ? "role_update_failed"
            : "role_updated_to_subscriber",
          transaction_status: "PAID",
          raw_payload: roleErr ? { roleErr } : null,
        },
      ]);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    await supabase.from("payment_logs").insert([
      {
        invoice_id: null,
        customer_reference: null,
        event_type: 997,
        event_text: "handler_exception",
        transaction_status: "ERROR",
        raw_payload: {
          message: err.message,
          stack: err.stack?.toString?.(),
        },
      },
    ]);
    return new Response("error", { status: 200 });
  }
}
