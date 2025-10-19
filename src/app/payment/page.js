'use client';
import { useState } from 'react';

export default function PaymentPage() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    const res = await fetch('/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        customerName: "Abdullah",
        customerEmail: "abdullah@example.com"
      })
    });
    const data = await res.json();
    setLoading(false);
    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
    } else {
      alert("❌ خطأ: " + data.error);
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">💳 الدفع عبر MyFatoorah</h1>
      <input
        type="number"
        placeholder="المبلغ"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full border p-2 rounded mb-3"
      />
      <button
        onClick={handlePay}
        disabled={loading}
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg"
      >
        {loading ? "⏳ جاري التحويل..." : "🚀 ادفع الآن"}
      </button>
    </div>
  );
}
