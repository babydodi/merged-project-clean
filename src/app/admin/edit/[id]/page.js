'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Message from '../../../../components/Message';
import { v4 as uuidv4 } from 'uuid'; // إذا لا تريد uuid غيّره أو أنشئ id مزدوج

export default function EditTestPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [testTitle, setTestTitle] = useState('');
  const [availability, setAvailability] = useState('all');
  const [chapterData, setChapterData] = useState([]); // [{ chapterId, chapterType, chapterTitle, items: [...] }]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 5000);
  };

  // جلب البيانات
  useEffect(() => {
    const loadTest = async () => {
      if (!id) return;
      setLoading(true);

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

      const chapterPromises = (chapters || []).map(async (ch) => {
        if (ch.type === 'listening') {
          const { data, error } = await supabase
            .from('listening_pieces')
            .select('id, audio_url, transcript, listening_questions(*)')
            .eq('chapter_id', ch.id);
          return {
            chapterId: ch.id,
            chapterType: ch.type,
            chapterTitle: ch.title,
            items: (data || []).map(p => normalizeListeningPiece(p)),
            error,
          };
        }

        if (ch.type === 'reading') {
          const { data, error } = await supabase
            .from('reading_pieces')
            .select('id, passage_title, passage, reading_questions(*)')
            .eq('chapter_id', ch.id);
          return {
            chapterId: ch.id,
            chapterType: ch.type,
            chapterTitle: ch.title,
            items: (data || []).map(p => normalizeReadingPiece(p)),
            error,
          };
        }

        if (ch.type === 'grammar') {
          const { data, error } = await supabase
            .from('grammar_questions')
            .select('*')
            .eq('chapter_id', ch.id);
          return {
            chapterId: ch.id,
            chapterType: ch.type,
            chapterTitle: ch.title,
            items: data || [],
            error,
          };
        }

        return {
          chapterId: ch.id,
          chapterType: ch.type,
          chapterTitle: ch.title,
          items: [],
        };
      });

      const resolved = await Promise.all(chapterPromises);
      setChapterData(resolved);
      setLoading(false);
    };

    if (id) loadTest();
  }, [id, supabase]);

  // Normalizers: ensure arrays exist and assign temporary ids for new items if missing
  function normalizeReadingPiece(p) {
    return {
      id: p.id ?? `new-${uuidv4()}`,
      passage_title: p.passage_title ?? '',
      passage: p.passage ?? '',
      reading_questions: (p.reading_questions || []).map(q => ({ ...q, id: q.id ?? `new-${uuidv4()}` })),
      chapter_id: p.chapter_id,
    };
  }
  function normalizeListeningPiece(p) {
    return {
      id: p.id ?? `new-${uuidv4()}`,
      audio_url: p.audio_url ?? '',
      transcript: p.transcript ?? '',
      listening_questions: (p.listening_questions || []).map(q => ({ ...q, id: q.id ?? `new-${uuidv4()}` })),
      chapter_id: p.chapter_id,
    };
  }

  // تحديث عام لحقل داخل chapterData (immutable)
  const updateChapterField = ({ chapterId, itemId = null, path, value }) => {
    setChapterData(prev =>
      prev.map(ch => {
        if (ch.chapterId !== chapterId) return ch;
        const newCh = { ...ch };
        if (itemId == null) {
          newCh[path] = value;
          return newCh;
        }

        newCh.items = newCh.items.map(it => {
          if (it.id !== itemId) return it;
          const newIt = deepClone(it);
          applyPathUpdate(newIt, path, value);
          return newIt;
        });
        return newCh;
      })
    );
  };

  // مساعدة صغيرة لتطبيق التغيير بحسب path مثل 'passage' أو 'reading_questions.0.question' أو 'reading_questions.1.options.2'
  function applyPathUpdate(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (p.match(/^\d+$/)) {
        const idx = Number(p);
        if (!Array.isArray(cur)) cur = [];
        if (!cur[idx]) cur[idx] = {};
        cur = cur[idx];
      } else {
        if (!cur[p]) {
          // اكتشف إن كانت المرحلة التالية رقمية -> مصفوفة
          const next = parts[i + 1];
          cur[p] = next && next.match(/^\d+$/) ? [] : {};
        }
        cur = cur[p];
      }
    }
    const last = parts[parts.length - 1];
    if (last.match(/^\d+$/)) {
      const idx = Number(last);
      if (!Array.isArray(cur)) cur = [];
      cur[idx] = value;
    } else {
      cur[last] = value;
    }
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // إضافة سؤال جديد أو قطعة جديدة
  const addNewItem = (chapterId, type, parentItemId = null) => {
    setChapterData(prev =>
      prev.map(ch => {
        if (ch.chapterId !== chapterId) return ch;
        const newCh = deepClone(ch);
        if (type === 'grammar_question') {
          newCh.items = [...(newCh.items || []), { id: `new-${uuidv4()}`, question: '', answer: '', chapter_id: chapterId }];
          return newCh;
        }
        if (type === 'reading_piece') {
          newCh.items = [
            ...(newCh.items || []),
            {
              id: `new-${uuidv4()}`,
              passage_title: '',
              passage: '',
              reading_questions: [],
              chapter_id: chapterId,
            },
          ];
          return newCh;
        }
        if (type === 'reading_question') {
          newCh.items = newCh.items.map(it => {
            if (it.id !== parentItemId) return it;
            const copy = deepClone(it);
            copy.reading_questions = [...(copy.reading_questions || []), { id: `new-${uuidv4()}`, question: '', options: [], answer: '' }];
            return copy;
          });
          return newCh;
        }
        if (type === 'listening_piece') {
          newCh.items = [
            ...(newCh.items || []),
            {
              id: `new-${uuidv4()}`,
              audio_url: '',
              transcript: '',
              listening_questions: [],
              chapter_id: chapterId,
            },
          ];
          return newCh;
        }
        if (type === 'listening_question') {
          newCh.items = newCh.items.map(it => {
            if (it.id !== parentItemId) return it;
            const copy = deepClone(it);
            copy.listening_questions = [...(copy.listening_questions || []), { id: `new-${uuidv4()}`, question: '', options: [], answer: '' }];
            return copy;
          });
          return newCh;
        }
        return newCh;
      })
    );
  };

  // حذف عنصر
  const deleteItem = (chapterId, itemId, nested = false, nestedIndex = null, nestedArrayKey = null) => {
    setChapterData(prev =>
      prev.map(ch => {
        if (ch.chapterId !== chapterId) return ch;
        const newCh = deepClone(ch);
        if (!nested) {
          newCh.items = (newCh.items || []).filter(it => it.id !== itemId);
          return newCh;
        } else {
          // حذف عنصر من مصفوفة داخل قطعة (مثلاً حذف سؤال داخل reading_questions)
          newCh.items = (newCh.items || []).map(it => {
            if (it.id !== itemId) return it;
            const copy = deepClone(it);
            copy[nestedArrayKey] = (copy[nestedArrayKey] || []).filter((_, idx) => idx !== nestedIndex);
            return copy;
          });
          return newCh;
        }
      })
    );
  };

  // حفظ جميع التعديلات
  const saveTest = async () => {
    if (!testTitle) {
      showMessage('❌ أدخل عنوان الاختبار', true);
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.from('tests').update({ title: testTitle, availability }).eq('id', id);
      if (updateError) throw updateError;

      // تجميع الجرامر
      const grammarItems = chapterData
        .filter(c => c.chapterType === 'grammar')
        .flatMap(c => (c.items || []).map(q => ({ ...q, chapter_id: c.chapterId })));

      if (grammarItems.length) {
        const { error: gErr } = await supabase.from('grammar_questions').upsert(grammarItems, { onConflict: 'id' });
        if (gErr) throw gErr;
      }

      // قراءة: upsert للقطع ثم upsert لأسئلة القراءة (ضع piece_id)
      const readingPieces = chapterData.filter(c => c.chapterType === 'reading').flatMap(c => (c.items || []).map(p => ({ ...p, chapter_id: c.chapterId })));
      if (readingPieces.length) {
        // upsert قطع (نرسل الحقول المتوافقة مع جدولك)
        const rp = readingPieces.map(({ id, passage_title, passage, chapter_id }) => ({ id, passage_title, passage, chapter_id }));
        const { error: rpErr } = await supabase.from('reading_pieces').upsert(rp, { onConflict: 'id' });
        if (rpErr) throw rpErr;

        // upsert أسئلة القراءة
        const readingQuestions = readingPieces.flatMap(p => (p.reading_questions || []).map(q => ({ ...q, piece_id: p.id || null, chapter_id: p.chapter_id })));
        if (readingQuestions.length) {
          const { error: rqErr } = await supabase.from('reading_questions').upsert(readingQuestions, { onConflict: 'id' });
          if (rqErr) throw rqErr;
        }
      }

      // استماع: مماثل للقراءة
      const listeningPieces = chapterData.filter(c => c.chapterType === 'listening').flatMap(c => (c.items || []).map(p => ({ ...p, chapter_id: c.chapterId })));
      if (listeningPieces.length) {
        const lp = listeningPieces.map(({ id, audio_url, transcript, chapter_id }) => ({ id, audio_url, transcript, chapter_id }));
        const { error: lpErr } = await supabase.from('listening_pieces').upsert(lp, { onConflict: 'id' });
        if (lpErr) throw lpErr;

        const listeningQuestions = listeningPieces.flatMap(p => (p.listening_questions || []).map(q => ({ ...q, piece_id: p.id || null, chapter_id: p.chapter_id })));
        if (listeningQuestions.length) {
          const { error: lqErr } = await supabase.from('listening_questions').upsert(listeningQuestions, { onConflict: 'id' });
          if (lqErr) throw lqErr;
        }
      }

      showMessage('✅ تم الحفظ بنجاح');
    } catch (err) {
      showMessage(`❌ فشل الحفظ: ${err.message}`, true);
    } finally {
      setSaving(false);
    }
  };

  const deleteTest = async () => {
    if (!confirm('هل أنت متأكد أنك تريد حذف هذا الاختبار؟')) return;
    try {
      const { error: delError } = await supabase.from('tests').delete().eq('id', id);
      if (delError) throw delError;
      showMessage('🗑️ تم حذف الاختبار بنجاح');
      router.push('/admin/tests');
    } catch (err) {
      showMessage(`❌ فشل الحذف: ${err.message}`, true);
    }
  };

  if (loading) return <div className="p-8 text-center">⏳ جاري تحميل الاختبار...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">✏️ تعديل الاختبار</h1>
        {message && <Message text={message.text} isError={message.isError} />}

        <input
          type="text"
          value={testTitle}
          onChange={(e) => setTestTitle(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4"
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

        <div className="space-y-6">
          {chapterData.map((ch) => (
            <div key={ch.chapterId} className="p-4 border rounded bg-white">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  {ch.chapterTitle} — <span className="text-sm text-gray-600">{ch.chapterType}</span>
                </h3>
                <div className="flex gap-2">
                  {/* Add item buttons per type */}
                  {ch.chapterType === 'grammar' && (
                    <button
                      onClick={() => addNewItem(ch.chapterId, 'grammar_question')}
                      className="px-3 py-1 bg-green-500 text-white rounded"
                    >
                      إضافة سؤال جرامر
                    </button>
                  )}
                  {ch.chapterType === 'reading' && (
                    <>
                      <button
                        onClick={() => addNewItem(ch.chapterId, 'reading_piece')}
                        className="px-3 py-1 bg-blue-500 text-white rounded"
                      >
                        إضافة قطعة قراءة
                      </button>
                    </>
                  )}
                  {ch.chapterType === 'listening' && (
                    <button
                      onClick={() => addNewItem(ch.chapterId, 'listening_piece')}
                      className="px-3 py-1 bg-indigo-500 text-white rounded"
                    >
                      إضافة قطعة استماع
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {/* GRAMMAR */}
                {ch.chapterType === 'grammar' &&
                  (ch.items || []).map((q, idx) => (
                    <div key={q.id} className="p-3 border rounded bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="w-full">
                          <textarea
                            value={q.question || ''}
                            onChange={(e) =>
                              updateChapterField({ chapterId: ch.chapterId, itemId: q.id, path: 'question', value: e.target.value })
                            }
                            className="w-full border p-2 mb-2"
                            placeholder="نص السؤال"
                          />
                          <input
                            value={q.answer || ''}
                            onChange={(e) =>
                              updateChapterField({ chapterId: ch.chapterId, itemId: q.id, path: 'answer', value: e.target.value })
                            }
                            className="w-full border p-2"
                            placeholder="الإجابة الصحيحة"
                          />
                        </div>
                        <div className="ml-3">
                          <button
                            onClick={() => deleteItem(ch.chapterId, q.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded"
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                {/* READING */}
                {ch.chapterType === 'reading' &&
                  (ch.items || []).map((piece) => (
                    <div key={piece.id} className="p-3 border rounded bg-gray-50">
                      <div className="flex justify-between">
                        <div className="w-full">
                          <input
                            value={piece.passage_title || ''}
                            onChange={(e) =>
                              updateChapterField({ chapterId: ch.chapterId, itemId: piece.id, path: 'passage_title', value: e.target.value })
                            }
                            className="w-full border p-2 mb-2"
                            placeholder="عنوان المقطع"
                          />
                          <textarea
                            value={piece.passage || ''}
                            onChange={(e) =>
                              updateChapterField({ chapterId: ch.chapterId, itemId: piece.id, path: 'passage', value: e.target.value })
                            }
                            className="w-full border p-2 mb-2"
                            placeholder="نص المقطع"
                          />
                        </div>
                        <div className="ml-3">
                          <button
                            onClick={() => deleteItem(ch.chapterId, piece.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded"
                          >
                            حذف القطعة
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">أسئلة المقطع</h4>
                          <button
                            onClick={() => addNewItem(ch.chapterId, 'reading_question', piece.id)}
                            className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                          >
                            إضافة سؤال
                          </button>
                        </div>

                        {(piece.reading_questions || []).map((rq, rIdx) => (
                          <div key={rq.id} className="p-2 border rounded bg-white mb-2">
                            <div className="flex justify-between items-start">
                              <div className="w-full">
                                <input
                                  value={rq.question || ''}
                                  onChange={(e) =>
                                    updateChapterField({
                                      chapterId: ch.chapterId,
                                      itemId: piece.id,
                                      path: `reading_questions.${rIdx}.question`,
                                      value: e.target.value,
                                    })
                                  }
                                  className="w-full border p-2 mb-2"
                                  placeholder="نص السؤال"
                                />
                                <input
                                  value={rq.answer || ''}
                                  onChange={(e) =>
                                    updateChapterField({
                                      chapterId: ch.chapterId,
                                      itemId: piece.id,
                                      path: `reading_questions.${rIdx}.answer`,
                                      value: e.target.value,
                                    })
                                  }
                                  className="w-full border p-2 mb-2"
                                  placeholder="الإجابة الصحيحة"
                                />
                                {/* خيارات الاختيار المتعدد كمصفوفة نصية */}
                                <div className="space-y-1">
                                  {(rq.options || []).map((opt, oIdx) => (
                                    <div key={oIdx} className="flex gap-2">
                                      <input
                                        value={opt}
                                        onChange={(e) =>
                                          updateChapterField({
                                            chapterId: ch.chapterId,
                                            itemId: piece.id,
                                            path: `reading_questions.${rIdx}.options.${oIdx}`,
                                            value: e.target.value,
                                          })
                                        }
                                        className="border p-1 flex-1"
                                      />
                                      <button
                                        className="px-2 bg-red-500 text-white rounded"
                                        onClick={() =>
                                          // حذف الخيار عبر حذف من المصفوفة
                                          updateChapterField({
                                            chapterId: ch.chapterId,
                                            itemId: piece.id,
                                            path: `reading_questions.${rIdx}.options`,
                                            value: (rq.options || []).filter((_, k) => k !== oIdx),
                                          })
                                        }
                                      >
                                        حذف
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-sm"
                                    onClick={() =>
                                      updateChapterField({
                                        chapterId: ch.chapterId,
                                        itemId: piece.id,
                                        path: `reading_questions.${rIdx}.options`,
                                        value: [...(rq.options || []), ''],
                                      })
                                    }
                                  >
                                    إضافة خيار
                                  </button>
                                </div>
                              </div>

                              <div className="ml-3">
                                <button
                                  onClick={() => deleteItem(ch.chapterId, piece.id, true, rIdx, 'reading_questions')}
                                  className="px-3 py-1 bg-red-500 text-white rounded"
                                >
                                  حذف السؤال
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                {/* LISTENING */}
                {ch.chapterType === 'listening' &&
                  (ch.items || []).map((piece) => (
                    <div key={piece.id} className="p-3 border rounded bg-gray-50">
                      <div className="flex justify-between">
                        <div className="w-full">
                          <input
                            value={piece.audio_url || ''}
                            onChange={(e) =>
                              updateChapterField({ chapterId: ch.chapterId, itemId: piece.id, path: 'audio_url', value: e.target.value })
                            }
                            className="w-full border p-2 mb-2"
                            placeholder="رابط الصوت"
                          />
                          <textarea
                            value={piece.transcript || ''}
                            onChange={(e) =>
                              updateChapterField({ chapterId: ch.chapterId, itemId: piece.id, path: 'transcript', value: e.target.value })
                            }
                            className="w-full border p-2 mb-2"
                            placeholder="النص أو الترانسكريبت"
                          />
                        </div>
                        <div className="ml-3">
                          <button
                            onClick={() => deleteItem(ch.chapterId, piece.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded"
                          >
                            حذف القطعة
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">أسئلة الاستماع</h4>
                          <button
                            onClick={() => addNewItem(ch.chapterId, 'listening_question', piece.id)}
                            className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                          >
                            إضافة سؤال
                          </button>
                        </div>

                        {(piece.listening_questions || []).map((lq, lIdx) => (
                          <div key={lq.id} className="p-2 border rounded bg-white mb-2">
                            <div className="flex justify-between items-start">
                              <div className="w-full">
                                <input
                                  value={lq.question || ''}
                                  onChange={(e) =>
                                    updateChapterField({
                                      chapterId: ch.chapterId,
                                      itemId: piece.id,
                                      path: `listening_questions.${lIdx}.question`,
                                      value: e.target.value,
                                    })
                                  }
                                  className="w-full border p-2 mb-2"
                                  placeholder="نص السؤال"
                                />
                                <input
                                  value={lq.answer || ''}
                                  onChange={(e) =>
                                    updateChapterField({
                                      chapterId: ch.chapterId,
                                      itemId: piece.id,
                                      path: `listening_questions.${lIdx}.answer`,
                                      value: e.target.value,
                                    })
                                  }
                                  className="w-full border p-2 mb-2"
                                  placeholder="الإجابة الصحيحة"
                                />
                                <div className="space-y-1">
                                  {(lq.options || []).map((opt, oIdx) => (
                                    <div key={oIdx} className="flex gap-2">
                                      <input
                                        value={opt}
                                        onChange={(e) =>
                                          updateChapterField({
                                            chapterId: ch.chapterId,
                                            itemId: piece.id,
                                            path: `listening_questions.${lIdx}.options.${oIdx}`,
                                            value: e.target.value,
                                          })
                                        }
                                        className="border p-1 flex-1"
                                      />
                                      <button
                                        className="px-2 bg-red-500 text-white rounded"
                                        onClick={() =>
                                          updateChapterField({
                                            chapterId: ch.chapterId,
                                            itemId: piece.id,
                                            path: `listening_questions.${lIdx}.options`,
                                            value: (lq.options || []).filter((_, k) => k !== oIdx),
                                          })
                                        }
                                      >
                                        حذف
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-sm"
                                    onClick={() =>
                                      updateChapterField({
                                        chapterId: ch.chapterId,
                                        itemId: piece.id,
                                        path: `listening_questions.${lIdx}.options`,
                                        value: [...(lq.options || []), ''],
                                      })
                                    }
                                  >
                                    إضافة خيار
                                  </button>
                                </div>
                              </div>

                              <div className="ml-3">
                                <button
                                  onClick={() => deleteItem(ch.chapterId, piece.id, true, lIdx, 'listening_questions')}
                                  className="px-3 py-1 bg-red-500 text-white rounded"
                                >
                                  حذف السؤال
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
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

          <div className="flex gap-3">
            <button
              onClick={saveTest}
              disabled={saving}
              className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'جارٍ الحفظ...' : '💾 حفظ التحديثات'}
            </button>
            <button
              onClick={() => router.push('/admin/tests')}
              className="px-6 py-3 bg-gray-300 text-gray-800 font-medium rounded-lg hover:bg-gray-400"
            >
              العودة للقائمة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
