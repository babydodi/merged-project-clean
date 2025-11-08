export default async function handler(req, res) {
  try {
    const payload = req.body;
    const invoiceId = payload?.InvoiceId;
    const transactionStatus = payload?.TransactionStatus;
    const customerRef = payload?.CustomerReference;

    console.log("Webhook received:", payload);

    // 1. تحديث الاشتراك
    const { error: subErr } = await supabase
      .from("subscriptions")
      .update({
        status: transactionStatus === "PAID" ? "active" : "failed",
        is_active: transactionStatus === "PAID",
        start_date: transactionStatus === "PAID" ? new Date().toISOString() : null,
      })
      .eq("invoice_id", invoiceId);

    if (subErr) {
      console.error("Subscription update failed:", subErr);
    } else {
      console.log("Subscription updated successfully for invoice:", invoiceId);
    }

    // 2. تحديث الدور
    if (transactionStatus === "PAID" && customerRef) {
      const { error: roleErr } = await supabase
        .from("users")
        .update({ role: "subscriber" })
        .eq("id", customerRef);

      if (roleErr) {
        console.error("Role update failed:", roleErr);
      } else {
        console.log("Role updated successfully for user:", customerRef);
      }
    }

    // 3. تسجيل في payment_logs
    await supabase.from("payment_logs").insert({
      invoice_id: invoiceId,
      customer_reference: customerRef,
      event_text: `Webhook processed - status: ${transactionStatus}`,
      raw_payload: payload,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook exception:", err);
    res.status(500).json({ error: "Webhook failed" });
  }
}
