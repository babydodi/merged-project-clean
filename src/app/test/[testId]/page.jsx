'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Volume2, ChevronRight, Lightbulb, ArrowLeft, Tag } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import HintModal from '../../../components/HintModal';

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  // route param compatibility: try multiple names
  const idParam = params?.testId ?? params?.id ?? params?.test_id ?? null;

  // state
  const [test, setTest] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [loading, setLoading] = useState(true);

  // navigation
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPieceIndex, setCurrentPieceIndex] = useState(0);
  const [phase, setPhase] = useState('intro'); // for listening
  const [showResult, setShowResult] = useState(false);

  // answers & tracking
  const [answers, setAnswers] = useState({});
  const [answeredMap, setAnsweredMap] = useState({});
  const [markedMap, setMarkedMap] = useState({});
  const [validationError, setValidationError] = useState('');
  const [activeHintQuestion, setActiveHintQuestion] = useState(null);

  // results
  const [scores, setScores] = useState({ listening: 0, reading: 0, grammar: 0, total: 0, percentage: 0 });
  const [wrongAnswers, setWrongAnswers] = useState([]);

  const questionRefs = useRef({});

  useEffect(() => {
    initTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam]);

  async function initTest() {
    try {
      setLoading(true);
      console.log('[initTest] route param idParam:', idParam);

      if (!idParam) {
        console.warn('[initTest] no id param — skipping load');
        setLoading(false);
        return;
      }

      // create attempt (if user logged in, include user_id)
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData?.user || null;
      const payload = currentUser ? { test_id: idParam, user_id: currentUser.id } : { test_id: idParam };

      const { data: attempt, error: attemptErr } = await supabase
        .from('test_attempts')
        .insert(payload)
        .select()
        .single();

      console.log('[initTest] created attempt:', attempt, 'err:', attemptErr);
      if (attemptErr) throw attemptErr;
      setAttemptId(attempt.id);

      // fetch test row (try id then slug fallback)
      let testData = null;
      let testErr = null;
      const { data: t1, error: e1 } = await supabase.from('tests').select('*').eq('id', idParam).single();
      if (!e1 && t1) {
        testData = t1;
      } else {
        // try slug or title fallback (if you store slug)
        const { data: t2, error: e2 } = await supabase.from('tests').select('*').eq('slug', idParam).single();
        if (!e2 && t2) {
          testData = t2;
        } else {
          testErr = e1 || e2;
        }
      }
      console.log('[initTest] testData:', testData, 'err:', testErr);
      if (testErr && !testData) throw testErr || new Error('Test not found');

      setTest(testData);

      // fetch chapters (simple fetch)
      const { data: chaptersData, error: chErr } = await supabase
        .from('chapters')
        .select('id, type, title, idx, duration_seconds, test_id')
        .eq('test_id', testData.id)
        .order('idx', { ascending: true });

      console.log('[initTest] chaptersData raw:', { chaptersData, chErr });
      if (chErr) throw chErr;

      if (!chaptersData || chaptersData.length === 0) {
        console.warn('[initTest] no chapters for this test id');
        setChapters([]);
        setLoading(false);
        return;
      }

      // assemble each chapter with pieces/questions using separate queries (more robust)
      const assembled = [];
      for (const ch of chaptersData) {
        if (ch.type === 'listening') {
          const { data: pieces, error: lpErr } = await supabase
            .from('listening_pieces')
            .select('id, audio_url, transcript, idx')
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });

          if (lpErr) {
            console.error('[initTest] listening_pieces error for chapter', ch.id, lpErr);
            throw lpErr;
          }

          // fetch questions per piece
          for (const p of pieces || []) {
            const { data: q, error: qErr } = await supabase
              .from('listening_questions')
              .select('id, question_text, options, answer, hint, explanation, idx')
              .eq('listening_piece_id', p.id)
              .order('idx', { ascending: true });

            if (qErr) {
              console.error('[initTest] listening_questions error for piece', p.id, qErr);
              throw qErr;
            }
            p.listening_questions = q || [];
          }

          assembled.push({ ...ch, pieces: pieces || [] });
        } else if (ch.type === 'reading') {
          const { data: pieces, error: rpErr } = await supabase
            .from('reading_pieces')
            .select('id, passage_title, passage, idx')
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });

          if (rpErr) {
            console.error('[initTest] reading_pieces error for chapter', ch.id, rpErr);
            throw rpErr;
          }

          for (const p of pieces || []) {
            const { data: q, error: qErr } = await supabase
              .from('reading_questions')
              .select('id, question_text, options, answer, hint, explanation, idx, base_text, underlined_words, underlined_positions')
              .eq('reading_piece_id', p.id)
              .order('idx', { ascending: true });

            if (qErr) {
              console.error('[initTest] reading_questions error for piece', p.id, qErr);
              throw qErr;
            }
            p.reading_questions = q || [];
          }

          assembled.push({ ...ch, pieces: pieces || [] });
        } else if (ch.type === 'grammar') {
          const { data: questions, error: gErr } = await supabase
            .from('grammar_questions')
            .select('id, question_text, options, answer, hint, explanation, idx, category, base_text, underlined_words, underlined_positions')
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });

          if (gErr) {
            console.error('[initTest] grammar_questions error for chapter', ch.id, gErr);
            throw gErr;
          }

          assembled.push({ ...ch, questions: questions || [] });
        } else {
          // unknown type — push empty
          assembled.push({ ...ch });
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
      setCurrentChapterIndex(0);
      setCurrentPieceIndex(0);
      setPhase('intro');
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
        let selectedChoice = answers[q.id];
        if (Array.isArray(q.options) && typeof selectedChoice === 'number') {
          selectedChoice = q.options[selectedChoice];
        }
        rows.push({
          attempt_id: attemptId,
          question_id: q.id,
          question_type: chapterType,
          selected_choice: selectedChoice != null ? String(selectedChoice) : null,
          is_correct: selectedChoice != null ? String(selectedChoice).trim() === String(q.answer).trim() : false,
          answered_at: new Date().toISOString(),
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

  // scoring logic
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

  // navigation: next/prev
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

    if (currentChapter.type === 'listening') {
      const last = currentChapter.pieces.length - 1;
      if (currentPieceIndex < last) {
        setCurrentPieceIndex(i => i + 1);
        setPhase('intro');
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
        setCurrentChapterIndex(ci => ci + 1);
        setCurrentPieceIndex(0);
        setPhase('intro');
        return;
      }
    }

    if (currentChapter.type === 'reading') {
      const last = currentChapter.pieces.length - 1;
      if (currentPieceIndex < last) {
        setCurrentPieceIndex(i => i + 1);
        return;
      } else {
        const unansweredInChapter = getUnansweredInChapter(currentChapter);
        if (unansweredInChapter.length > 0) {
          const ok = window.confirm(`فيه ${unansweredInChapter.length} سؤال ما جاوبت عليهم في هذا الفصل. تبي تتابع وتروح للفصل التالي؟`);
          if (!ok) { goToQuestionInCurrent(unansweredInChapter[0]); return; }
        }
        setCurrentChapterIndex(ci => ci + 1);
        setCurrentPieceIndex(0);
        setPhase('intro');
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

  const [showMarkedPanel, setShowMarkedPanel] = useState(false);
  const markedList = useMemo(() => Object.keys(markedMap), [markedMap]);

  // render underlined helper
  function renderUnderlined(baseText, underlinedWords = null, underlinedPositions = null) {
    if (!baseText) return <span>{baseText}</span>;
    try {
      if (Array.isArray(underlinedPositions) && underlinedPositions.length > 0) {
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
        if (lastIndex < baseText.length) nodes.push(<span key="last">{baseText.slice(lastIndex)}</span>);
        return <span>{nodes}</span>;
      }

      if (Array.isArray(underlinedWords) && underlinedWords.length > 0) {
        let remaining = baseText;
        const nodes = [];
        while (remaining.length) {
          let foundIndex = -1;
          let foundWord = null;
          for (const w of underlinedWords) {
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

  if (loading) return <div className="p-8">جاري تحميل الاختبار...</div>;

  if (!currentChapter && !showResult) {
    return (
      <div className="p-8">
        لا توجد فصول متاحة لهذا الاختبار.
        <Button onClick={() => router.push('/dashboard')} variant="outline" className="mt-4">الرجوع للاختبارات</Button>
      </div>
    );
  }

  if (showResult) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{test?.title}</h1>

        <h2 className="text-xl font-semibold mb-2">النتيجة النهائية
