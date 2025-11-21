'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AdminTestsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // حقول الرفع
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [grammarFile, setGrammarFile] = useState(null);
  const [readingFile, setReadingFile] = useState(null);
  const [listeningFile, setListeningFile] = useState(null);
  const [fullFile, setFullFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('id, title, description, availability, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('loadTests error', error);
        setTests([]);
      } else {
        setTests(data || []);
      }
    } catch (err) {
      console.error('loadTests exception', err);
      setTests([]);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------
  // دوال مساعدة آمنة لتحليل الملفات إلى مصفوفة فصول
  // ------------------------------
  const parseFileToChapters = async (file) => {
    // دائمًا تعيد مصفوفة (حتى لو فشل التحليل) لمنع أخطاء "not iterable"
    if (!file) return [];
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // حالة: body.chapters: [ ... ]
      if (Array.isArray(json.chapters) && json.chapters.length) return json.chapters;

      // حالة: الملف نفسه قد يكون مصفوفة من الفصول
      if (Array.isArray(json) && json.length) return json;

      // حالة: body.chapter: { ... } -> [ chapter ]
      if (json.chapter && typeof json.chapter === 'object') return [json.chapter];

      // حالة: الملف نفسه قد يمثل فصل مفرد يحتوي questions أو pieces
      if (json && typeof json === 'object' && (Array.isArray(json.questions) || Array.isArray(json.pieces))) {
        return [json];
      }

      // لا نجد بنية فصل واضحة -> رجّع مصفوفة فارغة
      return [];
    } catch (err) {
      // لا نُرمِ الاستثناء لكي لا يكسر تدفق الرفع؛ نرجع مصفوفة فارغة ونطبع الخطأ
      console.error('parseFileToChapters error for', file?.name, err);
      return [];
    }
  };

  const safeSpread = (x) => (Array.isArray(x) ? x : []);

  const normalizeChapter = (ch) => {
    const chapter = { ...ch };
    if (!chapter.type) {
      if (Array.isArray(chapter.questions)) chapter.type = 'grammar';
      else if (Array.isArray(chapter.pieces)) {
        const firstPiece = Array.isArray(chapter.pieces) ? chapter.pieces[0] : null;
        if (firstPiece && (firstPiece.audio_url || firstPiece.transcript)) chapter.type = 'listening';
        else chapter.type = 'reading';
      } else chapter.type = 'unknown';
    }
    chapter.idx = typeof chapter.idx === 'number' ? chapter.idx : null;
    chapter.title = chapter.title || null;
    chapter.duration_seconds = typeof chapter.duration_seconds === 'number' ? chapter.duration_seconds : null;
    return chapter;
  };

  // ------------------------------
  // الدالة الرئيسية لرفع الملفات
  // ------------------------------
  const handleUpload = async () => {
    // تحقق مبكر
    if (!title) {
      setMessage('❌ العنوان مطلوب');
      return;
    }
    if (!grammarFile && !readingFile && !listeningFile && !fullFile) {
      setMessage('❌ اختر على الأقل ملف واحد (Grammar / Reading / Listening / Full)');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      let chapters = [];

      if (fullFile) {
        // الملف الكامل يفترض أن يحتوي root.chapters أو فصل واحد
        const parsed = await parseFileToChapters(fullFile);
        chapters = parsed;
      } else {
        // ملفات منفصلة: أرسلها كلها إلى parse في نفس الوقت
        const [grammarChapters, readingChapters, listeningChapters] = await Promise.all([
          parseFileToChapters(grammarFile),
          parseFileToChapters(readingFile),
          parseFileToChapters(listeningFile),
        ]);

        // طباعة تصحيحية لمساعدتك أثناء التطوير
        console.log('parsed chapters counts:', {
          g: grammarChapters.length,
          r: readingChapters.length,
          l: listeningChapters.length,
        });
        console.log('sample parsed contents:', {
          grammarSample: grammarChapters[0],
          readingSample: readingChapters[0],
          listeningSample: listeningChapters[0],
        });

        chapters = [
          ...safeSpread(grammarChapters),
          ...safeSpread(readingChapters),
          ...safeSpread(listeningChapters),
        ];
      }

      // تطبيع الفصول وفحص وجود أسئلة أو pieces
      const normalized = chapters.map(normalizeChapter);
      const filtered = normalized.filter((c) => {
        const hasQuestions = Array.isArray(c.questions) && c.questions.length > 0;
        const hasPieces = Array.isArray(c.pieces) && c.pieces.length > 0;
        if (!hasQuestions && !hasPieces) {
          console.warn('Filtered out chapter (no questions/pieces):', c);
        }
        return hasQuestions || hasPieces;
      });

      console.log('final chapters after normalize & filter count:', filtered.length);

      if (!filtered.length) {
        setMessage('❌ لا توجد فصول/أسئلة صالحة في الملفات المرفوعة');
        setUploading(false);
        return;
      }

      // تجهيز الجسم للـ API
      const body = {
        title,
        description,
        availability: 'all',
        is_published: true,
        chapters: filtered,
      };

      // طبع حجم payload لمراقبة المشاكل المحتملة الكبيرة
      try {
        const bodyStr = JSON.stringify(body);
        console.log('payload size (chars):', bodyStr.length);
      } catch (e) {
        console.warn('Unable to stringify body for size check', e);
      }

      // إرسال إلى route
      const res = await fetch('/api/admin/upload-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setMessage(`✅ تم رفع الاختبار بنجاح (ID: ${data.test_id})`);
        // إعادة تهيئة الحقول
        setTitle('');
        setDescription('');
        setGrammarFile(null);
        setReadingFile(null);
        setListeningFile(null);
        setFullFile(null);
        // إعادة تحميل الاختبارات
        loadTests();
      } else {
        // عرض رسالة مفصّلة إن وُجدت
        console.error('upload-json response error', data);
        setMessage(`❌ خطأ من السيرفر: ${data.error || 'غير معروف'}`);
      }
    } catch (err) {
      console.error('handleUpload exception', err);
      setMessage(`❌ حدث خطأ أثناء رفع الملفات: ${err.message || String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">📋 لوحة تحكم الاختبارات</h1>

      <div className="bg-white shadow rounded-lg p-6 mb-10">
        <h2 className="text-xl font-semibold mb-4">📤 رفع اختبار جديد</h2>

        <div className="mb-4">
          <label className="block mb-1 font-semibold">عنوان الاختبار</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="مثال: STEP Grammar Test"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-semibold">الوصف</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="اكتب وصف قصير للاختبار"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-semibold">📘 ملف Grammar</label>
          <input type="file" accept=".json" onChange={(e) => setGrammarFile(e.target.files[0] ?? null)} />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-semibold">📖 ملف Reading</label>
          <input type="file" accept=".json" onChange={(e) => setReadingFile(e.target.files[0] ?? null)} />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-semibold">🎧 ملف Listening</label>
          <input type="file" accept=".json" onChange={(e) => setListeningFile(e.target.files[0] ?? null)} />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-semibold">📂 ملف كامل (يشمل كل الأقسام)</label>
          <input type="file" accept=".json" onChange={(e) => setFullFile(e.target.files[0] ?? null)} />
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-4 py-2 bg-indigo-600 text-white rounded"
        >
          {uploading ? '⏳ جاري الرفع...' : 'رفع الاختبار'}
        </button>

        {message && <p className="mt-4">{message}</p>}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">📚 قائمة الاختبارات</h2>

        {loading ? (
          <p>⏳ جاري التحميل...</p>
        ) : tests.length === 0 ? (
          <p>❌ لا توجد اختبارات حالياً</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-right">
                <th className="p-2 border">#</th>
                <th className="p-2 border">العنوان</th>
                <th className="p-2 border">الوصف</th>
                <th className="p-2 border">الحالة</th>
                <th className="p-2 border">تاريخ الإنشاء</th>
                <th className="p-2 border">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test, idx) => (
                <tr key={test.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{idx + 1}</td>
                  <td className="p-2 border">{test.title}</td>
                  <td className="p-2 border">{test.description}</td>
                  <td className="p-2 border">{test.availability}</td>
                  <td className="p-2 border">
                    {new Date(test.created_at).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="p-2 border">
                    <button
                      onClick={() => router.push(`/admin/tests/${test.id}`)}
                      className="px-3 py-1 bg-blue-600 text-white rounded mr-2"
                    >
                      ✏️ تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
