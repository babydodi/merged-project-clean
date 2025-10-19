import { CheckCircle, BarChart, BookMarked } from 'lucide-react';

const features = [
  {
    icon: <BookMarked className="h-12 w-12 text-blue-600" />,
    title: 'محتوى شامل ومحدث',
    description: 'نقدم لك بنك أسئلة يغطي جميع أقسام اختبار ستيب مع شروحات وافية ومحدثة باستمرار.'
  },
  {
    icon: <BarChart className="h-12 w-12 text-blue-600" />,
    title: 'اختبارات تجريبية محاكية',
    description: 'جرّب بيئة الاختبار الحقيقية من خلال اختباراتنا التجريبية التي تحاكي الاختبار الفعلي.'
  },
  {
    icon: <CheckCircle className="h-12 w-12 text-blue-600" />,
    title: 'تحليل أداء فوري',
    description: 'احصل على تقارير مفصلة بعد كل اختبار لتحديد نقاط القوة والضعف لديك والتركيز عليها.'
  }
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-gray-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">لماذا تختار منصتنا؟</h2>
          <p className="text-gray-600 mt-2">كل ما تحتاجه للنجاح في اختبار STEP في مكان واحد.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-white p-8 rounded-xl shadow-md text-center hover:shadow-xl transition">
              <div className="flex justify-center mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
