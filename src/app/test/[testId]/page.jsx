'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Volume2, ChevronRight, Lightbulb, ArrowLeft, Tag } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import HintModal from '../../../components/HintModal';

export default function TestPage() {
  const { testId: id } = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  // state
  const [test, setTest] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [loading, setLoading] = useState(true);

  // navigation
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPieceIndex, setCurrentPieceIndex] = useState(0);
  const [phase, setPhase] = useState('intro'); // for listening: 'intro' | 'questions'
  const [showResult, setShowResult] = useState(false);

  // answers & tracking
  const [answers, setAnswers] = useState({}); // { questionId: selectedValue }
  const [answeredMap, setAnsweredMap] = useState({}); // qid -> true
  const [markedMap, setMarkedMap] = useState({}); // qid -> true (marked for review)
  const [validationError, setValidationError] = useState('');
  const [activeHintQuestion, setActiveHintQuestion] = useState(null);

  // results
  const [scores, setScores] = useState({ listening: 0, reading: 0, grammar: 0, total: 0, percentage: 0 });
  const [wrongAnswers, setWrongAnswers] = useState([]);

  // show intro once per chapter (prevents re-showing when moving between pieces)
  const [seenIntroMap, setSeenIntroMap] = useState({}); // { chapterId: true }

  const questionRefs = useRef({});

  useEffect(() => {
    initTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function initTest() {
    try {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);

      // create attempt (if user logged in, include user_id)
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

      const { data: testData, error: testErr } = await supabase
        .from('tests')
        .select('*')
        .eq('id', id)
        .single();

      if (testErr) throw testErr;
      setTest(testData);

      // fetch chapters and their nested pieces/questions including extra fields
      const { data: chaptersData, error: chErr } = await supabase
        .from('chapters')
        .select('id, type, title, idx, duration_seconds')
        .eq('test_id', id)
        .order('idx', { ascending: true });

      if (chErr) throw chErr;

      const assembled = [];

      for (const ch of chaptersData || []) {
        if (ch.type === 'listening') {
          const { data: pieces, error: lpErr } = await supabase
            .from('listening_pieces')
            .select(
              `id, audio_url, transcript, idx,
              listening_questions (
                id, question_text, options, answer, hint, explanation, idx, base_text, underlined_words, underlined_positions
              )`
            )
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });

          if (lpErr) throw lpErr;
          assembled.push({ ...ch, pieces: pieces || [] });
        } else if (ch.type === 'reading') {
          const { data: pieces, error: rpErr } = await supabase
            .from('reading_pieces')
            .select(
              `id, passage_title, passage, idx,
              reading_questions (
                id, question_text, options, answer, hint, explanation, idx, base_text, underlined_words, underlined_positions
              )`
            )
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });

          if (rpErr) throw rpErr;
          assembled.push({ ...ch, pieces: pieces || [] });
        } else if (ch.type === 'grammar') {
          const { data: questions, error: gErr } = await supabase
            .from('grammar_questions')
            .select('id, question_text, options, answer, hint, explanation, idx, category, base_text, underlined_words, underlined_positions')
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });

          if (gErr) throw gErr;
          assembled.push({ ...ch, questions: questions || [] });
        }
      }

      // optional order to show sections in specific sequence
      const order = { listening: 0, reading: 1, grammar: 2 };
      assembled.sort((a, b) => {
        const t = (order[a.type] ?? 99) - (order[b.type] ?? 99);
        if (t !== 0) return t;
        return (a.idx ?? 0) - (b.idx ?? 0);
      });

      setChapters(assembled);
      setSeenIntroMap({}); // reset seen map on new load
      setCurrentChapterIndex(0);
      setCurrentPieceIndex(0);
      // showIntroOnceForChapter will set phase appropriately via effect below
      setShowResult(false);
      setAnswers({});
      setAnsweredMap({});
      setMarkedMap({});
      setValidationError('');
      setWrongAnswers([]);
      setScores({ listening: 0, reading: 0, grammar: 0, total: 0, percentage: 0 });
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setLoading(false);
    }
  }

  const currentChapter = useMemo(() => chapters[currentChapterIndex], [chapters, currentChapterIndex]);
  const currentPiece = useMemo(() => {
    if (!currentChapter) return null;
    if (currentChapter.type === 'grammar') return null;
    return currentChapter.pieces?.[currentPieceIndex] || null;
  }, [currentChapter, currentPieceIndex]);

  // show intro once per chapter helper
  function showIntroOnceForChapter(chapter) {
    if (!chapter) {
      setPhase('questions');
      return;
    }
    if (!seenIntroMap[chapter.id]) {
      setSeenIntroMap(prev => ({ ...prev, [chapter.id]: true }));
      setPhase('intro');
    } else {
      setPhase('questions');
    }
  }

  // when chapter changes, decide phase
  useEffect(() => {
    const ch = chapters[currentChapterIndex];
    showIntroOnceForChapter(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapterIndex, chapters]);

  // save answers of current piece/chapter into question_attempts
  const savePieceAnswers = async (chapterType) => {
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

        // normalize: if options are array and selected is index number, convert to option string if needed
        let selectedChoice = selected;
        if (Array.isArray(q.options) && typeof selected === 'number') {
          selectedChoice = q.options[selected];
        }

        rows.push({
          attempt_id: attemptId,
          question_id: q.id,
          question_type: chapterType,
          selected_choice: selectedChoice != null ? String(selectedChoice) : null,
          is_correct: selectedChoice != null ? String(selectedChoice).trim() === String(q.answer).trim() : false,
          answered_at: new Date().toISOString(),
        });

        // mark answered in UI
        setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
      }
    }

    if (rows.length === 0) return [];

    const { data, error } = await supabase
      .from('question_attempts')
      .upsert(rows, { onConflict: ['attempt_id', 'question_id'] });

    if (error) console.error('savePieceAnswers upsert error', error);
    return data || [];
  };

  const handleSelect = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setAnsweredMap(prev => ({ ...prev, [questionId]: true }));
  };

  const toggleMark = (questionId) => {
    setMarkedMap(prev => {
      const next = { ...prev };
      if (next[questionId]) delete next[questionId];
      else next[questionId] = true;
      return next;
    });
  };

  const getUnansweredInCurrent = () => {
    const qIds = [];
    if (!currentChapter) return qIds;
    if (currentChapter.type === 'listening') {
      const qs = currentChapter.pieces[currentPieceIndex]?.listening_questions || [];
      qs.forEach(q => {
        if (!answeredMap[q.id]) qIds.push(q.id);
      });
    } else if (currentChapter.type === 'reading') {
      const qs = currentChapter.pieces[currentPieceIndex]?.reading_questions || [];
      qs.forEach(q => {
        if (!answeredMap[q.id]) qIds.push(q.id);
      });
    } else if (currentChapter.type === 'grammar') {
      const q = currentChapter.questions[currentPieceIndex];
      if (q && !answeredMap[q.id]) qIds.push(q.id);
    }
    return qIds;
  };

  // New/updated scoring logic (keeps your weights and category handling)
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
    let grammarMeta = {};
    if (grammarQuestionIds.length) {
      const { data: gQs = [], error: gErr } = await supabase
        .from('grammar_questions')
        .select('id, category, answer')
        .in('id', grammarQuestionIds);

      if (gErr) console.error('fetch grammar metadata error', gErr);
      (gQs || []).forEach(q => { grammarMeta[q.id] = q; });
    }

    // Count totals & corrects
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
        const isVocab = meta ? (String(meta.category).toLowerCase() === 'vocab' || String(meta.category).toLowerCase() === 'vocabulary') : false;
        if (isVocab) {
          stats.grammar.vocab_total += 1;
          if (r.is_correct) stats.grammar.vocab_correct += 1;
        }
      }
    }

    const weights = { listening: 20, reading: 40, grammar: 40 };
    const grammarVocabWeight = weights.grammar * 0.10;
    const grammarNonVocabWeight = weights.grammar - grammarVocabWeight;
    const pct = (correct, total) => (total ? (correct / total) : 0);

    const listeningScore = Math.round(pct(stats.listening.correct, stats.listening.total) * weights.listening);
    const readingScore = Math.round(pct(stats.reading.correct, stats.reading.total) * weights.reading);

    // grammar split into vocab and non-vocab
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

    // save user_results once
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

  // navigation: next/prev (uses savePieceAnswers and finalize when end)
  const handleNext = async () => {
    if (!currentChapter) return;

    if (currentChapter.type === 'listening') {
      if (phase === 'intro') { setPhase('questions'); return; }
      await savePieceAnswers('listening');
    } else if (currentChapter.type === 'reading') {
      await savePieceAnswers('reading');
    } else if (currentChapter.type === 'grammar') {
      await savePieceAnswers('grammar');
    }

    setValidationError('');

    // navigate within chapter or to next chapter
    if (currentChapter.type === 'listening') {
      const last = currentChapter.pieces.length - 1;
      if (currentPieceIndex < last) {
        // move to next piece in same chapter — do not show intro again
        setCurrentPieceIndex(i => i + 1);
        setPhase('questions');
        return;
      } else {
        const unansweredInChapter = getUnansweredInChapter(currentChapter);
        if (unansweredInChapter.length > 0) {
          const ok = window.confirm(`فيه ${unansweredInChapter.length} سؤال ما جاوبت عليهم في هذا الفصل. تبي تتابع وتروح للفصل التالي؟`);
          if (!ok) {
            goToQuestionInCurrent(unansweredInChapter[0]);
            return;
          }
        }
        // move to next chapter, intro shown once for that chapter by effect
        setCurrentChapterIndex(ci => ci + 1);
        setCurrentPieceIndex(0);
        return;
      }
    }

    if (currentChapter.type === 'reading') {
      const last = currentChapter.pieces.length - 1;
      if (currentPieceIndex < last) {
        setCurrentPieceIndex(i => i + 1);
        // reading pieces: no intro behavior changes
        return;
      } else {
        const unansweredInChapter = getUnansweredInChapter(currentChapter);
        if (unansweredInChapter.length > 0) {
          const ok = window.confirm(`فيه ${unansweredInChapter.length} سؤال ما جاوبت عليهم في هذا الفصل. تبي تتابع وتروح للفصل التالي؟`);
          if (!ok) { goToQuestionInCurrent(unansweredInChapter[0]); return; }
        }
        setCurrentChapterIndex(ci => ci + 1);
        setCurrentPieceIndex(0);
        return;
      }
    }

    if (currentChapter.type === 'grammar') {
      const last = currentChapter.questions.length - 1;
      if (currentPieceIndex < last) {
        setCurrentPieceIndex(i => i + 1);
        return;
      } else {
        const unansweredInChapter = getUnansweredInChapter(currentChapter);
        if (unansweredInChapter.length > 0) {
          const ok = window.confirm(`فيه ${unansweredInChapter.length} سؤال ما جاوبت عليهم في هذا الفصل. تبي تتابع وتنهي الانتقال؟`);
          if (!ok) { goToQuestionInCurrent(unansweredInChapter[0]); return; }
        }
        // finish exam
        await finalizeScoresAndWrongs();
        setShowResult(true);
        return;
      }
    }
  };

  // helper: collect unanswered qids across the entire chapter (all pieces/questions)
  const getUnansweredInChapter = (chapter) => {
    const qIds = [];
    if (!chapter) return qIds;
    if (chapter.type === 'listening') {
      for (const p of (chapter.pieces || [])) {
        for (const q of (p.listening_questions || [])) {
          if (!answeredMap[q.id]) qIds.push(q.id);
        }
      }
    } else if (chapter.type === 'reading') {
      for (const p of (chapter.pieces || [])) {
        for (const q of (p.reading_questions || [])) {
          if (!answeredMap[q.id]) qIds.push(q.id);
        }
      }
    } else if (chapter.type === 'grammar') {
      for (const q of (chapter.questions || [])) {
        if (!answeredMap[q.id]) qIds.push(q.id);
      }
    }
    return qIds;
  };

  const handlePrev = async () => {
    if (!currentChapter) return;
    if (currentChapter.type === 'listening') {
      if (phase === 'questions' && currentPieceIndex === 0) { 
        // if at first piece and in questions, go back to intro of this chapter (if shown once before)
        if (!seenIntroMap[currentChapter.id]) setPhase('intro');
        else setPhase('intro'); // show intro again if user wants; you can change this behaviour
        return;
      }
      if (phase === 'questions') {
        await savePieceAnswers('listening');
      }
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

  const [showMarkedPanel, setShowMarkedPanel] = useState(false);
  const markedList = useMemo(() => Object.keys(markedMap), [markedMap]);

  // utility: render underlined words using underlined_words or underlined_positions
  function renderUnderlined(baseText, underlinedWords = null, underlinedPositions = null) {
    if (!baseText) return <span />;
    try {
      if (Array.isArray(underlinedPositions) && underlinedPositions.length > 0) {
        // build nodes by positions (positions: array of {start, end})
        const nodes = [];
        let lastIndex = 0;
        underlinedPositions.sort((a, b) => a.start - b.start);
        for (let i = 0; i < underlinedPositions.length; i++) {
          const pos = underlinedPositions[i];
          const start = Math.max(0, pos.start);
          const end = Math.min(baseText.length, pos.end);
          if (start > lastIndex) nodes.push(<span key={`t-${i}`}>{baseText.slice(lastIndex, start)}</span>);
          nodes.push(<u key={`u-${i}`}>{baseText.slice(start, end)}</u>);
          lastIndex = end;
        }
        if (lastIndex < baseText.length) nodes.push(<span key={`rest-${lastIndex}`}>{baseText.slice(lastIndex)}</span>);
        return <span>{nodes}</span>;
      }

      if (Array.isArray(underlinedWords) && underlinedWords.length > 0) {
        // underline first occurrences of provided words (case-insensitive)
        let remaining = baseText;
        const nodes = [];
        while (remaining.length) {
          let foundIndex = -1;
          let foundWord = null;
          for (const w of underlinedWords) {
            if (!w) continue;
            const regex = new RegExp(`\\b${escapeRegExp(w)}\\b`, 'i');
            const m = regex.exec(remaining);
            if (m && (foundIndex === -1 || m.index < foundIndex)) {
              foundIndex = m.index;
              foundWord = m[0];
            }
          }
          if (foundIndex === -1) {
            nodes.push(<span key={nodes.length}>{remaining}</span>);
            break;
          }
          if (foundIndex > 0) nodes.push(<span key={nodes.length}>{remaining.slice(0, foundIndex)}</span>);
          nodes.push(<u key={nodes.length} data-uline={foundWord}>{remaining.substr(foundIndex, foundWord.length)}</u>);
          remaining = remaining.slice(foundIndex + foundWord.length);
        }
        return <span>{nodes}</span>;
      }

      return <span>{baseText}</span>;
    } catch (e) {
      return <span>{baseText}</span>;
    }
  }

  function escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        جاري تحميل الاختبار...
      </div>
    );
  }

  if (!currentChapter && !showResult) {
    return (
      <div className="p-6">
        لا توجد فصول متاحة لهذا الاختبار.
        <Button onClick={() => router.push('/dashboard')} variant="outline" className="mt-4">الرجوع للاختبارات</Button>
      </div>
    );
  }

  if (showResult) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4"> {test?.title} </h1>

        <h2 className="text-lg font-semibold mt-4">النتيجة النهائية</h2>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-slate-500">الاستماع</div>
            <div className="text-xl font-bold">{scores.listening} / 20</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-slate-500">القراءة</div>
            <div className="text-xl font-bold">{scores.reading} / 40</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-slate-500">القواعد</div>
            <div className="text-xl font-bold">{scores.grammar} / 40</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-slate-500">المجموع</div>
            <div className="text-xl font-bold">{scores.total} / 100</div>
            <div className="text-sm text-slate-500 mt-2">النسبة</div>
            <div className="text-lg font-semibold">{scores.percentage}%</div>
          </div>
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

        <div className="mt-6 flex gap-3">
          <Button onClick={() => router.push('/dashboard')} variant="outline">الرئيسية</Button>
          <Button onClick={goToReview}>راجع محاولتي</Button>
        </div>
      </div>
    );
  }

  // --- main render for current chapter/questions ---
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4"> {test?.title} </h1>
      <h2 className="text-lg font-semibold mb-3">{currentChapter?.title}</h2>

      <div className="bg-slate-200 h-1.5 mb-6">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${((currentChapterIndex + 1) / Math.max(chapters.length, 1)) * 100}%` }}
        />
      </div>

      <main>
        {validationError && <div className="mb-4 p-3 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">{validationError}</div>}

        {/* Listening */}
        {currentChapter?.type === 'listening' && (
          <div>
            {phase === 'intro' && (
              <div className="max-w-3xl mx-auto mb-6">
                <div className="bg-white rounded-lg p-8 text-center shadow-sm">
                  <Volume2 className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">قسم الاستماع</h2>
                  <p className="text-slate-600 mb-4">اضغط ابدأ للاستماع ثم الإجابة عن أسئلة المقطع.</p>

                  <div className="flex justify-center gap-3">
                    <Button onClick={() => setPhase('questions')} className="bg-blue-600 text-white">ابدأ</Button>
                    {/* skip no longer moves to next chapter; it simply proceeds to questions for this chapter */}
                    <Button onClick={() => setPhase('questions')} variant="outline">تخطي</Button>
                  </div>
                </div>
              </div>
            )}

            {phase === 'questions' && currentPiece && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <audio controls className="w-full" preload="none">
                    <source src={currentPiece.audio_url} type="audio/mpeg" />
                    متصفحك لا يدعم عناصر الصوت.
                  </audio>
                </div>

                <div className="flex flex-wrap gap-2">
                  {currentPiece.listening_questions.map((q, qi) => {
                    const answered = !!answeredMap[q.id];
                    const marked = !!markedMap[q.id];
                    const cls = answered ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700';
                    return (
                      <button key={q.id} onClick={() => goToQuestionInCurrent(q.id)} className={`px-2 py-1 rounded ${cls}`}>
                        {qi + 1}{marked && <span className="ml-2 text-xs">★</span>}
                      </button>
                    );
                  })}
                </div>

                {currentPiece.listening_questions.map((q, i) => (
                  <div key={q.id} id={`q-${q.id}`} className="bg-white rounded-lg p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-medium"><span className="text-blue-600 mr-2 font-semibold">{i + 1}.</span>{q.question_text}</p>
                        <button type="button" onClick={() => toggleMark(q.id)} title="علامة للرجوع" className="text-yellow-600 ml-3">
                          <Tag className={`w-4 h-4 ${markedMap[q.id] ? 'text-yellow-600' : 'text-slate-300'}`} />
                        </button>
                      </div>
                      <button onClick={() => setActiveHintQuestion(q)} className="text-slate-500 hover:text-blue-600"><Lightbulb className="w-5 h-5" /></button>
                    </div>

                    {/* render base_text with underlines if present */}
                    {q.base_text && (
                      <div className="mb-3 text-slate-700">
                        {renderUnderlined(q.base_text, q.underlined_words, q.underlined_positions)}
                      </div>
                    )}

                    <div className="space-y-2">
                      {q.options?.map((opt, oi) => (
                        <label key={oi} className={`flex items-center p-4 border-2 rounded-md cursor-pointer ${answers[q.id] === opt ? 'border-blue-600' : 'border-slate-200'}`}>
                          <input type="radio" name={`q-${q.id}`} value={opt} onChange={() => handleSelect(q.id, opt)} checked={answers[q.id] === opt} className="w-4 h-4 text-blue-600 mr-3" />
                          <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                          <span>{opt}</span>
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
            <div className="bg-white rounded-lg p-6 shadow-sm max-h-[70vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">{currentPiece.passage_title}</h3>
              <div className="whitespace-pre-line leading-relaxed text-slate-700">{currentPiece.passage}</div>
            </div>

            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {currentPiece.reading_questions.map((q, idx) => {
                  const answered = !!answeredMap[q.id];
                  const marked = !!markedMap[q.id];
                  const cls = answered ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700';
                  return (<button key={q.id} onClick={() => goToQuestionInCurrent(q.id)} className={`px-2 py-1 rounded ${cls}`}>{idx + 1}{marked && <span className="ml-2 text-xs">★</span>}</button>);
                })}
              </div>

              {currentPiece.reading_questions.map((q, qi) => (
                <div key={q.id} id={`q-${q.id}`} className="bg-white rounded-lg p-6 shadow-sm mb-3">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-medium"><span className="text-emerald-600 mr-2 font-semibold">{qi + 1}.</span>{q.question_text}</p>
                      <button type="button" onClick={() => toggleMark(q.id)} title="علامة للرجوع" className="text-yellow-600 ml-3">
                        <Tag className={`w-4 h-4 ${markedMap[q.id] ? 'text-yellow-600' : 'text-slate-300'}`} />
                      </button>
                    </div>
                    <button onClick={() => setActiveHintQuestion(q)} className="text-slate-500 hover:text-emerald-600 ml-4"><Lightbulb className="w-5 h-5" /></button>
                  </div>

                  {q.base_text && <div className="mb-3 text-slate-700">{renderUnderlined(q.base_text, q.underlined_words, q.underlined_positions)}</div>}

                  <div className="space-y-2">
                    {q.options?.map((opt, oi) => (
                      <label key={oi} className={`flex items-center p-4 border-2 rounded-md cursor-pointer ${answers[q.id] === opt ? 'border-emerald-600' : 'border-slate-200'}`}>
                        <input type="radio" name={`q-${q.id}`} value={opt} onChange={() => handleSelect(q.id, opt)} checked={answers[q.id] === opt} className="w-4 h-4 text-emerald-600 mr-3" />
                        <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                        <span>{opt}</span>
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
              const marked = !!markedMap[q.id];
              return (
                <div className="bg-white rounded-lg p-8 shadow-sm">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <p className="text-xl font-medium"><span className="text-slate-600 font-semibold mr-2">سؤال {currentPieceIndex + 1} من {currentChapter.questions.length}</span></p>
                      <button type="button" onClick={() => toggleMark(q.id)} className="text-yellow-600 ml-3" title="علامة للرجوع">
                        <Tag className={`w-4 h-4 ${marked ? 'text-yellow-600' : 'text-slate-300'}`} />
                      </button>
                    </div>
                    <button onClick={() => setActiveHintQuestion(q)} className="text-slate-500 hover:text-slate-700 ml-4"><Lightbulb className="w-5 h-5" /></button>
                  </div>

                  {q.base_text && <div className="mb-4 text-slate-700">{renderUnderlined(q.base_text, q.underlined_words, q.underlined_positions)}</div>}

                  <p className="text-lg text-slate-900 mb-6 leading-relaxed">{q.question_text}</p>

                  <div className="space-y-3">
                    {q.options?.map((opt, oi) => (
                      <label key={oi} className={`flex items-center p-4 border-2 rounded-md cursor-pointer ${answers[q.id] === opt ? 'border-slate-600' : 'border-slate-200'}`}>
                        <input type="radio" name={`q-${q.id}`} value={opt} onChange={() => handleSelect(q.id, opt)} checked={answers[q.id] === opt} className="w-4 h-4 text-slate-600 mr-3" />
                        <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-8 flex justify-between">
                    <Button onClick={handlePrev} variant="outline"><ArrowLeft className="w-4 h-4 ml-2" /> السابق</Button>
                    <Button onClick={handleNext} className="bg-slate-600 text-white">{currentPieceIndex < currentChapter.questions.length - 1 ? 'التالي' : 'إنهاء الاختبار'} <ChevronRight className="w-4 h-4 ml-2" /></Button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* Floating Marked */}
      <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 60 }}>
        <button onClick={() => setShowMarkedPanel(prev => !prev)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2" title="المسودات">
          <Tag className="w-5 h-5" />
          <span className="font-semibold">{markedList.length}</span>
        </button>

        {showMarkedPanel && (
          <div className="mt-3 w-80 bg-white border rounded shadow p-3 text-right">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">الأسئلة الموسومة</div>
              <button onClick={() => setShowMarkedPanel(false)} className="text-sm text-slate-500">إغلاق</button>
            </div>

            {markedList.length === 0 ? (
              <div className="text-sm text-slate-500">ما فيه علامات</div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-auto">
                {markedList.map((qid, idx) => (
                  <div key={qid} className="flex items-center justify-between border-b pb-2">
                    <div className="text-sm">سؤال {idx + 1}</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => { setShowMarkedPanel(false); goToQuestionInCurrent(qid); }}>اذهب</Button>
                      <Button size="sm" variant="outline" onClick={() => toggleMark(qid)}>إزالة</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {activeHintQuestion && <HintModal question={activeHintQuestion} onClose={() => setActiveHintQuestion(null)} />}
    </div>
  );
}
