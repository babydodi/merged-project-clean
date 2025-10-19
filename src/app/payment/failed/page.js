export default function FailedPage() {
  return (
    <div className="p-12 text-center">
      <h1 className="text-3xl font-bold text-red-600 mb-4">❌ فشلت عملية الدفع</h1>
      <p className="text-lg">حدث خطأ أثناء عملية الدفع. حاول مرة أخرى.</p>
    </div>
  );
}
