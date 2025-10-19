'use client';
import { useState } from 'react';

export default function PricingPage() {
  const [loading, setLoading] = useState(null);

  const handleSubscribe = async (plan) => {
    setLoading(plan);
    const res = await fetch('/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        customerEmail: "abdullah@test.com" // للتجربة
      })
    });
    const data = await res.json();
    setLoading(null);

    // 🟢 اطبع الرد في المتصفح
    console.log("🔴 Response from initiate:", data);

    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
    } else {
      alert("❌ خطأ: " + data.error);
    }
  };

  return (
    <div className="p-12 text-center">
      <h1 className="text-3xl font-bold mb-8">💳 اختر خطتك</h1>
      <div className="grid grid-cols-2 gap-8">
        <div className="border p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">Basic</h2>
          <p className="mb-4">50 ريال / شهر</p>
          <button onClick={() => handleSubscribe('basic')} disabled={loading==='basic'}>
            {loading==='basic' ? "⏳ جاري..." : "🚀 اشترك الآن"}
          </button>
        </div>
        <div className="border p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4">Premium</h2>
          <p className="mb-4">100 ريال / شهر</p>
          <button onClick={() => handleSubscribe('premium')} disabled={loading==='premium'}>
            {loading==='premium' ? "⏳ جاري..." : "🚀 اشترك الآن"}
          </button>
        </div>
      </div>
    </div>
  );
}
