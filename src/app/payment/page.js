'use client';
import { useState } from 'react';

export default function PaymentPage() {
  const [plan, setPlan] = useState('basic');
  const [loading, setLoading] = useState(false);

  // افترض أن لديك userId من Supabase Auth في الواجهة
  // مرّره هنا (أو اجلبه من السياق/كوكي)
  const userId = '262f49fc-c9b4-40d6-9e72-8244af8bc989';

  const handlePay = async () => {
    setLoading(true);
    const res = await fetch('/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        userId,
        customerEmail: 'aboodi8rdodi@gmail.com'
      })
    });
    const data = await res.json();
    setLoading(false);
    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
    } else {
      alert('❌ خطأ: ' + (data.error || 'Unknown error'));
      console.error(data.details);
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">💳 الدفع عبر MyFatoorah</h1>

      <label className="block mb-2 font-semibold">اختر الخطة</label>
      <select
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        className="w-full border p-2 rounded mb-4"
      >
        <option value="basic">Basic — 50 SAR</option>
        <option value="premium">Premium — 100 SAR</option>
      </select>

      <button
        onClick={handlePay}
        disabled={loading}
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg"
      >
        {loading ? '⏳ جاري التحويل...' : '🚀 ادفع الآن'}
      </button>
    </div>
  );
}
