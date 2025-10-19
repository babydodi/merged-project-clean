'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // بعد 10 ثواني يحوله للداشبورد
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 10000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="p-12 text-center">
      <h1 className="text-3xl font-bold text-green-600 mb-4">✅ تم الاشتراك بنجاح</h1>
      <p className="text-lg mb-2">🎉 تم إتاحة جميع الاختبارات لك الآن</p>
      <p className="text-gray-600">سيتم تحويلك للداشبورد خلال 10 ثواني...</p>
    </div>
  );
}
