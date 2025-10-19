import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function TestsPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: tests, error: testsError } = await supabase
    .from('tests')
    .select('id, title, description, created_at, question_count')
    .order('created_at', { ascending: false });

  if (testsError) {
    console.error('Error fetching tests:', testsError);
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-900 font-sans">
        <div className="text-center text-red-400 font-semibold p-8 bg-gray-800 rounded-lg shadow-xl">
          <p>عذرًا، حدث خطأ أثناء تحميل الاختبارات.</p>
        </div>
      </div>
    );
  }

  if (!tests || tests.length === 0) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-900 font-sans p-6">
        <div className="max-w-xl w-full text-center p-10 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
          <h1 className="text-4xl font-extrabold text-white mb-4">لا توجد اختبارات حاليًا</h1>
          <p className="text-gray-400 text-lg mb-8 leading-relaxed">
            نعمل حاليًا على إعداد اختبارات جديدة. يرجى العودة لاحقًا لترى ما هو جديد!
          </p>
          <Link
            href="/" // It's better to link to a page than to reload
            className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-900 text-white font-sans antialiased p-6 sm:p-8 lg:p-12">
      <header className="max-w-7xl mx-auto text-center mb-16">
        <h1 className="text-4xl sm:text-6xl font-extrabold text-white mb-4 leading-tight">
          لوحة الاختبارات
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          انغمس في عالم المعرفة مع اختباراتنا المصممة بعناية. اختر اختبارًا وابدأ رحلتك.
        </p>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tests.map((test) => (
          <div key={test.id} className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.03]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-blue-400">{test.title}</h2>
              <span className="bg-gray-700 text-sm text-gray-300 font-semibold py-1 px-3 rounded-full">
                {test.question_count ? `${test.question_count} سؤال` : 'غير محدد'}
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-6 line-clamp-3 leading-relaxed">
              {test.description}
            </p>
            <div className="flex justify-between items-center text-sm text-gray-500 mb-6">
              <div className="flex items-center space-x-2 space-x-reverse">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3.25-2A1 1 0 0013.25 10a1 1 0 00-.445-.832l-3.25-2z"></path>
                </svg>
                <span>المدة: 30 دقيقة (مثال)</span>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM10 4a6 6 0 110 12A6 6 0 0110 4z" />
                </svg>
                <span>المستوى: متوسط</span>
              </div>
            </div>
            <Link
              href={`/test/${test.id}`}
              className="inline-block w-full text-center py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-lg hover:bg-blue-700 transition-colors duration-200"
            >
              ابدأ الاختبار
            </Link>
          </div>
        ))}
      </main>
    </div>
  );
}
