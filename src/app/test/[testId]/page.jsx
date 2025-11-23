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

  const [test, setTest] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPieceIndex, setCurrentPieceIndex] = useState(0);
  const [phase, setPhase] = useState('intro');
  const [showResult, setShowResult] = useState(false);

  const [answers, setAnswers] = useState({});
  const [answeredMap, setAnsweredMap] = useState({});
  const [markedMap, setMarkedMap] = useState({});
  const [validationError, setValidationError] = useState('');
  const [activeHintQuestion, setActiveHintQuestion] = useState(null);

  const [scores, setScores] = useState({ listening: 0, reading: 0, grammar: 0, total: 0, percentage: 0 });
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [seenIntroMap, setSeenIntroMap] = useState({});

  const questionRefs = useRef({});
  const playedMapRef = useRef({}); // منع إعادة تشغيل الصوت

  useEffect(() => { initTest(); /* eslint-disable-next-line */ }, [id]);

  async function initTest() {
    try {
      if (!id) { setLoading(false); return; }
      setLoading(true);

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
                id, question_text, options, answer, hint, explanation, idx
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

          const normalizedPieces = (pieces || []).map(p => {
            const piece = { ...p };
            if (piece.passage && typeof piece.passage === 'string') {
              const parts = piece.passage.split(/\n{2,}/).map(str => str.trim()).filter(Boolean);
              const paragraphs = parts.map(pt => {
                const m = pt.match(/^\s*(\d+)\.\s*(.*)$/s);
                if (m) return { num: Number(m[1]), text: m[2] };
                return null;
              }).filter(Boolean);
              if (paragraphs.length) piece.passage_paragraphs = paragraphs;
            }
            return piece;
          });

          assembled.push({ ...ch, pieces: normalizedPieces });
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

      // دمج فصول القراءة المتتالية
      function mergeConsecutiveReadingChapters(list) {
        if (!Array.isArray(list) || list.length === 0) return list;
        const out = [];
        for (const ch of list) {
          if (ch.type === 'reading') {
            const last = out.length ? out[out.length - 1] : null;
            if (last && last.type === 'reading') {
              last.pieces = [...(last.pieces || []), ...(ch.pieces || [])];
              continue;
            }
          }
          out.push(ch);
        }
        return out;
      }

      const order = { listening: 0, reading: 1, grammar: 2 };
      assembled.sort((a, b) => {
        const t = (order[a.type] ?? 99) - (order[b.type] ?? 99);
        if (t !== 0) return t;
        return (a.idx ?? 0) - (b.idx ?? 0);
      });

      const merged = mergeConsecutiveReadingChapters(assembled);
      setChapters(merged);

      setSeenIntroMap({});
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

  function showIntroOnceForChapter(chapter) {
    if (!chapter) { setPhase('questions'); return; }
    if (!seenIntroMap[chapter.id]) {
      setSeenIntroMap(prev => ({ ...prev, [chapter.id]: true }));
      setPhase('intro');
    } else setPhase('questions');
  }
  useEffect(() => { const ch = chapters[currentChapterIndex]; showIntroOnceForChapter(ch); /* eslint-disable-next-line */ }, [currentChapterIndex, chapters]);

  const savePieceAnswers = async (chapterType) => {
    if (!attemptId || !currentChapter) return [];
    let qList = [];
    if (chapterType === 'listening') qList = currentChapter?.pieces?.[currentPieceIndex]?.listening_questions || [];
    else if (chapterType === 'reading') qList = currentChapter?.pieces?.[currentPieceIndex]?.reading_questions || [];
    else if (chapterType === 'grammar') { const q = currentChapter?.questions?.[currentPieceIndex]; if (q) qList = [q]; }

    const rows = [];
    for (const q of qList) {
      if (answers[q.id] !== undefined) {
        const selected = answers[q.id];
        let selectedChoice = selected;
        if (Array.isArray(q.options) && typeof selected === 'number') selectedChoice = q.options[selected];
        rows.push({
          attempt_id: attemptId,
          question_id: q.id,
          question_type: chapterType,
          selected_choice: selectedChoice != null ? String(selectedChoice) : null,
          is_correct: selectedChoice != null ? String(selectedChoice).trim() === String(q.answer).trim() : false,
          answered_at: new Date().toISOString(),
        });
        setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
      }
    }
    if (rows.length === 0) return [];
    const { data, error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] });
    if (error) console.error('savePieceAnswers upsert error', error);
    return data || [];
  };

  const handleSelect = (questionId, value) => { setAnswers(prev => ({ ...prev, [questionId]: value })); setAnsweredMap(prev => ({ ...prev, [questionId]: true })); };
  const toggleMark = (questionId) => { setMarkedMap(prev => { const next = { ...prev }; if (next[questionId]) delete next[questionId]; else next[questionId] = true; return next; }); };

  const goToQuestionInCurrent = (questionId) => { const el = document.getElementById(`q-${questionId}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  const getUnansweredInChapter = (chapter) => {
    const qIds = [];
    if (!chapter) return qIds;
    if (chapter.type === 'listening') {
      for (const p of (chapter.pieces || [])) for (const q of (p.listening_questions || [])) if (!answeredMap[q.id]) qIds.push(q.id);
    } else if (chapter.type === 'reading') {
      for (const p of (chapter.pieces || [])) for (const q of (p.reading_questions || [])) if (!answeredMap[q.id]) qIds.push(q.id);
    } else if (chapter.type === 'grammar') {
      for (const q of (chapter.questions || [])) if (!answeredMap[q.id]) qIds.push(q.id);
    }
    return qIds;
  };

  const finalizeScoresAndWrongs = async () => {
    if (!attemptId) return;
    const { data: attemptsRows = [], error: attemptsErr } = await supabase
      .from('question_attempts')
      .select('question_id, question_type, selected_choice, is_correct')
      .eq('attempt_id', attemptId);
    if (attemptsErr) { console.error('fetch question_attempts error', attemptsErr); return; }

    const stats = { listening: { total: 0, correct: 0 }, reading: { total: 0, correct: 0 }, grammar: { total: 0, correct: 0, vocab_total: 0, vocab_correct: 0 } };

    const grammarQuestionIds = attemptsRows.filter(r => r.question_type === 'grammar').map(r => r.question_id);
    let grammarMeta = {};
    if (grammarQuestionIds.length) {
      const { data: gQs = [], error: gErr } = await supabase.from('grammar_questions').select('id, category, answer').in('id', grammarQuestionIds);
      if (gErr) console.error('fetch grammar metadata error', gErr);
      (gQs || []).forEach(q => { grammarMeta[q.id] = q; });
    }

    for (const r of attemptsRows) {
      if (r.question_type === 'listening') { stats.listening.total += 1; if (r.is_correct) stats.listening.correct += 1; }
      else if (r.question_type === 'reading') { stats.reading.total += 1; if (r.is_correct) stats.reading.correct += 1; }
      else if (r.question_type === 'grammar') {
        stats.grammar.total += 1; if (r.is_correct) stats.grammar.correct += 1;
        const meta = grammarMeta[r.question_id];
        const isVocab = meta ? (String(meta.category).toLowerCase() === 'vocab' || String(meta.category).toLowerCase() === 'vocabulary') : false;
        if (isVocab) { stats.grammar.vocab_total += 1; if (r.is_correct) stats.grammar.vocab_correct += 1; }
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

    const { data: existing = [], error: exErr } = await supabase.from('user_results').select('id').eq('attempt_id', attemptId).limit(1);
    if (exErr) console.error('check existing user_results', exErr);
    if (!existing || existing.length === 0) {
      const { error: resultErr } = await supabase.from('user_results').insert({ attempt_id: attemptId, score: totalScore, total_questions: totalQuestions, percentage });
      if (resultErr) console.error('Error saving user result:', resultErr);
    }

    const { error: completeErr } = await supabase.from('test_attempts').update({ completed_at: new Date().toISOString() }).eq('id', attemptId);
    if (completeErr) console.error('Error updating attempt completion time:', completeErr);
  };

  const handleNext = async () => {
    if (!currentChapter) return;

    if (currentChapter.type === 'listening') {
      if (phase === 'intro') { setPhase('questions'); return; }

      await savePieceAnswers('listening');

      const last = currentChapter.pieces.length - 1;
      if (currentPieceIndex < last) {
        setCurrentPieceIndex(i => i + 1);
        setPhase('questions');
        return;
      }

      const unansweredInChapter = getUnansweredInChapter(currentChapter);
      if (unansweredInChapter.length > 0) {
        const ok = window.confirm(`فيه ${unansweredInChapter.length} سؤال ما جاوبت عليهم في هذا الفصل. تبي تتابع وتروح للفصل التالي؟`);
        if (!ok) { goToQuestionInCurrent(unansweredInChapter[0]); return; }
      }

      setCurrentChapterIndex(ci => ci + 1);
      setCurrentPieceIndex(0);
      return;
    }

    if (currentChapter.type === 'reading') {
      await savePieceAnswers('reading');
      const last = currentChapter.pieces.length - 1;
      if (currentPieceIndex < last) { setCurrentPieceIndex(i => i + 1); return; }
      else {
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
      await savePieceAnswers('grammar');
      const last = currentChapter.questions.length - 1;
      if (currentPieceIndex < last) { setCurrentPieceIndex(i => i + 1); return; }
      else {
        const unansweredInChapter = getUnansweredInChapter(currentChapter);
        if (unansweredInChapter.length > 0) {
          const ok = window.confirm(`فيه ${unansweredInChapter.length} سؤال ما جاوبت عليهم في هذا الفصل. تبي تتابع وتنهي الانتقال؟`);
          if (!ok) { goToQuestionInCurrent(unansweredInChapter[0]); return; }
        }
        await finalizeScoresAndWrongs();
        setShowResult(true);
        return;
      }
    }
  };

  const handlePrev = async () => {
    if (!currentChapter) return;
    if (currentChapter.type === 'listening') {
      if (phase === 'questions' && currentPieceIndex === 0) { setPhase('intro'); return; }
      if (phase === 'questions') await savePieceAnswers('listening');
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

  const goToReview = () => { if (!attemptId) return; router.push(`/attempts/${attemptId}/review`); };

  const [showMarkedPanel, setShowMarkedPanel] = useState(false);
  const markedList = useMemo(() => Object.keys(markedMap), [markedMap]);

  // -------------- New helpers for underline resolution --------------
  function findSentenceContaining(text, needle) {
    if (!text || !needle) return null;
    const sentences = String(text).split(/(?<=[.!?])\s+/);
    const idx = sentences.findIndex(s => s.toLowerCase().includes(String(needle).toLowerCase()));
    return idx >= 0 ? sentences[idx] : null;
  }
  function resolveBaseTextForQuestion(q, piece) {
    if (q?.base_text) return q.base_text;
    let sourceText = '';
    if (piece?.passage_paragraphs && Array.isArray(piece.passage_paragraphs) && piece.passage_paragraphs.length) {
      sourceText = piece.passage_paragraphs.map(p => p.text).join(' ');
    } else if (piece?.passage) sourceText = piece.passage;
    if (Array.isArray(q?.underlined_words) && q.underlined_words.length > 0) {
      const target = q.underlined_words.find(Boolean);
      const sentence = findSentenceContaining(sourceText, target);
      if (sentence) return sentence;
      return sourceText || null;
    }
    if (Array.isArray(q?.underlined_positions) && q.underlined_positions.length > 0) {
      return sourceText || null;
    }
    return null;
  }
  // ----------------------------------------------------------------

  function renderUnderlined(baseText, underlinedWords = null, underlinedPositions = null) {
    if (!baseText) return null;
    const hasUnderlines = (Array.isArray(underlinedWords) && underlinedWords.length > 0) || (Array.isArray(underlinedPositions) && underlinedPositions.length > 0);
    if (!hasUnderlines) return null;
    try {
      if (Array.isArray(underlinedPositions) && underlinedPositions.length > 0) {
        const nodes = []; let lastIndex = 0;
        underlinedPositions.sort((a,b) => a.start - b.start);
        for (let i=0;i<underlinedPositions.length;i++){
          const pos = underlinedPositions[i];
          const start = Math.max(0, pos.start);
          const end = Math.min(baseText.length, pos.end);
          if (start > lastIndex) nodes.push(<span key={`t-${i}`}>{baseText.slice(lastIndex,start)}</span>);
          nodes.push(<u key={`u-${i}`}>{baseText.slice(start,end)}</u>);
          lastIndex = end;
        }
        if (lastIndex < baseText.length) nodes.push(<span key={`r-${lastIndex}`}>{baseText.slice(lastIndex)}</span>);
        return <span>{nodes}</span>;
      }
      if (Array.isArray(underlinedWords) && underlinedWords.length > 0) {
        let remaining = baseText; const nodes = [];
        while (remaining.length) {
          let foundIndex = -1; let foundWord = null;
          for (const w of underlinedWords) {
            if (!w) continue;
            const regex = new RegExp(`\\b${escapeRegExp(w)}\\b`, 'i');
            const m = regex.exec(remaining);
            if (m && (foundIndex === -1 || m.index < foundIndex)) { foundIndex = m.index; foundWord = m[0]; }
          }
          if (foundIndex === -1) { nodes.push(<span key={nodes.length}>{remaining}</span>); break; }
          if (foundIndex > 0) nodes.push(<span key={nodes.length}>{remaining.slice(0,foundIndex)}</span>);
          nodes.push(<u key={nodes.length} data-uline={foundWord}>{remaining.substr(foundIndex, foundWord.length)}</u>);
          remaining = remaining.slice(foundIndex + foundWord.length);
        }
        return <span>{nodes}</span>;
      }
      return <span />;
    } catch (e) { return <span />; }
  }
  function escapeRegExp(string) { return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // -------------- Audio reload effect --------------
  useEffect(() => {
    const el = questionRefs.current[`audio-${currentPiece?.id}`];
    if (!el) return;
    try {
      el.load();
      // only attempt to play; may be blocked if not a user gesture
      el.play().catch(() => {});
    } catch (e) {
      console.warn('audio load/play error', e);
    }
    // reset play-block flag for new piece so user can play it
    if (currentPiece?.id) playedMapRef.current[currentPiece.id] = false;
  }, [currentPiece?.id, currentPiece?.audio_url]);
  // ---------------------------------------------------

  if (loading) return (
    <div>جاري تحميل الاختبار...</div>
  );
  if (!currentChapter && !showResult) return (
    <div>
      لا توجد فصول متاحة لهذا الاختبار.
      <Button onClick={() => router.push('/dashboard')} variant="outline" className="mt-4">الرجوع للاختبارات</Button>
    </div>
  );

  if (showResult) {
    return (
      <div>
        <h1>{test?.title}</h1>
        <h2>النتيجة النهائية</h2>
        <div>الاستماع {scores.listening} / 20</div>
        <div>القراءة {scores.reading} / 40</div>
        <div>القواعد {scores.grammar} / 40</div>
        <div>المجموع {scores.total} / 100</div>
        <div>النسبة {scores.percentage}%</div>

        {wrongAnswers.length > 0 && (
          <div>
            <h3>أسئلة أخطأت بها</h3>
            {wrongAnswers.map((qid,i)=>(
              <div key={qid}>خطأ #{i+1} — معرف السؤال: {qid}</div>
            ))}
            <div>اضغط "راجع محاولتي" لمشاهدة تفاصيل الأخطاء</div>
          </div>
        )}

        <Button onClick={() => router.push('/dashboard')} variant="outline">الرئيسية</Button>
        <Button onClick={goToReview}>راجع محاولتي</Button>
      </div>
    );
  }

  return (
    <div>
      <h2>{test?.title}</h2>
      <h3>{currentChapter?.title}</h3>

      <div className="bg-slate-200 h-1.5 mb-6">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${((currentChapterIndex + 1) / Math.max(chapters.length, 1)) * 100}%` }} />
      </div>

      <main>
        {validationError && <div className="mb-4 p-3 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">{validationError}</div>}

        {/* Listening */}
        {currentChapter?.type === 'listening' && currentPiece && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm max-h-[70vh] overflow-y-auto text-left">
              <div className="mb-4">
                <audio
                  key={currentPiece?.id || currentPiece?.audio_url}
                  ref={(el) => { if (!el) return; questionRefs.current[`audio-${currentPiece?.id}`] = el; }}
                  controls
                  preload="none"
                  onPlay={(e) => {
                    const pid = currentPiece?.id;
                    if (!pid) return;
                    if (playedMapRef.current[pid]) {
                      try { e.target.pause(); e.target.currentTime = 0; } catch (_) {}
                      alert('هذا المقطع شُغّل سابقًا، لا يمكن إعادة تشغيله.');
                      return;
                    }
                    playedMapRef.current[pid] = true;
                  }}
                >
                  <source src={currentPiece.audio_url} type="audio/mpeg" />
                  متصفحك لا يدعم عناصر الصوت.
                </audio>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap gap-2 mb-4 justify-end">
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
                <div key={q.id} id={`q-${q.id}`} className="bg-white rounded-lg p-6 shadow-sm mb-3">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-medium"><span className="text-blue-600 mr-2 font-semibold">{i + 1}.</span>{q.question_text}</p>
                      <button type="button" onClick={() => toggleMark(q.id)} title="علامة للرجوع" className="text-yellow-600 ml-3"><Tag className={`w-4 h-4 ${markedMap[q.id] ? 'text-yellow-600' : 'text-slate-300'}`} /></button>
                    </div>
                    <button onClick={() => setActiveHintQuestion(q)} className="text-slate-500 hover:text-blue-600"><Lightbulb className="w-5 h-5" /></button>
                  </div>

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
          </div>
        )}

        {/* Reading */}
        {currentChapter?.type === 'reading' && currentPiece && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm max-h-[70vh] overflow-y-auto text-left">
              <h3 className="text-xl font-bold mb-4">{currentPiece.passage_title}</h3>
              {Array.isArray(currentPiece.passage_paragraphs) ? (
                currentPiece.passage_paragraphs.map((para, pi) => (
                  <p key={pi} className="mb-4 leading-relaxed text-slate-700">
                    <strong className="font-bold mr-2">{para.num}.</strong>
                    <span>{para.text}</span>
                  </p>
                ))
              ) : (
                <div className="whitespace-pre-line leading-relaxed text-slate-700">{currentPiece.passage}</div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap gap-2 mb-4 justify-end">
                {currentPiece.reading_questions.map((q, idx) => {
                  const answered = !!answeredMap[q.id];
                  const marked = !!markedMap[q.id];
                  const cls = answered ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700';
                  return (<button key={q.id} onClick={() => goToQuestionInCurrent(q.id)} className={`px-2 py-1 rounded ${cls}`}>{idx + 1}{marked && <span className="ml-2 text-xs">★</span>}</button>);
                })}
              </div>

              {currentPiece.reading_questions.map((q, qi) => {
                const prepared = { ...q, base_text: resolveBaseTextForQuestion(q, currentPiece) };
                const hasUnderline = (
                  ((Array.isArray(prepared.underlined_words) && prepared.underlined_words.length > 0) ||
                   (Array.isArray(prepared.underlined_positions) && prepared.underlined_positions.length > 0))
                  && !!prepared.base_text
                );

                return (
                  <div key={prepared.id} id={`q-${prepared.id}`} className="bg-white rounded-lg p-6 shadow-sm mb-3">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-medium"><span className="text-emerald-600 mr-2 font-semibold">{qi + 1}.</span>{prepared.question_text}</p>
                        <button type="button" onClick={() => toggleMark(prepared.id)} title="علامة للرجوع" className="text-yellow-600 ml-3"><Tag className={`w-4 h-4 ${markedMap[prepared.id] ? 'text-yellow-600' : 'text-slate-300'}`} /></button>
                      </div>
                      <button onClick={() => setActiveHintQuestion(prepared)} className="text-slate-500 hover:text-emerald-600 ml-4"><Lightbulb className="w-5 h-5" /></button>
                    </div>

                    {hasUnderline && (
                      <div className="mb-3 text-slate-700">
                        {renderUnderlined(prepared.base_text, prepared.underlined_words, prepared.underlined_positions)}
                      </div>
                    )}

                    <div className="space-y-2">
                      {prepared.options?.map((opt, oi) => (
                        <label key={oi} className={`flex items-center p-4 border-2 rounded-md cursor-pointer ${answers[prepared.id] === opt ? 'border-emerald-600' : 'border-slate-200'}`}>
                          <input type="radio" name={`q-${prepared.id}`} value={opt} onChange={() => handleSelect(prepared.id, opt)} checked={answers[prepared.id] === opt} className="w-4 h-4 text-emerald-600 mr-3" />
                          <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}

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
              const rawQ = currentChapter.questions[currentPieceIndex];
              if (!rawQ) return null;
              const q = { ...rawQ, base_text: resolveBaseTextForQuestion(rawQ, null) };
              const hasUnderline = (
                ((Array.isArray(q.underlined_words) && q.underlined_words.length > 0) ||
                 (Array.isArray(q.underlined_positions) && q.underlined_positions.length > 0))
                && !!q.base_text
              );
              const marked = !!markedMap[q.id];

              return (
                <div className="bg-white rounded-lg p-8 shadow-sm">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <p className="text-xl font-medium"><span className="text-slate-600 font-semibold mr-2">سؤال {currentPieceIndex + 1} من {currentChapter.questions.length}</span></p>
                      <button type="button" onClick={() => toggleMark(q.id)} className="text-yellow-600 ml-3" title="علامة للرجوع"><Tag className={`w-4 h-4 ${marked ? 'text-yellow-600' : 'text-slate-300'}`} /></button>
                    </div>
                    <button onClick={() => setActiveHintQuestion(q)} className="text-slate-500 hover:text-slate-700 ml-4"><Lightbulb className="w-5 h-5" /></button>
                  </div>

                  {hasUnderline && (
                    <div className="mb-4 text-slate-700">{renderUnderlined(q.base_text, q.underlined_words, q.underlined_positions)}</div>
                  )}

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
