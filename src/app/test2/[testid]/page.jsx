'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Volume2, ChevronRight, Lightbulb, Home, ArrowLeft } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import HintModal from '../../../components/HintModal';

export default function TestPage() {
  const { testId: id } = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  // state أساسية
  const [test, setTest] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [loading, setLoading] = useState(true);

  // تنقل داخل الاختبار
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPieceIndex, setCurrentPieceIndex] = useState(0);
  const [phase, setPhase] = useState('intro'); // listening: intro | questions
  const [showResult, setShowResult] = useState(false);

  // إجابات ومتابعة
  const [answers, setAnswers] = useState({}); // questionId -> selectedChoice
  const [answeredMap, setAnsweredMap] = useState({}); // questionId -> true
  const [validationError, setValidationError] = useState('');
  const [activeHintQuestion, setActiveHintQuestion] = useState(null);

  // نتائج
  const [scores, setScores] = useState({ listening: 0, reading: 0, grammar: 0, total: 0, percentage: 0 });
  const [wrongAnswers, setWrongAnswers] = useState([]); // ids

  // refs للتمرير
  const questionRefs = useRef({});

  useEffect(() => {
    initTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const initTest = async () => {
    try {
      if (!id) { setLoading(false); return; }
      setLoading(true);

      // إنشاء محاولة جديدة
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData?.user || null;
      const payload = currentUser ? { test_id: id, user_id: currentUser.id } : { test_id: id };

      const { data: attempt, error: attemptErr } = await supabase
        .from('test_attempts')
        .insert(payload)
        .select()
        .single();
      if (attemptErr) throw attemptErr;
      setAttemptId(attempt.id);

      // جلب بيانات الاختبار
      const { data: testData, error: testErr } = await supabase
        .from('tests')
        .select('*')
        .eq('id', id)
        .single();
      if (testErr) throw testErr;
      setTest(testData);

      // جلب الفصول
      const { data: chaptersData, error: chErr } = await supabase
        .from('chapters')
        .select('id, type, title, idx, duration_seconds')
        .eq('test_id', id)
        .order('idx', { ascending: true });
      if (chErr) throw chErr;

      const assembled = [];
      for (const ch of chaptersData) {
        if (ch.type === 'listening') {
          const { data: pieces, error: lpErr } = await supabase
            .from('listening_pieces')
            .select(`
              id,
              audio_url,
              transcript,
              idx,
              listening_questions (
                id,
                question_text,
                options,
                answer,
                hint,
                explanation,
                idx
              )
            `)
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });
          if (lpErr) throw lpErr;
          assembled.push({ ...ch, pieces: pieces || [] });
        } else if (ch.type === 'reading') {
          const { data: pieces, error: rpErr } = await supabase
            .from('reading_pieces')
            .select(`
              id,
              passage_title,
              passage,
              idx,
              reading_questions (
                id,
                question_text,
                options,
                answer,
                hint,
                explanation,
                idx
              )
            `)
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });
          if (rpErr) throw rpErr;
          assembled.push({ ...ch, pieces: pieces || [] });
        } else if (ch.type === 'grammar') {
          const { data: questions, error: gErr } = await supabase
            .from('grammar_questions')
            .select('id, question_text, options, answer, hint, explanation, idx, is_vocabulary, category')
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });
          if (gErr) throw gErr;
          assembled.push({ ...ch, questions: questions || [] });
        }
      }

      // ترتيب نوعي ثم idx
      const order = { listening: 0, reading: 1, grammar: 2 };
      assembled.sort((a, b) => {
        const t = (order[a.type] ?? 99) - (order[b.type] ?? 99);
        if (t !== 0) return t;
        return (a.idx ?? 0) - (b.idx ?? 0);
      });

      setChapters(assembled);
      setCurrentChapterIndex(0);
      setCurrentPieceIndex(0);
      setPhase('intro');
      setShowResult(false);
      setAnswers({});
      setAnsweredMap({});
      setValidationError('');
      setWrongAnswers([]);
      setScores({ listening: 0, reading: 0, grammar: 0, total: 0, percentage: 0 });
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentChapter = useMemo(() => chapters[currentChapterIndex], [chapters, currentChapterIndex]);
  const currentPiece = useMemo(() => {
    if (!currentChapter) return null;
    if (currentChapter.type === 'grammar') return null;
    return currentChapter.pieces?.[currentPieceIndex] || null;
  }, [currentChapter, currentPieceIndex]);

  // حفظ إجابات المقطع الحالي (upsert)
  const savePieceAnswers = async chapterType => {
    if (!attemptId || !currentChapter) return [];
    let qList = [];
    if (chapterType === 'listening') qList = currentChapter?.pieces?.[currentPieceIndex]?.listening_questions || [];
    else if (chapterType === 'reading') qList = currentChapter?.pieces?.[currentPieceIndex]?.reading_questions || [];
    else if (chapterType === 'grammar') {
      const q = currentChapter?.questions?.[currentPieceIndex];
      if (q) qList = [q];
    }

    const rows = [];
    for (const q of qList) {
      if (answers[q.id] !== undefined) {
        const selected = answers[q.id];
        rows.push({
          attempt_id: attemptId,
          question_id: q.id,
          question_type: chapterType,
          selected_choice: selected,
          is_correct: selected === q.answer,
          answered_at: new Date().toISOString()
        });
      }
    }

    if (rows.length === 0) return [];

    const { data, error } = await supabase
      .from('question_attempts')
      .upsert(rows, { onConflict: ['attempt_id', 'question_id'] });

    if (error) console.error('savePieceAnswers upsert error', error);
    return data || [];
  };

  // تحديث اختيار محليًا (بدون عرض فوري للصح/الغلط)
  const handleSelect = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setAnsweredMap(prev => ({ ...prev, [questionId]: true }));
  };

  // غير مجاب في المقطع الحالي
  const getUnansweredInCurrent = () => {
    const qIds = [];
    if (!currentChapter) return qIds;
    if (currentChapter.type === 'listening') {
      const qs = currentChapter.pieces[currentPieceIndex]?.listening_questions || [];
      qs.forEach(q => { if (!answeredMap[q.id]) qIds.push(q.id); });
    } else if (currentChapter.type === 'reading') {
      const qs = currentChapter.pieces[currentPieceIndex]?.reading_questions || [];
      qs.forEach(q => { if (!answeredMap[q.id]) qIds.push(q.id); });
    } else if (currentChapter.type === 'grammar') {
      const q = currentChapter.questions[currentPieceIndex];
      if (q && !answeredMap[q.id]) qIds.push(q.id);
    }
    return qIds;
  };

  // حساب النتائج النهائي مع أوزان وقسم Vocabulary داخل القواعد
  const finalizeScoresAndWrongs = async () => {
    if (!attemptId) return;

    const { data: attemptsRows = [], error: attemptsErr } = await supabase
      .from('question_attempts')
      .select('question_id, question_type, selected_choice, is_correct')
      .eq('attempt_id', attemptId);
    if (attemptsErr) {
      console.error('fetch question_attempts error', attemptsErr);
      return;
    }

    const stats = {
      listening: { total: 0, correct: 0 },
      reading: { total: 0, correct: 0 },
      grammar: { total: 0, correct: 0, vocab_total: 0, vocab_correct: 0 }
    };

    const grammarQuestionIds = attemptsRows.filter(r => r.question_type === 'grammar').map(r => r.question_id);

    // جلب ميتاداتا قواعد لتحديد is_vocabulary (إذا موجود)
    let grammarMeta = {};
    if (grammarQuestionIds.length) {
      const { data: gQs = [], error: gErr } = await supabase
        .from('grammar_questions')
        .select('id, is_vocabulary, category, answer')
        .in('id', grammarQuestionIds);
      if (gErr) console.error('fetch grammar metadata error', gErr);
      (gQs || []).forEach(q => { grammarMeta[q.id] = q; });
    }

    // تجميع
    for (const r of attemptsRows) {
      if (r.question_type === 'listening') {
        stats.listening.total += 1;
        if (r.is_correct) stats.listening.correct += 1;
      } else if (r.question_type === 'reading') {
        stats.reading.total += 1;
        if (r.is_correct) stats.reading.correct += 1;
      } else if (r.question_type === 'grammar') {
        stats.grammar.total += 1;
        if (r.is_correct) stats.grammar.correct += 1;

        const meta = grammarMeta[r.question_id];
        const isVocab = meta ? (meta.is_vocabulary || meta.category === 'vocab') : false;
        if (isVocab) {
          stats.grammar.vocab_total += 1;
          if (r.is_correct) stats.grammar.vocab_correct += 1;
        }
      }
    }

    // أوزان
    const weights = { listening: 20, reading: 40, grammar: 40 };
    const grammarVocabWeight = weights.grammar * 0.10; // 10% من قواعد = 4
    const grammarNonVocabWeight = weights.grammar - grammarVocabWeight; // 36

    const pct = (correct, total) => (total ? (correct / total) : 0);

    const listeningScore = Math.round(pct(stats.listening.correct, stats.listening.total) * weights.listening);
    const readingScore = Math.round(pct(stats.reading.correct, stats.reading.total) * weights.reading);

    const vocabScore = Math.round(pct(stats.grammar.vocab_correct, stats.grammar.vocab_total) * grammarVocabWeight);
    const nonVocabTotal = stats.grammar.total - stats.grammar.vocab_total;
    const nonVocabCorrect = stats.grammar.correct - stats.grammar.vocab_correct;
    const nonVocabScore = Math.round(pct(nonVocabCorrect, nonVocabTotal) * grammarNonVocabWeight);

    const grammarScore = vocabScore + nonVocabScore;
    const totalScore = listeningScore + readingScore + grammarScore;

    const totalQuestions = stats.listening.total + stats.reading.total + stats.grammar.total;
    const totalCorrect = stats.listening.correct + stats.reading.correct + stats.grammar.correct;
    const percentage = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100 * 100) / 100 : 0;

    setScores({ listening: listeningScore, reading: readingScore, grammar: grammarScore, total: totalScore, percentage });

    const wrongRows = attemptsRows.filter(r => !r.is_correct);
    const wrongQuestionIds = wrongRows.map(r => r.question_id);
    setWrongAnswers(wrongQuestionIds);

    // حفظ user_results إن لم تكن موجودة
    const { data: existing = [], error: exErr } = await supabase
      .from('user_results')
      .select('id')
      .eq('attempt_id', attemptId)
      .limit(1);
    if (exErr) console.error('check existing user_results', exErr);

    if (!existing || existing.length === 0) {
      const { error: resultErr } = await supabase
        .from('user_results')
        .insert({
          attempt_id: attemptId,
          score: totalScore,
          total_questions: totalQuestions,
          percentage
        });
      if (resultErr) console.error('Error saving user result:', resultErr);
    }

    // تحديث completed_at
    const { error: completeErr } = await supabase
      .from('test_attempts')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', attemptId);
    if (completeErr) console.error('Error updating attempt completion time:', completeErr);
  };

  const goToQuestionInCurrent = (questionId) => {
    const el = document.getElementById(`q-${questionId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // زر التالي: حفظ، تحقق، انتقال
  const handleNext = async () => {
    if (!currentChapter) return;

    // الحفظ
    if (currentChapter.type === 'listening') {
      if (phase === 'intro') { setPhase('questions'); return; }
      await savePieceAnswers('listening');
    } else if (currentChapter.type === 'reading') {
      await savePieceAnswers('reading');
    } else if (currentChapter.type === 'grammar') {
      await savePieceAnswers('grammar');
    }

    // تحقق
    const unanswered = getUnansweredInCurrent();
    if (unanswered.length > 0) {
      setValidationError(`فيه ${unanswered.length} سؤال ما جاوبت عليه. اضغط رقم السؤال للرجوع أو جاوب الآن.`);
      goToQuestionInCurrent(unanswered[0]);
      return;
    } else {
      setValidationError('');
    }

    // انتقال
    if (currentChapter.type === 'listening') {
      const last = currentChapter.pieces.length - 1;
      if (currentPieceIndex < last) { setCurrentPieceIndex(i => i + 1); setPhase('intro'); }
      else { setCurrentChapterIndex(ci => ci + 1); setCurrentPieceIndex(0); setPhase('intro'); }
      return;
    }
    if (currentChapter.type === 'reading') {
      const last = currentChapter.pieces.length - 1;
      if (currentPieceIndex < last) setCurrentPieceIndex(i => i + 1);
      else { setCurrentChapterIndex(ci => ci + 1); setCurrentPieceIndex(0); setPhase('intro'); }
      return;
    }
    if (currentChapter.type === 'grammar') {
      const last = currentChapter.questions.length - 1;
      if (currentPieceIndex < last) setCurrentPieceIndex(i => i + 1);
      else { await finalizeScoresAndWrongs(); setShowResult(true); }
      return;
    }
  };

  // زر السابق: يسمح بالرجوع داخل نفس الفصل فقط
  const handlePrev = async () => {
    if (!currentChapter) return;
    if (currentChapter.type === 'listening') {
      if (phase === 'questions') { setPhase('intro'); return; }
      await savePieceAnswers('listening');
      if (currentPieceIndex > 0) setCurrentPieceIndex(i => i - 1);
    } else if (currentChapter.type === 'reading') {
      await savePieceAnswers('reading');
      if (currentPieceIndex > 0) setCurrentPieceIndex(i => i - 1);
    } else if (currentChapter.type === 'grammar') {
      await savePieceAnswers('grammar');
      if (currentPieceIndex > 0) setCurrentPieceIndex(i => i - 1);
    }
    setValidationError('');
  };

  const goToReview = () => {
    if (!attemptId) return;
    router.push(`/attempts/${attemptId}/review`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">جاري تحميل الاختبار...</p>
        </div>
      </div>
    );
  }

  if (!currentChapter && !showResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600">لا توجد فصول متاحة لهذا الاختبار.</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline" className="mt-4">
            <Home className="w-4 h-4 mr-2" />
            الرجوع للاختبارات
          </Button>
        </div>
      </div>
    );
  }

  if (showResult) {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{test?.title}</h1>
                <p className="text-sm text-slate-600 mt-1">النتيجة النهائية</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => router.push('/dashboard')} variant="outline" className="border-slate-300">
                  <Home className="w-4 h-4 ml-2" />
                  الرئيسية
                </Button>
                <Button onClick={goToReview} className="bg-blue-600 hover:bg-blue-700 text-white">
                  راجع محاولتي
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">ملخص الدرجات</h2>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex justify-between"><div>الاستماع</div><div className="font-medium">{scores.listening} / 20</div></div>
              <div className="flex justify-between"><div>القراءة</div><div className="font-medium">{scores.reading} / 40</div></div>
              <div className="flex justify-between"><div>القواعد</div><div className="font-medium">{scores.grammar} / 40</div></div>
              <div className="flex justify-between border-t pt-3 mt-3"><div className="font-semibold">المجموع</div><div className="font-semibold">{scores.total} / 100</div></div>
              <div className="flex justify-between"><div>النسبة</div><div className="font-medium">{scores.percentage}%</div></div>
            </div>

            {wrongAnswers.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">أسئلة أخطأت بها</h3>
                <div className="bg-white rounded shadow p-4 border">
                  {wrongAnswers.map((qid, i) => (
                    <div key={qid} className="py-2 border-b last:border-b-0">خطأ #{i + 1} — معرف السؤال: {qid}</div>
                  ))}
                  <div className="text-sm text-slate-500 mt-2">اضغط "راجع محاولتي" لمشاهدة تفاصيل الأخطاء</div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // واجهة الاختبار العادية (مع badges و navigation) — لا تعرض تصحيح فوري
  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{test?.title}</h1>
              <p className="text-sm text-slate-600 mt-1">{currentChapter?.title}</p>
            </div>
            <Button onClick={() => router.push('/dashboard')} variant="outline" className="border-slate-300">
              <Home className="w-4 h-4 ml-2" />
              الرئيسية
            </Button>
          </div>
        </div>
      </header>

      <div className="bg-slate-200 h-1.5">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${((currentChapterIndex + 1) / Math.max(chapters.length, 1)) * 100}%` }} />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {validationError && <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">{validationError}</div>}

        {/* Listening */}
        {currentChapter?.type === 'listening' && (
          <div>
            {phase === 'intro' && (
              <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                  <Volume2 className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold text-slate-900 mb-4">قسم الاستماع</h2>
                  <p className="text-lg text-slate-600 mb-6">اضغط ابدأ للاستماع ثم الإجابة عن أسئلة المقطع.</p>
                  <div className="flex justify-center gap-3">
                    <Button onClick={() => setPhase('questions')} className="bg-blue-600 text-white px-6 py-2">ابدأ</Button>
                    <Button onClick={() => { setCurrentChapterIndex(ci => ci + 1); setCurrentPieceIndex(0); }} variant="outline">تخطي</Button>
                  </div>
                </div>
              </div>
            )}

            {phase === 'questions' && currentPiece && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <audio controls className="w-full" preload="none"><source src={currentPiece.audio_url} type="audio/mpeg" /></audio>
                </div>

                <div className="flex flex-wrap gap-2">
                  {currentPiece.listening_questions.map((q, qi) => {
                    const answered = !!answeredMap[q.id];
                    const cls = answered ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700';
                    return (<button key={q.id} onClick={() => goToQuestionInCurrent(q.id)} className={`px-2 py-1 rounded ${cls}`}>{qi + 1}</button>);
                  })}
                </div>

                {currentPiece.listening_questions.map((q, i) => (
                  <div key={q.id} id={`q-${q.id}`} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <p className="text-lg font-medium text-slate-900 flex-1"><span className="text-blue-600 font-semibold mr-2">{i + 1}.</span>{q.question_text}</p>
                      <button onClick={() => setActiveHintQuestion(q)} className="text-slate-500 hover:text-blue-600"><Lightbulb className="w-5 h-5" /></button>
                    </div>

                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className={`flex items-center p-4 border-2 rounded-md cursor-pointer ${answers[q.id] === opt ? 'border-blue-600' : 'border-slate-200'}`}>
                          <input type="radio" name={`q-${q.id}`} value={opt} onChange={() => handleSelect(q.id, opt)} checked={answers[q.id] === opt} className="w-4 h-4 text-blue-600 mr-3" />
                          <span className="font-medium text-slate-700 mr-2">{String.fromCharCode(65 + oi)}.</span>
                          <span className="text-slate-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex justify-between mt-4">
                  <Button onClick={handlePrev} variant="outline"><ArrowLeft className="w-4 h-4 ml-2" /> السابق</Button>
                  <Button onClick={handleNext} className="bg-blue-600 text-white">التالي <ChevronRight className="w-4 h-4 ml-2" /></Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reading */}
        {currentChapter?.type === 'reading' && currentPiece && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-h-[70vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-slate-900 mb-4">{currentPiece.passage_title}</h3>
              <div className="text-slate-700 leading-relaxed whitespace-pre-line">{currentPiece.passage}</div>
            </div>

            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {currentPiece.reading_questions.map((q, idx) => {
                  const answered = !!answeredMap[q.id];
                  const cls = answered ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700';
                  return (<button key={q.id} onClick={() => goToQuestionInCurrent(q.id)} className={`px-2 py-1 rounded ${cls}`}>{idx + 1}</button>);
                })}
              </div>

              {currentPiece.reading_questions.map((q, qi) => (
                <div key={q.id} id={`q-${q.id}`} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-3">
                  <div className="flex items-start justify-between mb-4">
                    <p className="text-lg font-medium text-slate-900 flex-1"><span className="text-emerald-600 font-semibold mr-2">{qi + 1}.</span>{q.question_text}</p>
                    <button onClick={() => setActiveHintQuestion(q)} className="text-slate-500 hover:text-emerald-600 ml-4"><Lightbulb className="w-5 h-5" /></button>
                  </div>

                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className={`flex items-center p-4 border-2 rounded-md cursor-pointer ${answers[q.id] === opt ? 'border-emerald-600' : 'border-slate-200'}`}>
                        <input type="radio" name={`q-${q.id}`} value={opt} onChange={() => handleSelect(q.id, opt)} checked={answers[q.id] === opt} className="w-4 h-4 text-emerald-600 mr-3" />
                        <span className="font-medium text-slate-700 mr-2">{String.fromCharCode(65 + oi)}.</span>
                        <span className="text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-between mt-4">
                <Button onClick={handlePrev} variant="outline"><ArrowLeft className="w-4 h-4 ml-2" /> السابق</Button>
                <Button onClick={handleNext} className="bg-emerald-600 text-white">التالي <ChevronRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </div>
          </div>
        )}

        {/* Grammar */}
        {currentChapter?.type === 'grammar' && (
          <div className="max-w-3xl mx-auto">
            {(() => {
              const q = currentChapter.questions[currentPieceIndex];
              if (!q) return null;
              return (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                  <div className="flex items-start justify-between mb-6">
                    <p className="text-xl font-medium text-slate-900 flex-1"><span className="text-slate-600 font-semibold mr-2">سؤال {currentPieceIndex + 1} من {currentChapter.questions.length}</span></p>
                    <button onClick={() => setActiveHintQuestion(q)} className="text-slate-500 hover:text-slate-700 ml-4"><Lightbulb className="w-5 h-5" /></button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentChapter.questions.map((qq, idx) => {
                      const answered2 = !!answeredMap[qq.id];
                      const cls2 = answered2 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700';
                      return <button key={qq.id} onClick={() => { setCurrentPieceIndex(idx); goToQuestionInCurrent(qq.id); }} className={`px-2 py-1 rounded ${cls2}`}>{idx + 1}</button>;
                    })}
                  </div>

                  <p className="text-lg text-slate-900 mb-6 leading-relaxed">{q.question_text}</p>

                  <div className="space-y-3">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className={`flex items-center p-4 border-2 rounded-md cursor-pointer ${answers[q.id] === opt ? 'border-slate-600' : 'border-slate-200'}`}>
                        <input type="radio" name={`q-${q.id}`} value={opt} onChange={() => handleSelect(q.id, opt)} checked={answers[q.id] === opt} className="w-4 h-4 text-slate-600 mr-3" />
                        <span className="font-medium text-slate-700 mr-2">{String.fromCharCode(65 + oi)}.</span>
                        <span className="text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-8 flex justify-between">
                    <Button onClick={handlePrev} variant="outline"><ArrowLeft className="w-4 h-4 ml-2" /> السابق</Button>
                    <Button onClick={handleNext} className="bg-slate-600 text-white">{currentPieceIndex < currentChapter.questions.length - 1 ? 'التالي' : 'إنهاء الاختبار'}<ChevronRight className="w-4 h-4 ml-2" /></Button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {activeHintQuestion && <HintModal question={activeHintQuestion} onClose={() => setActiveHintQuestion(null)} />}
    </div>
  );
}
