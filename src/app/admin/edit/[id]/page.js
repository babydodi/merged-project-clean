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
  const [listeningData, setListeningData] = useState([]);
  const [readingData, setReadingData] = useState([]);
  const [grammarData, setGrammarData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // ✅ عرض رسالة مؤقتة
  const showMessage = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 5000);
  };

  // ✅ تحميل بيانات الاختبار
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

      const { data: chapters } = await supabase
        .from('chapters')
        .select('id, type, title')
        .eq('test_id', id);

      let listening = [];
      let reading = [];
      let grammar = [];

      for (const ch of chapters || []) {
        if (ch.type === 'listening') {
          const { data } = await supabase
            .from('listening_pieces')
            .select('id, audio_url, transcript, listening_questions(*)')
            .eq('chapter_id', ch.id);
          listening = data || [];
        }
        if (ch.type === 'reading') {
          const { data } = await supabase
            .from('reading_pieces')
            .select('id, passage_title, passage, reading_questions(*)')
            .eq('chapter_id', ch.id);
          reading = data || [];
        }
        if (ch.type === 'grammar') {
          const { data } = await supabase
            .from('grammar_questions')
            .select('*')
            .eq('chapter_id', ch.id);
          grammar = data || [];
        }
      }

      setListeningData(listening);
      setReadingData(reading);
      setGrammarData(grammar);
      setLoading(false);
    };

    if (id) loadTest();
  }, [id, supabase]);

  // ✅ حفظ التعديلات
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

      if (grammarData.length > 0) {
        const { error: gErr } = await supabase
          .from('grammar_questions')
          .upsert(grammarData, { onConflict: 'id' });
        if (gErr) throw gErr;
      }

      showMessage('✅ تم تحديث الاختبار بنجاح');
      router.push('/admin/tests');
    } catch (error) {
      showMessage(`❌ فشل تحديث الاختبار: ${error.message}`, true);
    }
  };

  // ✅ حذف الاختبار
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

  if (loading) return <div className="p-8 text-center">⏳ جاري تحميل الاختبار...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">✏️ تعديل الاختبار</h1>
        {message && <Message text={message.text} isError={message.isError} />}

        {/* عنوان الاختبار */}
        <input
          type="text"
          value={testTitle}
          onChange={(e) => setTestTitle(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md mb-6"
          placeholder="عنوان الاختبار"
        />

        {/* التحكم في availability */}
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

        {/* أزرار التحكم */}
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
