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
  }, [id]);

  const initTest = async () => {
    console.log('🔎 initTest() id =', id);
    try {
      if (!id) {
        console.error('Missing test id from route params');
        setLoading(false);
        return;
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();
      const payload = user ? { test_id: id, user_id: user.id } : { test_id: id };
      const { data: attempt, error: attemptErr } = await supabase
        .from('test_attempts')
        .insert(payload)
        .select()
        .single();
      if (attemptErr) throw attemptErr;
      setAttemptId(attempt.id);

      const { data: testData, error: testErr } = await supabase
        .from('tests')
        .select('*')
        .eq('id', id)
        .single();
      if (testErr) throw testErr;
      setTest(testData);

      const { data: chaptersData, error: chErr } = await supabase
        .from('chapters')
        .select('id, type, title, idx')
        .eq('test_id', id)
        .order('idx', { ascending: true });
      if (chErr) throw chErr;

      const assembled = [];
      for (const ch of chaptersData) {
        if (ch.type === 'listening') {
          const { data: pieces } = await supabase
            .from('listening_pieces')
            .select('id, audio_url, transcript, idx, listening_questions(*)')
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });
          assembled.push({ ...ch, pieces });
        } else if (ch.type === 'reading') {
          const { data: pieces } = await supabase
            .from('reading_pieces')
            .select('id, passage_title, passage, idx, reading_questions(*)')
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });
          assembled.push({ ...ch, pieces });
        } else if (ch.type === 'grammar') {
          const { data: questions } = await supabase
            .from('grammar_questions')
            .select('id, question_text, options, answer, hint, explanation, idx')
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });
          assembled.push({ ...ch, questions });
        }
      }
      setChapters(assembled);
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

  const savePieceAnswers = async chapterType => {
    if (!attemptId) return;
    let qList = [];
    if (chapterType === 'listening') {
      qList = currentChapter?.pieces?.[currentPieceIndex]?.listening_questions || [];
    } else if (chapterType === 'reading') {
      qList = currentChapter?.pieces?.[currentPieceIndex]?.reading_questions || [];
    } else if (chapterType === 'grammar') {
      const q = currentChapter?.questions?.[currentPieceIndex];
      if (q) qList = [q];
    }
    for (const q of qList) {
      if (answers[q.id] !== undefined) {
        await supabase.from('question_attempts').insert({
          attempt_id: attemptId,
          question_id: q.id,
          selected_choice: answers[q.id],
          question_type: chapterType
        });
      }
    }
  };

  const finalizeScoresAndWrongs = () => {
    const computeRatio = chapter => {
      let total = 0,
        correct = 0;
      if (!chapter) return 0;
      if (chapter.type === 'listening') {
        for (const p of chapter.pieces) {
          for (const q of p.listening_questions) {
            total++;
            if (answers[q.id] === q.answer) correct++;
          }
        }
      } else if (chapter.type === 'reading') {
        for (const p of chapter.pieces) {
          for (const q of p.reading_questions) {
            total++;
            if (answers[q.id] === q.answer) correct++;
          }
        }
      } else if (chapter.type === 'grammar') {
        for (const q of chapter.questions) {
          total++;
          if (answers[q.id] === q.answer) correct++;
        }
      }
      return total ? correct / total : 0;
    };

    const lScore = Math.round(computeRatio(chapters.find(c => c.type === 'listening')) * 20);
    const rScore = Math.round(computeRatio(chapters.find(c => c.type === 'reading')) * 40);
    const gScore = Math.round(computeRatio(chapters.find(c => c.type === 'grammar')) * 40);
    setScores({ listening: lScore, reading: rScore, grammar: gScore, total: lScore + rScore + gScore });

    const wrongs = [];
    chapters.forEach(ch => {
      if (ch.type === 'listening') {
        ch.pieces.forEach(p => p.listening_questions.forEach(q => {
          const sel = answers[q.id];
          if (sel !== undefined && sel !== q.answer) wrongs.push(q);
        }));
      } else if (ch.type === 'reading') {
        ch.pieces.forEach(p => p.reading_questions.forEach(q => {
          const sel = answers[q.id];
          if (sel !== undefined && sel !== q.answer) wrongs.push(q);
        }));
      } else if (ch.type === 'grammar') {
        ch.questions.forEach(q => {
          const sel = answers[q.id];
          if (sel !== undefined && sel !== q.answer) wrongs.push(q);
        });
      }
    });
    setWrongAnswers(wrongs);
  };

  const handleNext = async () => {
    if (!currentChapter) return;

    if (currentChapter.type === 'listening') {
      if (phase === 'intro') {
        setPhase('audio');
        return;
      }
      if (phase === 'audio') {
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
        finalizeScoresAndWrongs();
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
    return <ResultsPage scores={scores} wrongAnswers={wrongAnswers} answers={answers} router={router} />;
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
                    سيتم تشغيل المقطع مرة واحدة. استمع جيدًا ثم أجب على الأسئلة.
                  </p>
                  <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg">
                    ابدأ <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}
            {phase === 'audio' && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
                  <Volume2 className="w-12 h-12 text-blue-600 mx-auto mb-6" />
                  <audio autoPlay controls className="mb-6">
                    <source src={currentChapter.pieces[currentPieceIndex].audio_url} type="audio/mpeg" />
                  </audio>
                  <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5">
                    التالي <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}
            {phase === 'questions' && (
              <div className="max-w-4xl mx-auto space-y-6">
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
            {/* Passage */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-h-[70vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                {currentChapter.pieces[currentPieceIndex].passage_title}
              </h3>
              <div className="text-slate-700 leading-relaxed whitespace-pre-line">
                {currentChapter.pieces[currentPieceIndex].passage}
              </div>
            </div>

            {/* Questions */}
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
