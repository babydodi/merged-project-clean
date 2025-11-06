"use client";

import { useState } from "react";

export default function PaymentPage() {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState("basic"); // الخطة الافتراضية

  const handlePay = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }) // نرسل فقط الخطة
      });

      const data = await res.json();
      setLoading(false);

      if (data.paymentUrl) {
        // افتح صفحة الدفع من MyFatoorah
        window.location.href = data.paymentUrl;
      } else {
        alert("فشل إنشاء الفاتورة: " + (data.error || "خطأ غير معروف"));
      }
    } catch (err) {
      console.error("Payment error:", err);
      setLoading(false);
      alert("حدث خطأ أثناء الدفع");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>اختر خطة الاشتراك</h1>

      <div style={{ marginBottom: "1rem" }}>
        <label>
          <input
            type="radio"
            value="basic"
            checked={plan === "basic"}
            onChange={() => setPlan("basic")}
          />
          خطة Basic (75)
        </label>
        <br />
        <label>
          <input
            type="radio"
            value="premium"
            checked={plan === "premium"}
            onChange={() => setPlan("premium")}
          />
          خطة Premium (85)
        </label>
      </div>

      <button onClick={handlePay} disabled={loading}>
        {loading ? "جاري التحويل..." : "ادفع الآن"}
      </button>
    </div>
  );
}
