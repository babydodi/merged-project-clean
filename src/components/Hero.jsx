export default function Hero() {
  return (
    <section className="bg-white py-20 md:py-32">
      <div className="container mx-auto px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 leading-tight">
          استعد بثقة لاختبار <span className="text-blue-600">STEP</span>
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          انضم لمنصتنا التفاعلية واحصل على أفضل الموارد التعليمية، اختبارات تجريبية، وتحليلات أداء لمساعدتك على تحقيق أعلى الدرجات.
        </p>
        <div className="mt-10">
          <a href="#cta" className="bg-blue-600 text-white text-lg font-bold px-8 py-4 rounded-xl hover:bg-blue-700 transition shadow-lg">
            ابدأ رحلتك نحو التفوق
          </a>
        </div>
      </div>
    </section>
  );
}
