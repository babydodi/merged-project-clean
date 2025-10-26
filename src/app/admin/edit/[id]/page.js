'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Message from '../../../../components/Message';

export default function EditTestPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [testTitle, setTestTitle] = useState('');
  const [availability, setAvailability] = useState('all');
  const [chapterData, setChapterData] = useState([]); // new unified structure
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 5000);
  };

  useEffect(() => {
    const loadTest = async () => {
      if (!id) return;

      const { data: test, error: testError } = await supabase
        .from('tests')
        .select('title, availability')
        .eq('id', id)
        .single();

      if (testError || !test) {
        showMessage('❌ الاختبار غير موجود', true);
        setLoading(false);
        return;
      }

      setTestTitle(test.title);
      setAvailability(test.availability);

      const { data: chapters, error: chaptersError } = await supabase
        .from('chapters')
        .select('id, type, title')
        .eq('test_id', id);

      if (chaptersError) {
        showMessage('❌ فشل جلب الفصول', true);
        setLoading(false);
        return;
      }

      // لكل فصل نجلب بياناته الخاصة بناء على النوع
      const chapterPromises = (chapters || []).map(async (ch) => {
        if (ch.type === 'listening') {
          const { data, error } = await supabase
            .from('listening_pieces')
            .select('id, audio_url, transcript, listening_questions(*)')
            .eq('chapter_id', ch.id);
          if (error) return { chapterId: ch.id, chapterType: ch.type, chapterTitle: ch.title, items: [], error };
          // كل قطعة لديها listening_questions كمصفوفة
          return { chapterId: ch.id, chapterType: ch.type, chapterTitle: ch.title, items: data || [] };
        }

        if (ch.type === 'reading') {
          const { data, error } = await supabase
            .from('reading_pieces')
            .select('id, passage_title, passage, reading_questions(*)')
            .eq('chapter_id', ch.id);
          if (error) return { chapterId: ch.id, chapterType: ch.type, chapterTitle: ch.title, items: [], error };
          return { chapterId: ch.id, chapterType: ch.type, chapterTitle: ch.title, items: data || [] };
        }

        if (ch.type === 'grammar') {
          const { data, error } = await supabase
            .from('grammar_questions')
            .select('*')
            .eq('chapter_id', ch.id);
          if (error) return { chapterId: ch.id, chapterType: ch.type, chapterTitle: ch.title, items: [], error };
          return { chapterId: ch.id, chapterType: ch.type, chapterTitle: ch.title, items: data || [] };
        }

        // افتراضي: فصل بنوع غير متوقع
        return { chapterId: ch.id, chapterType: ch.type, chapterTitle: ch.title, items: [] };
      });

      const resolved = await Promise.all(chapterPromises);
      setChapterData(resolved);
      setLoading(false);
    };

    if (id) loadTest();
  }, [id, supabase]);

  // حفظ التعديلات (مثال بسيط فقط: تعديل الاختبار و upsert لأسئلة grammar إن وجدت داخل chapterData)
  const saveTest = async () => {
    if (!testTitle) {
      showMessage('❌ أدخل عنوان الاختبار', true);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('tests')
        .update({ title: testTitle, availability })
        .eq('id', id);

      if (updateError) throw updateError;

      // مثال: upsert لجميع grammar questions المجمعة من chapterData
      const grammarItems = chapterData
        .filter((c) => c.chapterType === 'grammar')
        .flatMap((c) => c.items || []);

      if (grammarItems.length > 0) {
        const { error: gErr } = await supabase
          .from('grammar_questions')
          .upsert(grammarItems, { onConflict: 'id' });
        if (gErr) throw gErr;
      }

      showMessage('✅ تم تحديث الاختبار بنجاح');
      router.push('/admin/tests');
    } catch (error) {
      showMessage(`❌ فشل تحديث الاختبار: ${error.message}`, true);
    }
  };

  const deleteTest = async () => {
    if (!confirm('هل أنت متأكد أنك تريد حذف هذا الاختبار؟')) return;

    try {
      const { error: delError } = await supabase
        .from('tests')
        .delete()
        .eq('id', id);

      if (delError) throw delError;

      showMessage('🗑️ تم حذف الاختبار بنجاح');
      router.push('/admin/tests');
    } catch (error) {
      showMessage(`❌ فشل حذف الاختبار: ${error.message}`, true);
    }
  };

  if (loading) return <div className="p-8 text-center">⏳ جارٍ تحميل الاختبار...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">✏️ تعديل الاختبار</h1>
        {message && <Message text={message.text} isError={message.isError} />}

        <input
          type="text"
          value={testTitle}
          onChange={(e) => setTestTitle(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md mb-6"
          placeholder="عنوان الاختبار"
        />

        <label className="block mb-2 font-medium">👥 من يستطيع الوصول للاختبار؟</label>
        <select
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          className="p-2 border rounded mb-6"
        >
          <option value="all">📢 الكل</option>
          <option value="subscribers">✅ المشتركين فقط</option>
          <option value="non_subscribers">🚫 غير المشتركين فقط</option>
        </select>

        {/* عرض الفصول والأسئلة */}
        <div className="space-y-6 mb-6">
          {chapterData.map((ch) => (
            <div key={ch.chapterId} className="p-4 border rounded">
              <h3 className="font-semibold text-lg">
                {ch.chapterTitle} — <span className="text-sm text-gray-600">{ch.chapterType}</span>
              </h3>

              {/* listening / reading pieces may include nested questions arrays */}
              {ch.items.length === 0 ? (
                <div className="text-sm text-gray-500 mt-2">لا توجد عناصر في هذا الفصل</div>
              ) : (
                <div className="mt-2 space-y-3">
                  {ch.chapterType === 'listening' && ch.items.map((piece) => (
                    <div key={piece.id} className="p-2 border rounded bg-gray-50">
                      <div className="text-sm font-medium">قطعة: {piece.id}</div>
                      <div className="text-xs text-gray-700">audio_url: {piece.audio_url}</div>
                      <div className="text-sm mt-2">الأسئلة:</div>
                      <ul className="list-disc ml-5 text-sm">
                        {(piece.listening_questions || []).map((q) => (
                          <li key={q.id}>{q.question || JSON.stringify(q)}</li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {ch.chapterType === 'reading' && ch.items.map((piece) => (
                    <div key={piece.id} className="p-2 border rounded bg-gray-50">
                      <div className="text-sm font-medium">العنوان: {piece.passage_title || `piece-${piece.id}`}</div>
                      <div className="text-xs text-gray-700">المقطع: {piece.passage?.slice(0, 200)}</div>
                      <div className="text-sm mt-2">الأسئلة:</div>
                      <ul className="list-disc ml-5 text-sm">
                        {(piece.reading_questions || []).map((q) => (
                          <li key={q.id}>{q.question || JSON.stringify(q)}</li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {ch.chapterType === 'grammar' && ch.items.map((q) => (
                    <div key={q.id} className="p-2 border rounded bg-gray-50">
                      <div className="text-sm">{q.question || JSON.stringify(q)}</div>
                      <div className="text-xs text-gray-600">answer: {q.answer}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={deleteTest}
            className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
          >
            🗑️ حذف الاختبار
          </button>

          <button
            onClick={saveTest}
            className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700"
          >
            💾 حفظ التحديثات
          </button>
        </div>
      </div>
    </div>
  );
}
