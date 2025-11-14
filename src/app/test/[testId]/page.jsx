'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Volume2, ChevronRight, Lightbulb, Home } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import HintModal from '../../../components/HintModal';
import ResultsPage from '../../../components/ResultsPage';

export default function TestPage() {
  const { testId: id } = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [test, setTest] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPieceIndex, setCurrentPieceIndex] = useState(0);
  const [phase, setPhase] = useState('intro');
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState({});
  const [scores, setScores] = useState({ listening: 0, reading: 0, grammar: 0, total: 0 });
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [activeHintQuestion, setActiveHintQuestion] = useState(null);

  useEffect(() => {
    initTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const initTest = async () => {
    try {
      if (!id) {
        setLoading(false);
        return;
      }

      // إنشاء محاولة اختبار
      const { data: { user } } = await supabase.auth.getUser();
      const payload = user ? { test_id: id, user_id: user.id } : { test_id: id };
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
            .select('id, question_text, options, answer, hint, explanation, idx')
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });
          if (gErr) throw gErr;
          assembled.push({ ...ch, questions: questions || [] });
        }
      }

      // ترتيب الفصول النوعي ثم حسب idx
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
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentChapter = useMemo(
    () => chapters[currentChapterIndex],
    [chapters, currentChapterIndex]
  );

  const handleSelect = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // حفظ كل إجابة فوراً مع علامة الصح/الخطأ عبر upsert
  const savePieceAnswers = async chapterType => {
    if (!attemptId || !currentChapter) return;
    let qList = [];
    if (chapterType === 'listening') {
      qList = currentChapter?.pieces?.[currentPieceIndex]?.listening_questions || [];
    } else if (chapterType === 'reading') {
      qList = currentChapter?.pieces?.[currentPieceIndex]?.reading_questions || [];
    } else if (chapterType === 'grammar') {
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

    if (rows.length === 0) return;

    const { error } = await supabase
      .from('question_attempts')
      .upsert(rows, { onConflict: ['attempt_id', 'question_id'] });

    if (error) console.error('savePieceAnswers upsert error', error);
  };

  const finalizeScoresAndWrongs = async () => {
    if (!attemptId) return;

    // جلب كل محاولات الأسئلة لهذه المحاولة
    const { data: attemptsRows, error: attemptsErr } = await supabase
      .from('question_attempts')
      .select('question_id, question_type, selected_choice, is_correct')
      .eq('attempt_id', attemptId);
    if (attemptsErr) {
      console.error('fetch question_attempts error', attemptsErr);
      return;
    }

    const groups = { listening: [], reading: [], grammar: [] };
    attemptsRows.forEach(r => groups[r.question_type]?.push(r));

    const computeFromRows = rows => {
      const total = rows.length;
      const correct = rows.filter(r => r.is_correct).length;
      return { total, correct };
    };

    const l = computeFromRows(groups.listening || []);
    const r = computeFromRows(groups.reading || []);
    const g = computeFromRows(groups.grammar || []);

    const lScore = Math.round((l.total ? (l.correct / l.total) : 0) * 20);
    const rScore = Math.round((r.total ? (r.correct / r.total) : 0) * 40);
    const gScore = Math.round((g.total ? (g.correct / g.total) : 0) * 40);
    const totalScore = lScore + rScore + gScore;
    const totalQuestions = l.total + r.total + g.total;
    const totalCorrect = l.correct + r.correct + g.correct;
    const percentage = totalQuestions
      ? Math.round((totalCorrect / totalQuestions) * 100 * 100) / 100
      : 0;

    setScores({ listening: lScore, reading: rScore, grammar: gScore, total: totalScore });

    const wrongs = attemptsRows.filter(r => !r.is_correct).map(r => r.question_id);
    setWrongAnswers(wrongs);

    // حفظ user_results
    const { error: resultErr } = await supabase
      .from('user_results')
      .insert({
        attempt_id: attemptId,
        score: totalScore,
        total_questions: totalQuestions,
        percentage
      });
    if (resultErr) console.error('Error saving user result:', resultErr);

    // تحديث completed_at
    const { error: completeErr } = await supabase
      .from('test_attempts')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', attemptId);
    if (completeErr) console.error('Error updating attempt completion time:', completeErr);
  };

  const handleNext = async () => {
    if (!currentChapter) return;

    if (currentChapter.type === 'listening') {
      if (phase === 'intro') {
        setPhase('questions');
        return;
      }
      await savePieceAnswers('listening');
      const last = currentChapter.pieces.length - 1;
      if (currentPieceIndex < last) {
        setCurrentPieceIndex(i => i + 1);
        setPhase('intro');
      } else {
        setCurrentChapterIndex(ci => ci + 1);
        setCurrentPieceIndex(0);
        setPhase('intro');
      }
      return;
    }

    if (currentChapter.type === 'reading') {
      await savePieceAnswers('reading');
      const last = currentChapter.pieces.length - 1;
      if (currentPieceIndex < last) {
        setCurrentPieceIndex(i => i + 1);
      } else {
        setCurrentChapterIndex(ci => ci + 1);
        setCurrentPieceIndex(0);
        setPhase('intro');
      }
      return;
    }

    if (currentChapter.type === 'grammar') {
      await savePieceAnswers('grammar');
      const last = currentChapter.questions.length - 1;
      if (currentPieceIndex < last) {
        setCurrentPieceIndex(i => i + 1);
      } else {
        await finalizeScoresAndWrongs();
        setShowResult(true);
      }
      return;
    }
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
    return <ResultsPage scores={scores} wrongAnswers={wrongAnswers} answers={answers} router={router} attemptId={attemptId} />;
  }

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
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${((currentChapterIndex + 1) / chapters.length) * 100}%` }}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Listening Chapter */}
        {currentChapter?.type === 'listening' && (
          <div>
            {phase === 'intro' && (
              <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                  <Volume2 className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold text-slate-900 mb-4">قسم الاستماع</h2>
                  <p className="text-lg text-slate-600 mb-6">
                    اضغط ابدأ للانتقال مباشرة إلى الأسئلة الخاصة بالمقطع الحالي.
                  </p>
                  <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg">
                    ابدأ <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}
            {phase === 'questions' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <audio controls className="w-full">
                    <source src={currentChapter.pieces[currentPieceIndex].audio_url} type="audio/mpeg" />
                  </audio>
                </div>

                {currentChapter.pieces[currentPieceIndex].listening_questions.map((q, i) => (
                  <div key={q.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <p className="text-lg font-medium text-slate-900 flex-1">
                        <span className="text-blue-600 font-semibold mr-2">{i + 1}.</span>
                        {q.question_text}
                      </p>
                      <button onClick={() => setActiveHintQuestion(q)} className="text-slate-500 hover:text-blue-600">
                        <Lightbulb className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={`flex items-center p-4 border-2 rounded-md cursor-pointer ${
                            answers[q.id] === opt ? 'border-blue-600' : 'border-slate-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            value={opt}
                            onChange={() => handleSelect(q.id, opt)}
                            checked={answers[q.id] === opt}
                            className="w-4 h-4 text-blue-600 mr-3"
                          />
                          <span className="font-medium text-slate-700 mr-2">{String.fromCharCode(65 + oi)}.</span>
                          <span className="text-slate-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex justify-center mt-8">
                  <Button
                    onClick={handleNext}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
                  >
                    التالي <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reading Chapter */}
        {currentChapter?.type === 'reading' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-h-[70vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                {currentChapter.pieces[currentPieceIndex].passage_title}
              </h3>
              <div className="text-slate-700 leading-relaxed whitespace-pre-line">
                {currentChapter.pieces[currentPieceIndex].passage}
              </div>
            </div>

            <div className="space-y-6">
              {currentChapter.pieces[currentPieceIndex].reading_questions.map((q, qi) => (
                <div key={q.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <p className="text-lg font-medium text-slate-900 flex-1">
                      <span className="text-emerald-600 font-semibold mr-2">{qi + 1}.</span>
                      {q.question_text}
                    </p>
                    <button
                      onClick={() => setActiveHintQuestion(q)}
                      className="text-slate-500 hover:text-emerald-600 ml-4"
                    >
                      <Lightbulb className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className={`flex items-center p-4 border-2 rounded-md cursor-pointer ${
                          answers[q.id] === opt ? 'border-emerald-600' : 'border-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt}
                          onChange={() => handleSelect(q.id, opt)}
                          checked={answers[q.id] === opt}
                          className="w-4 h-4 text-emerald-600 mr-3"
                        />
                        <span className="font-medium text-slate-700 mr-2">
                          {String.fromCharCode(65 + oi)}.
                        </span>
                        <span className="text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-center mt-6">
                <Button
                  onClick={handleNext}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-lg"
                >
                  التالي <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Grammar Chapter */}
        {currentChapter?.type === 'grammar' && (
          <div className="max-w-3xl mx-auto">
            {(() => {
              const q = currentChapter.questions[currentPieceIndex];
              if (!q) return null;
              return (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                  <div className="flex items-start justify-between mb-6">
                    <p className="text-xl font-medium text-slate-900 flex-1">
                      <span className="text-slate-600 font-semibold mr-2">
                        سؤال {currentPieceIndex + 1} من {currentChapter.questions.length}
                      </span>
                    </p>
                    <button
                      onClick={() => setActiveHintQuestion(q)}
                      className="text-slate-500 hover:text-slate-700 ml-4"
                    >
                      <Lightbulb className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-lg text-slate-900 mb-6 leading-relaxed">
                    {q.question_text}
                  </p>
                  <div className="space-y-3">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className={`flex items-center p-4 border-2 rounded-md cursor-pointer ${
                          answers[q.id] === opt ? 'border-slate-600' : 'border-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt}
                          onChange={() => handleSelect(q.id, opt)}
                          checked={answers[q.id] === opt}
                          className="w-4 h-4 text-slate-600 mr-3"
                        />
                        <span className="font-medium text-slate-700 mr-2">
                          {String.fromCharCode(65 + oi)}.
                        </span>
                        <span className="text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-8 flex justify-center">
                    <Button
                      onClick={handleNext}
                      className="bg-slate-600 hover:bg-slate-700 text-white px-8 py-3 text-lg"
                    >
                      {currentPieceIndex < currentChapter.questions.length - 1
                        ? 'التالي'
                        : 'إنهاء الاختبار'}
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {activeHintQuestion && (
        <HintModal question={activeHintQuestion} onClose={() => setActiveHintQuestion(null)} />
      )}
    </div>
  );
}
