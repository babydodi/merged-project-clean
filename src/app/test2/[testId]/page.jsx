'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Volume2, ChevronRight, ArrowLeft, Tag, Clock } from 'lucide-react';
import { Button } from '../../../components/ui/button';

// ثابت التوقيت المطلوب حسب ترتيب الفصول (بالدقائق)
const REQUIRED_MINUTES_BY_INDEX = {
  0: 13, // Listening Part 1 (5)
  1: 13, // Listening Part 2 (5)
  2: 20, // Listening Part 3 (10)
  3: 20, // Reading Part 1 (15)
  4: 20, // Reading Part 2 (15)
  5: 20, // Reading Part 3 (10)
  6: 20, // Grammar Part 1 (20)
  7: 10, // Grammar Part 2 (10)
  8: 10, // Grammar Part 3 (10)
};

// مساعد لتحويل دقائق إلى ثواني
const minsToSecs = (m) => Math.max(0, Math.round(m * 60));

export default function TestPage() {
  const { testId: id } = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [attemptId, setAttemptId] = useState(null);

  const [test, setTest] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentPieceIndex, setCurrentPieceIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const [answers, setAnswers] = useState({});
  const [answeredMap, setAnsweredMap] = useState({});
  const [markedMap, setMarkedMap] = useState({});
  const [validationError, setValidationError] = useState('');

  // التوقيت لكل فصل
  const [chapterRemainingSecs, setChapterRemainingSecs] = useState(null);
  const timerRef = useRef(null);

  // الصوت
  const audioRef = useRef(null);
  const lastTimeRef = useRef(0);
  const [isLockedPlay, setIsLockedPlay] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // تتبع التشغيل لكل قطعة
  const playedMapRef = useRef({});

  useEffect(() => { initTest(); /* eslint-disable-next-line */ }, [id]);

  async function initTest() {
    try {
      if (!id) { setLoading(false); return; }
      setLoading(true);

      // إنشاء attempt
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

      // اختبار
      const { data: testData, error: testErr } = await supabase
        .from('tests')
        .select('*')
        .eq('id', id)
        .single();
      if (testErr) throw testErr;
      setTest(testData);

      // فصول
      const { data: chaptersData, error: chErr } = await supabase
        .from('chapters')
        .select('id, type, title, idx, duration_seconds')
        .eq('test_id', id)
        .order('idx', { ascending: true });
      if (chErr) throw chErr;

      // تحميل محتوى كل فصل حسب نوعه
      const assembled = [];
      for (const ch of chaptersData || []) {
        if (ch.type === 'listening') {
          const { data: pieces, error: lpErr } = await supabase
            .from('listening_pieces')
            .select(
              `id, audio_url, transcript, idx,
              listening_questions (
                id, idx, question_text, options, answer, hint, explanation
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
                id, idx, question_text, options, answer, hint, explanation, base_text, underlined_words, underlined_positions
              )`
            )
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });
          if (rpErr) throw rpErr;

          // تفكيك الفقرات إذا كانت مرقمة
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
            .select('id, idx, question_text, options, answer, hint, explanation, category, base_text, underlined_words, underlined_positions')
            .eq('chapter_id', ch.id)
            .order('idx', { ascending: true });
          if (gErr) throw gErr;
          assembled.push({ ...ch, questions: questions || [] });
        }
      }

      // ترتيب بحسب idx كما في DB
      assembled.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));

      // فرض التوقيت المطلوب لو غير موجود
      const enforced = assembled.map((ch, i) => {
        const mins = REQUIRED_MINUTES_BY_INDEX[i];
        const enforcedDuration = mins != null ? minsToSecs(mins) : ch.duration_seconds;
        return { ...ch, duration_seconds: enforcedDuration };
      });

      setChapters(enforced);

      // إعادة الضبط
      setCurrentChapterIndex(0);
      setCurrentPieceIndex(0);
      setShowResult(false);
      setAnswers({});
      setAnsweredMap({});
      setMarkedMap({});
      setValidationError('');

      // بدء المؤقت للفصل الأول
      const firstDuration = enforced[0]?.duration_seconds ?? minsToSecs(13);
      setChapterRemainingSecs(firstDuration);
      startChapterTimer(firstDuration);
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setLoading(false);
    }
  }

  // مؤقت الفصل
  function startChapterTimer(totalSecs) {
    clearInterval(timerRef.current);
    setChapterRemainingSecs(totalSecs);
    timerRef.current = setInterval(() => {
      setChapterRemainingSecs(prev => {
        if (prev == null) return null;
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleChapterTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopChapterTimer() {
    clearInterval(timerRef.current);
  }

  // عند انتهاء الوقت: احفظ الفصل وانتقل
  async function handleChapterTimeout() {
    await saveAllAnswersInCurrentChapter();
    goToNextChapterOrFinish();
  }

  // تنسيق الوقت
  const formatMMSS = (secs) => {
    const m = Math.floor((secs || 0) / 60);
    const s = Math.floor((secs || 0) % 60);
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const currentChapter = useMemo(() => chapters[currentChapterIndex], [chapters, currentChapterIndex]);
  const currentPiece = useMemo(() => {
    if (!currentChapter) return null;
    if (currentChapter.type === 'grammar') return null;
    return currentChapter.pieces?.[currentPieceIndex] || null;
  }, [currentChapter, currentPieceIndex]);

  // حفظ الإجابات في الفصل الحالي
  async function saveAllAnswersInCurrentChapter() {
    if (!attemptId || !currentChapter) return;
    const rows = [];

    if (currentChapter.type === 'listening') {
      for (const p of (currentChapter.pieces || [])) {
        for (const q of (p.listening_questions || [])) {
          const selected = answers[q.id];
          const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'listening',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            answered_at: new Date().toISOString(),
          });
          if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
        }
      }
    } else if (currentChapter.type === 'reading') {
      for (const p of (currentChapter.pieces || [])) {
        for (const q of (p.reading_questions || [])) {
          const selected = answers[q.id];
          const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'reading',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            answered_at: new Date().toISOString(),
          });
          if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
        }
      }
    } else if (currentChapter.type === 'grammar') {
      for (const q of (currentChapter.questions || [])) {
        const selected = answers[q.id];
        const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
        rows.push({
          attempt_id: attemptId,
          question_id: q.id,
          question_type: 'grammar',
          selected_choice: selected != null ? String(selected) : null,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
        });
        if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
      }
    }

    if (rows.length) {
      const { error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] });
      if (error) console.error('saveAllAnswers error', error);
    }
  }

  // عند الانتقال بين الفصول، أعِد المؤقت بناءً على الفصل الجديد
  useEffect(() => {
    if (!currentChapter) return;
    stopAudioHardReset();
    stopChapterTimer();
    const secs = currentChapter.duration_seconds ?? minsToSecs(REQUIRED_MINUTES_BY_INDEX[currentChapterIndex] || 20);
    startChapterTimer(secs);
    setCurrentPieceIndex(0);
    setValidationError('');
    // إيقاف الصوت المفتوح
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } } catch {}
  }, [currentChapterIndex]);

  // منطق الصوت — زر تشغيل فقط وقفل منع الإيقاف/التخطي
  useEffect(() => {
    setIsLockedPlay(false);
    setIsPlaying(false);
    lastTimeRef.current = 0;

    const el = audioRef.current;
    if (!el) return;

    try {
      el.pause();
      el.removeAttribute('src');
      el.src = '';
      el.load();
      setTimeout(() => {
        if (!audioRef.current) return;
        if (currentPiece?.audio_url) {
          audioRef.current.src = currentPiece.audio_url;
          audioRef.current.load();
        }
      }, 80);
    } catch (e) {
      console.warn('audio reset error', e);
    }
  }, [currentPiece?.id]);

  function handleManualPlay() {
    const el = audioRef.current;
    if (!el) return;
    setIsLockedPlay(true);
    el.play().then(() => {
      setIsPlaying(true);
      if (currentPiece?.id) playedMapRef.current[currentPiece.id] = true;
    }).catch((err) => {
      console.warn('play failed', err);
      setIsLockedPlay(false);
      setIsPlaying(false);
    });
  }

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    function onPause() {
      // أثناء القفل: إعادة تشغيل فورية لمنع الإيقاف
      if (isLockedPlay) {
        el.play().catch(() => {});
      } else {
        setIsPlaying(false);
      }
    }

    function onSeeking() {
      // منع التخطي للأمام أثناء القفل
      if (isLockedPlay) {
        el.currentTime = lastTimeRef.current || 0;
      }
    }

    function onTimeUpdate() {
      lastTimeRef.current = el.currentTime;
    }

    function onEnded() {
      setIsLockedPlay(false);
      setIsPlaying(false);
    }

    el.addEventListener('pause', onPause);
    el.addEventListener('seeking', onSeeking);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);

    return () => {
      el.removeEventListener('pause', onPause);
      el.removeEventListener('seeking', onSeeking);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
    };
  }, [isLockedPlay, currentPiece?.id]);

  function stopAudioHardReset() {
    const el = audioRef.current;
    if (!el) return;
    try {
      el.pause();
      el.removeAttribute('src');
      el.src = '';
      el.load();
      setIsLockedPlay(false);
      setIsPlaying(false);
      lastTimeRef.current = 0;
    } catch {}
  }

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

  const goToQuestionInCurrent = (questionId) => {
    const el = document.getElementById(`q-${questionId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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

  async function finalizeScoresAndFinish() {
    if (!attemptId) return;
    const { data: attemptsRows = [], error: attemptsErr } = await supabase
      .from('question_attempts')
      .select('question_id, question_type, selected_choice, is_correct')
      .eq('attempt_id', attemptId);
    if (attemptsErr) { console.error('fetch question_attempts error', attemptsErr); return; }

    const stats = { listening: { total: 0, correct: 0 }, reading: { total: 0, correct: 0 }, grammar: { total: 0, correct: 0 } };
    for (const r of attemptsRows) {
      if (r.question_type === 'listening') { stats.listening.total += 1; if (r.is_correct) stats.listening.correct += 1; }
      else if (r.question_type === 'reading') { stats.reading.total += 1; if (r.is_correct) stats.reading.correct += 1; }
      else if (r.question_type === 'grammar') { stats.grammar.total += 1; if (r.is_correct) stats.grammar.correct += 1; }
    }

    // توزيع بسيط للدرجات: 100 على المجموع
    const totalQuestions = stats.listening.total + stats.reading.total + stats.grammar.total;
    const totalCorrect = stats.listening.correct + stats.reading.correct + stats.grammar.correct;
    const percentage = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100 * 100) / 100 : 0;
    const totalScore = Math.round(percentage); // أو عدّل الوزن حسب رغبتك

    // حفظ النتيجة النهائية
    const { data: existing = [], error: exErr } = await supabase.from('user_results').select('id').eq('attempt_id', attemptId).limit(1);
    if (exErr) console.error('check existing user_results', exErr);
    if (!existing || existing.length === 0) {
      const { error: resultErr } = await supabase.from('user_results').insert({ attempt_id: attemptId, score: totalScore, total_questions: totalQuestions, percentage });
      if (resultErr) console.error('Error saving user result:', resultErr);
    }

    const { error: completeErr } = await supabase.from('test_attempts').update({ completed_at: new Date().toISOString() }).eq('id', attemptId);
    if (completeErr) console.error('Error updating attempt completion time:', completeErr);

    setShowResult(true);
    stopChapterTimer();
    stopAudioHardReset();
  }

  async function goToNextChapterOrFinish() {
    // تحقق من الأسئلة غير المُجابة إن كان هناك وقت
    const unanswered = getUnansweredInChapter(currentChapter);
    if (unanswered.length > 0) {
      const ok = window.confirm(`فيه ${unanswered.length} سؤال غير مُجاب في هذا الفصل. تبي تتابع للفصل التالي؟`);
      if (!ok) { goToQuestionInCurrent(unanswered[0]); return; }
    }

    if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex(i => i + 1);
      setCurrentPieceIndex(0);
    } else {
      await finalizeScoresAndFinish();
    }
  }

  const handleNext = async () => {
    if (!currentChapter) return;

    if (currentChapter.type === 'listening') {
      // حفظ إجابات قطعة الاستماع الحالية فقط
      const p = currentChapter.pieces?.[currentPieceIndex];
      if (p) {
        const rows = [];
        for (const q of (p.listening_questions || [])) {
          const selected = answers[q.id];
          const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'listening',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            answered_at: new Date().toISOString(),
          });
          if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
        }
        if (rows.length) {
          const { error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] });
          if (error) console.error('save listening piece answers error', error);
        }
      }

      const last = (currentChapter.pieces?.length || 1) - 1;
      if (currentPieceIndex < last) {
        stopAudioHardReset();
        setCurrentPieceIndex(i => i + 1);
        return;
      }
      // آخر قطعة -> انتقل للفصل التالي
      await saveAllAnswersInCurrentChapter();
      goToNextChapterOrFinish();
      return;
    }

    if (currentChapter.type === 'reading') {
      // حفظ إجابات قطعة القراءة الحالية فقط
      const p = currentChapter.pieces?.[currentPieceIndex];
      if (p) {
        const rows = [];
        for (const q of (p.reading_questions || [])) {
          const selected = answers[q.id];
          const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'reading',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            answered_at: new Date().toISOString(),
          });
          if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
        }
        if (rows.length) {
          const { error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] });
          if (error) console.error('save reading piece answers error', error);
        }
      }

      const last = (currentChapter.pieces?.length || 1) - 1;
      if (currentPieceIndex < last) {
        setCurrentPieceIndex(i => i + 1);
        return;
      }
      // آخر قطعة
      await saveAllAnswersInCurrentChapter();
      goToNextChapterOrFinish();
      return;
    }

    if (currentChapter.type === 'grammar') {
      // حفظ سؤال القواعد الحالي ثم التنقل
      const q = currentChapter.questions?.[currentPieceIndex];
      if (q) {
        const selected = answers[q.id];
        const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
        const row = {
          attempt_id: attemptId,
          question_id: q.id,
          question_type: 'grammar',
          selected_choice: selected != null ? String(selected) : null,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('question_attempts').upsert([row], { onConflict: ['attempt_id', 'question_id'] });
        if (error) console.error('save grammar question error', error);
        if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
      }

      const last = (currentChapter.questions?.length || 1) - 1;
      if (currentPieceIndex < last) {
        setCurrentPieceIndex(i => i + 1);
        return;
      }
      // آخر سؤال
      await saveAllAnswersInCurrentChapter();
      goToNextChapterOrFinish();
      return;
    }
  };

  const handlePrev = async () => {
    if (!currentChapter) return;

    if (currentChapter.type === 'listening') {
      const p = currentChapter.pieces?.[currentPieceIndex];
      if (p) {
        const rows = [];
        for (const q of (p.listening_questions || [])) {
          const selected = answers[q.id];
          const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'listening',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            answered_at: new Date().toISOString(),
          });
        }
        if (rows.length) {
          const { error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] });
          if (error) console.error('save prev listening answers error', error);
        }
      }
      if (currentPieceIndex > 0) {
        stopAudioHardReset();
        setCurrentPieceIndex(i => i - 1);
      }
      return;
    }

    if (currentChapter.type === 'reading') {
      const p = currentChapter.pieces?.[currentPieceIndex];
      if (p) {
        const rows = [];
        for (const q of (p.reading_questions || [])) {
          const selected = answers[q.id];
          const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'reading',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            answered_at: new Date().toISOString(),
          });
        }
        if (rows.length) {
          const { error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] });
          if (error) console.error('save prev reading answers error', error);
        }
      }
      if (currentPieceIndex > 0) setCurrentPieceIndex(i => i - 1);
      return;
    }

    if (currentChapter.type === 'grammar') {
      const q = currentChapter.questions?.[currentPieceIndex];
      if (q) {
        const selected = answers[q.id];
        const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
        const row = {
          attempt_id: attemptId,
          question_id: q.id,
          question_type: 'grammar',
          selected_choice: selected != null ? String(selected) : null,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('question_attempts').upsert([row], { onConflict: ['attempt_id', 'question_id'] });
        if (error) console.error('save prev grammar question error', error);
      }
      if (currentPieceIndex > 0) setCurrentPieceIndex(i => i - 1);
    }
  };

  const goToReview = () => { if (!attemptId) return; router.push(`/attempts/${attemptId}/review`); };

  if (loading) return (<div className="p-6">جاري تحميل الاختبار...</div>);

  if (showResult) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">{test?.title}</h1>
        <p className="mb-4">اكتمل الاختبار. يمكنك مراجعة محاولتك الآن.</p>
        <div className="flex gap-3">
          <Button onClick={() => router.push('/dashboard')} variant="outline">الرئيسية</Button>
          <Button onClick={goToReview}>راجع محاولتي</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{test?.title}</h2>
          <h3 className="text-slate-600">{currentChapter?.title}</h3>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Clock className="w-5 h-5" />
          <span className="font-semibold">{formatMMSS(chapterRemainingSecs ?? 0)}</span>
        </div>
      </header>

      <div className="bg-slate-200 h-1.5 mb-6">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${((currentChapterIndex + 1) / Math.max(chapters.length, 1)) * 100}%` }} />
      </div>

      {validationError && <div className="mb-4 p-3 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">{validationError}</div>}

      {/* Listening */}
      {currentChapter?.type === 'listening' && currentPiece && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-sm max-h-[70vh] overflow-y-auto text-left">
            <div className="mb-4">
              <audio
                key={currentPiece?.id || 'audio-default'}
                ref={(el) => { audioRef.current = el; }}
                preload="none"
              >
                <source src={currentPiece.audio_url} type="audio/mpeg" />
                متصفحك لا يدعم عناصر الصوت.
              </audio>

              {!isPlaying && (
                <div className="mt-3">
                  <Button onClick={handleManualPlay} className="bg-blue-600 text-white">
                    <Volume2 className="w-4 h-4 ml-2" /> تشغيل المقطع
                  </Button>
                  <div className="text-sm text-slate-500 mt-2">بعد البدء لا يمكن إيقافه أو تخطيه حتى ينتهي.</div>
                </div>
              )}

              {isLockedPlay && (
                <div className="text-sm text-red-600 mt-3">المقطع قيد التشغيل وممنوع الإيقاف أو التخطي.</div>
              )}

              {/* مهم: لا نعرض transcript إطلاقًا */}
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

            {currentPiece.reading_questions.map((q, qi) => (
              <div key={q.id} id={`q-${q.id}`} className="bg-white rounded-lg p-6 shadow-sm mb-3">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-medium"><span className="text-emerald-600 mr-2 font-semibold">{qi + 1}.</span>{q.question_text}</p>
                    <button type="button" onClick={() => toggleMark(q.id)} title="علامة للرجوع" className="text-yellow-600 ml-3"><Tag className={`w-4 h-4 ${markedMap[q.id] ? 'text-yellow-600' : 'text-slate-300'}`} /></button>
                  </div>
                </div>

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
            const q = currentChapter.questions?.[currentPieceIndex];
            if (!q) return null;
            const marked = !!markedMap[q.id];

            return (
              <div className="bg-white rounded-lg p-8 shadow-sm">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-medium"><span className="text-slate-600 font-semibold mr-2">سؤال {currentPieceIndex + 1} من {currentChapter.questions.length}</span></p>
                    <button type="button" onClick={() => toggleMark(q.id)} className="text-yellow-600 ml-3" title="علامة للرجوع"><Tag className={`w-4 h-4 ${marked ? 'text-yellow-600' : 'text-slate-300'}`} /></button>
                  </div>
                </div>

                {/* Underlines لو موجود */}
                {((Array.isArray(q.underlined_words) && q.underlined_words.length > 0) ||
                  (Array.isArray(q.underlined_positions) && q.underlined_positions.length > 0)) && q.base_text && (
                  <div className="mb-4 text-slate-700">
                    {/* عرض بسيط للنص الأساسي؛ إذا تحتاج عرض دقيق بالمواقع أقدر أضيفه */}
                    <div className="font-semibold mb-2">النص:</div>
                    <div className="text-slate-800 whitespace-pre-line">{q.base_text}</div>
                  </div>
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
                  <Button onClick={handleNext} className="bg-slate-600 text-white">{currentPieceIndex < currentChapter.questions.length - 1 ? 'التالي' : 'إنهاء الفصل'} <ChevronRight className="w-4 h-4 ml-2" /></Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
