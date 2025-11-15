'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '../../../../components/ui/buttonn';

export default function AttemptReviewPage() {
  const { attemptId } = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]); // { attemptRow, question }
  const [attempt, setAttempt] = useState(null);

  useEffect(() => {
    if (!attemptId) return;
    loadReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const loadReview = async () => {
    setLoading(true);
    try {
      // جلب attempt
      const { data: atData, error: atErr } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('id', attemptId)
        .single();
      if (atErr) throw atErr;
      setAttempt(atData);

      // جلب question_attempts
      const { data: attemptsRows, error: attemptsErr } = await supabase
        .from('question_attempts')
        .select('id, question_id, question_type, selected_choice, is_correct, answered_at')
        .eq('attempt_id', attemptId)
        .order('answered_at', { ascending: true });
      if (attemptsErr) throw attemptsErr;

      // جمع المعرفات
      const listeningIds = attemptsRows.filter(a => a.question_type === 'listening').map(a => a.question_id);
      const readingIds = attemptsRows.filter(a => a.question_type === 'reading').map(a => a.question_id);
      const grammarIds = attemptsRows.filter(a => a.question_type === 'grammar').map(a => a.question_id);

      const [lQRes, rQRes, gQRes] = await Promise.all([
        listeningIds.length ? supabase.from('listening_questions').select('*').in('id', listeningIds) : { data: [] },
        readingIds.length ? supabase.from('reading_questions').select('*').in('id', readingIds) : { data: [] },
        grammarIds.length ? supabase.from('grammar_questions').select('*').in('id', grammarIds) : { data: [] }
      ]);

      if (lQRes.error || rQRes.error || gQRes.error) {
        throw lQRes.error || rQRes.error || gQRes.error;
      }

      const qMap = {};
      (lQRes.data || []).forEach(q => qMap[q.id] = { ...q, type: 'listening' });
      (rQRes.data || []).forEach(q => qMap[q.id] = { ...q, type: 'reading' });
      (gQRes.data || []).forEach(q => qMap[q.id] = { ...q, type: 'grammar' });

      const merged = attemptsRows.map(ar => ({
        attemptRow: ar,
        question: qMap[ar.question_id] || null
      }));

      setItems(merged);
    } catch (err) {
      console.error('loadReview error', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>جاري تحميل المراجعة...</div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>لم يتم العثور على المحاولة.</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">مراجعة المحاولة</h1>
        <div className="space-x-2 space-x-reverse">
          <Button onClick={() => router.push('/dashboard')} variant="outline">العودة</Button>
        </div>
      </div>

      {items.length === 0 && (
        <div className="p-6 bg-white rounded shadow">لا توجد إجابات محفوظة لهذه المحاولة.</div>
      )}

      {items.map((it, idx) => {
        const q = it.question;
        const sel = it.attemptRow.selected_choice;
        const isCorrect = it.attemptRow.is_correct;
        return (
          <div key={it.attemptRow.id} className="bg-white rounded shadow p-6 mb-4">
            <div className="mb-2 font-semibold text-lg">{idx + 1}. {q ? q.question_text : 'سؤال غير متاح'}</div>

            {q && (q.options || []).map((opt, i) => {
              const isSelected = opt === sel;
              const isRight = opt === q.answer;
              const bg = isRight ? 'bg-green-50 border-green-300' : isSelected && !isRight ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200';
              return (
                <div key={i} className={`border p-3 rounded mb-2 ${bg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="font-medium ml-3">{String.fromCharCode(65 + i)}.</div>
                      <div>{opt}</div>
                    </div>
                    <div>
                      {isRight && <span className="text-green-700 font-semibold ml-3">الإجابة الصحيحة</span>}
                      {isSelected && !isRight && <span className="text-red-700 font-semibold ml-3">اختيارك</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {q && q.explanation && (
              <div className="mt-2 text-sm text-slate-600">
                <strong>شرح:</strong> {typeof q.explanation === 'object' ? (q.explanation.ar || q.explanation.en || JSON.stringify(q.explanation)) : q.explanation}
              </div>
            )}

            <div className="mt-3 text-sm text-slate-500">
              الحالة: {isCorrect ? <span className="text-green-700 font-semibold">صح</span> : <span className="text-red-700 font-semibold">خطأ</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
