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

  // مجموع النقاط الممكنة للاختبار
  const [totalPossible, setTotalPossible] = useState(0);
  // نتيجة محلية لعرضها بعد الانتهاء (اختياري)
  const [resultSummary, setResultSummary] = useState(null);

  // Hint / Reveal state maps
  const [hintModalOpen, setHintModalOpen] = useState(false);
  const [hintModalQuestionId, setHintModalQuestionId] = useState(null);
  const [revealedHintMap, setRevealedHintMap] = useState({}); // questionId -> true
  const [revealedAnswerMap, setRevealedAnswerMap] = useState({}); // questionId -> true

  // لتجنب تكرار التنبيهات الزمنية
  const alertedRef = useRef({}); // chapterIndex -> Set(thresholdSecs)

  useEffect(() => {
    initTest();
    /* eslint-disable-next-line */
  }, [id]);

  async function initTest() {
    try {
      if (!id) {
        setLoading(false);
        return;
      }
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
                id, idx, question_text, options, answer, hint, explanation, points
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
                id, idx, question_text, options, answer, hint, explanation, base_text, underlined_words, underlined_positions, points
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
            .select('id, idx, question_text, options, answer, hint, explanation, category, base_text, underlined_words, underlined_positions, points')
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

      // حساب مجموع النقاط الممكنة من الأسئلة المحمّلة
      let total = 0;
      for (const ch of enforced) {
        if (ch.type === 'listening') {
          for (const p of (ch.pieces || [])) {
            for (const q of (p.listening_questions || [])) {
              total += Number(q.points || 1);
            }
          }
        } else if (ch.type === 'reading') {
          for (const p of (ch.pieces || [])) {
            for (const q of (p.reading_questions || [])) {
              total += Number(q.points || 1);
            }
          }
        } else if (ch.type === 'grammar') {
          for (const q of (ch.questions || [])) {
            total += Number(q.points || 1);
          }
        }
      }

      setChapters(enforced);
      setTotalPossible(total);

      // إعادة الضبط
      setCurrentChapterIndex(0);
      setCurrentPieceIndex(0);
      setShowResult(false);
      setAnswers({});
      setAnsweredMap({});
      setMarkedMap({});
      setValidationError('');
      setRevealedHintMap({});
      setRevealedAnswerMap({});
      alertedRef.current = {};

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
    // reset alerted for this chapter index
    if (!alertedRef.current[currentChapterIndex]) alertedRef.current[currentChapterIndex] = new Set();

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

  // حفظ الإجابات في الفصل الحالي (يشمل points_awarded)
  async function saveAllAnswersInCurrentChapter() {
    if (!attemptId || !currentChapter) return;
    const rows = [];

    if (currentChapter.type === 'listening') {
      for (const p of (currentChapter.pieces || [])) {
        for (const q of (p.listening_questions || [])) {
          const selected = answers[q.id];
          const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
          const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;

          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'listening',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            points_awarded: pointsAwarded,
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
          const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;

          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'reading',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            points_awarded: pointsAwarded,
            answered_at: new Date().toISOString(),
          });

          if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
        }
      }
    } else if (currentChapter.type === 'grammar') {
      for (const q of (currentChapter.questions || [])) {
        const selected = answers[q.id];
        const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
        const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;

        rows.push({
          attempt_id: attemptId,
          question_id: q.id,
          question_type: 'grammar',
          selected_choice: selected != null ? String(selected) : null,
          is_correct: isCorrect,
          points_awarded: pointsAwarded,
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
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch {}
    // reset alerted set for this chapter if not present
    if (!alertedRef.current[currentChapterIndex]) alertedRef.current[currentChapterIndex] = new Set();
  }, [currentChapterIndex]);

  // منطق الصوت — الآن: تحميل المصدر وتشغيل تلقائيًا
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
          // حاول التشغيل تلقائيًا
          audioRef.current.play().then(() => {
            setIsPlaying(true);
            // لا نمنع الإيقاف التام لكن نسمح للمستخدم بإيقافه بعد التشغيل
            setIsLockedPlay(false);
            if (currentPiece?.id) playedMapRef.current[currentPiece.id] = true;
          }).catch((err) => {
            // قد يمنع المتصفح التشغيل التلقائي؛ لا نغلق التجربة، نعرض زر تشغيل
            console.warn('autoplay failed', err);
            setIsPlaying(false);
            setIsLockedPlay(false);
          });
        }
      }, 80);
    } catch (e) {
      console.warn('audio reset error', e);
    }
  }, [currentPiece?.id]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    function onPause() {
      // إذا كان القفل مفعلًا نعيد التشغيل فورًا، وإلا نوقف حالة التشغيل
      if (isLockedPlay) {
        el.play().catch(() => {});
      } else {
        setIsPlaying(false);
      }
    }

    function onSeeking() {
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
      for (const p of (chapter.pieces || []))
        for (const q of (p.listening_questions || []))
          if (!answeredMap[q.id]) qIds.push(q.id);
    } else if (chapter.type === 'reading') {
      for (const p of (chapter.pieces || []))
        for (const q of (p.reading_questions || []))
          if (!answeredMap[q.id]) qIds.push(q.id);
    } else if (chapter.type === 'grammar') {
      for (const q of (chapter.questions || []))
        if (!answeredMap[q.id]) qIds.push(q.id);
    }
    return qIds;
  };

  // مراقبة الوقت المتبقي لإظهار التنبيهات عند العتبات المطلوبة
  useEffect(() => {
    if (!currentChapter || chapterRemainingSecs == null) return;
    const totalSecs = currentChapter.duration_seconds || 0;
    const chapterIdx = currentChapterIndex;
    const alertedSet = alertedRef.current[chapterIdx] || new Set();

    // قواعد العتبات:
    // إذا المدة بين 10 و 13 دقيقة -> تنبيه عند 5 دقائق
    // إذا المدة >= 20 دقيقة -> تنبيه عند 10 و 5 دقائق
    const thresholds = [];
    if (totalSecs >= minsToSecs(10) && totalSecs <= minsToSecs(13)) {
      thresholds.push(minsToSecs(5));
    } else if (totalSecs >= minsToSecs(20)) {
      thresholds.push(minsToSecs(10), minsToSecs(5));
    } else if (totalSecs >= minsToSecs(10) && totalSecs < minsToSecs(20)) {
      // حالات وسطية: نضيف تنبيه عند 5 دقائق كحد أدنى
      thresholds.push(minsToSecs(5));
    }

    for (const t of thresholds) {
      if (chapterRemainingSecs <= t && !alertedSet.has(t)) {
        // سجل التنبيه حتى لا يتكرر
        alertedSet.add(t);
        alertedRef.current[chapterIdx] = alertedSet;
        // عرض التنبيه
        const minutesLeft = Math.ceil(t / 60);
        try {
          window.alert(`تبقى ${minutesLeft} دقيقة${minutesLeft > 1 ? 'ً' : ''} في هذا القسم. استخدم الوقت بحكمة.`);
        } catch (e) {
          console.log('alert:', `تبقى ${minutesLeft} دقيقة في هذا القسم.`);
        }
      }
    }
  }, [chapterRemainingSecs, currentChapterIndex, currentChapter]);

  async function finalizeScoresAndFinish() {
    if (!attemptId) return;

    // جلب محاولات الأسئلة مع نقاط
    const { data: attemptsRows = [], error: attemptsErr } = await supabase
      .from('question_attempts')
      .select('question_id, question_type, selected_choice, is_correct, points_awarded')
      .eq('attempt_id', attemptId);

    if (attemptsErr) {
      console.error('fetch question_attempts error', attemptsErr);
      return;
    }

    // حساب مجموع النقاط الممنوحة
    let totalAwarded = 0;
    for (const r of attemptsRows) {
      totalAwarded += Number(r.points_awarded || 0);
    }

    // استخدم totalPossible المحسوب عند initTest (في الحالة)
    const totalPossibleLocal = Number(totalPossible || 0);

    // حساب النسبة
    const percentage = totalPossibleLocal ? Math.round((totalAwarded / totalPossibleLocal) * 10000) / 100 : 0;
    const totalScore = Math.round(percentage);

    // حفظ النتيجة (upsert حسب attempt_id)
    const { error: upsertErr } = await supabase.from('user_results').upsert({
      attempt_id: attemptId,
      score: totalScore,
      total_questions: attemptsRows.length,
      percentage,
      total_possible: totalPossibleLocal,
    }, { onConflict: ['attempt_id'] });

    if (upsertErr) console.error('Error saving user result:', upsertErr);

    // تحديث completed_at في test_attempts
    const { error: completeErr } = await supabase.from('test_attempts').update({ completed_at: new Date().toISOString() }).eq('id', attemptId);
    if (completeErr) console.error('Error updating attempt completion time:', completeErr);

    // حفظ ملخص محلي للعرض
    setResultSummary({ totalAwarded, totalPossible: totalPossibleLocal, percentage, totalScore });

    setShowResult(true);
    stopChapterTimer();
    stopAudioHardReset();
  }

  async function goToNextChapterOrFinish() {
    // تحقق من الأسئلة غير المُجابة إن كان هناك وقت
    const unanswered = getUnansweredInChapter(currentChapter);
    if (unanswered.length > 0) {
      const ok = window.confirm(`فيه ${unanswered.length} سؤال غير مُجاب في هذا الفصل. تبي تتابع للفصل التالي؟`);
      if (!ok) {
        goToQuestionInCurrent(unanswered[0]);
        return;
      }
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
          const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;

          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'listening',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            points_awarded: pointsAwarded,
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
          const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;

          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'reading',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            points_awarded: pointsAwarded,
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
        const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;

        const row = {
          attempt_id: attemptId,
          question_id: q.id,
          question_type: 'grammar',
          selected_choice: selected != null ? String(selected) : null,
          is_correct: isCorrect,
          points_awarded: pointsAwarded,
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
          const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;

          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'listening',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            points_awarded: pointsAwarded,
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
          const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;

          rows.push({
            attempt_id: attemptId,
            question_id: q.id,
            question_type: 'reading',
            selected_choice: selected != null ? String(selected) : null,
            is_correct: isCorrect,
            points_awarded: pointsAwarded,
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
        const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;

        const row = {
          attempt_id: attemptId,
          question_id: q.id,
          question_type: 'grammar',
          selected_choice: selected != null ? String(selected) : null,
          is_correct: isCorrect,
          points_awarded: pointsAwarded,
          answered_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('question_attempts').upsert([row], { onConflict: ['attempt_id', 'question_id'] });
        if (error) console.error('save prev grammar question error', error);
      }

      if (currentPieceIndex > 0) setCurrentPieceIndex(i => i - 1);
    }
  };

  const goToReview = () => {
    if (!attemptId) return;
    router.push(`/attempts/${attemptId}/review`);
  };

  // Hint modal helpers
  const openHintModal = (questionId) => {
    setHintModalQuestionId(questionId);
    setHintModalOpen(true);
  };

  const closeHintModal = () => {
    setHintModalOpen(false);
    setHintModalQuestionId(null);
  };

  const revealHint = (questionId) => {
    setRevealedHintMap(prev => ({ ...prev, [questionId]: true }));
  };

  const revealAnswer = (questionId) => {
    setRevealedAnswerMap(prev => ({ ...prev, [questionId]: true }));
  };

  if (loading) return (
    <div className="p-6 text-center">جاري تحميل الاختبار...</div>
  );

  if (showResult) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">{test?.title}</h1>
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">اكتمل الاختبار</h2>
          <p className="mb-2">النتيجة: <strong>{resultSummary ? `${resultSummary.percentage}%` : '—'}</strong></p>
          <p className="mb-4">النقاط المحققة: <strong>{resultSummary ? resultSummary.totalAwarded : '—'}</strong> من <strong>{resultSummary ? resultSummary.totalPossible : totalPossible}</strong></p>
          <div className="flex gap-3">
            <Button onClick={() => router.push('/dashboard')} variant="outline">الرئيسية</Button>
            <Button onClick={goToReview}>راجع محاولتي</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">{test?.title}</h2>

      <h3 className="text-lg mb-2">{currentChapter?.title}</h3>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">الوقت المتبقي: {formatMMSS(chapterRemainingSecs ?? 0)}</div>
        <div className="text-sm text-slate-600">مجموع النقاط الممكنة: {totalPossible}</div>
      </div>

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
                preload="auto"
                controls
              >
                <source src={currentPiece.audio_url} type="audio/mpeg" />
                متصفحك لا يدعم عناصر الصوت.
              </audio>

              {!isPlaying && (
                <div className="mt-3">
                  <div className="text-sm text-slate-500 mt-2">المقطع سيبدأ تلقائياً عند تحميله. إذا لم يبدأ، اضغط زر التشغيل.</div>
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
                  <div>
                    <Button onClick={() => openHintModal(q.id)} variant="outline" size="sm">Hint</Button>
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

                {/* عرض hint/answer إذا تم الكشف */}
                {revealedHintMap[q.id] && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-sm text-slate-800 mb-2"><strong>Hint:</strong> {q.hint || 'لا يوجد تلميح متاح.'}</div>
                    {revealedAnswerMap[q.id] && (
                      <div className="mt-2 p-2 bg-slate-100 border rounded">
                        <div className="text-sm"><strong>Answer:</strong> {q.answer}</div>
                        {q.explanation && <div className="text-sm mt-1 text-slate-700"><strong>Explanation:</strong> {typeof q.explanation === 'string' ? q.explanation : (q.explanation?.ar || q.explanation?.en || JSON.stringify(q.explanation))}</div>}
                      </div>
                    )}
                  </div>
                )}
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
                  <div>
                    <Button onClick={() => openHintModal(q.id)} variant="outline" size="sm">Hint</Button>
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

                {revealedHintMap[q.id] && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-sm text-slate-800 mb-2"><strong>Hint:</strong> {q.hint || 'لا يوجد تلميح متاح.'}</div>
                    {revealedAnswerMap[q.id] && (
                      <div className="mt-2 p-2 bg-slate-100 border rounded">
                        <div className="text-sm"><strong>Answer:</strong> {q.answer}</div>
                        {q.explanation && <div className="text-sm mt-1 text-slate-700"><strong>Explanation:</strong> {typeof q.explanation === 'string' ? q.explanation : (q.explanation?.ar || q.explanation?.en || JSON.stringify(q.explanation))}</div>}
                      </div>
                    )}
                  </div>
                )}
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
                  <div>
                    <Button onClick={() => openHintModal(q.id)} variant="outline" size="sm">Hint</Button>
                  </div>
                </div>

                {/* Underlines لو موجود */}
                {((Array.isArray(q.underlined_words) && q.underlined_words.length > 0) ||
                  (Array.isArray(q.underlined_positions) && q.underlined_positions.length > 0)) && q.base_text && (
                  <div className="mb-4 text-slate-700">
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

                {revealedHintMap[q.id] && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-sm text-slate-800 mb-2"><strong>Hint:</strong> {q.hint || 'لا يوجد تلميح متاح.'}</div>
                    {revealedAnswerMap[q.id] && (
                      <div className="mt-2 p-2 bg-slate-100 border rounded">
                        <div className="text-sm"><strong>Answer:</strong> {q.answer}</div>
                        {q.explanation && <div className="text-sm mt-1 text-slate-700"><strong>Explanation:</strong> {typeof q.explanation === 'string' ? q.explanation : (q.explanation?.ar || q.explanation?.en || JSON.stringify(q.explanation))}</div>}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-8 flex justify-between">
                  <Button onClick={handlePrev} variant="outline"><ArrowLeft className="w-4 h-4 ml-2" /> السابق</Button>
                  <Button onClick={handleNext} className="bg-slate-600 text-white">{currentPieceIndex < currentChapter.questions.length - 1 ? 'التالي' : 'إنهاء الفصل'} <ChevronRight className="w-4 h-4 ml-2" /></Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Hint Modal */}
      {hintModalOpen && hintModalQuestionId && (() => {
        // البحث عن السؤال في الفصل الحالي (listening/reading/grammar)
        let q = null;
        if (currentChapter?.type === 'listening') {
          for (const p of (currentChapter.pieces || [])) {
            const found = (p.listening_questions || []).find(x => x.id === hintModalQuestionId);
            if (found) { q = found; break; }
          }
        } else if (currentChapter?.type === 'reading') {
          for (const p of (currentChapter.pieces || [])) {
            const found = (p.reading_questions || []).find(x => x.id === hintModalQuestionId);
            if (found) { q = found; break; }
          }
        } else if (currentChapter?.type === 'grammar') {
          q = (currentChapter.questions || []).find(x => x.id === hintModalQuestionId) || null;
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-lg max-w-xl w-full p-6">
              <h3 className="text-lg font-semibold mb-3">تنبيه قبل استخدام التلميح</h3>
              <p className="text-sm text-slate-700 mb-4">
                استعمال هذه الخاصية بكثرة قد يؤثر على سرعة تقدمك وتعلمك. هل تريد المتابعة وكشف التلميح؟
              </p>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={closeHintModal}>إلغاء</Button>
                <Button onClick={() => {
                  // كشف التلميح
                  revealHint(hintModalQuestionId);
                  closeHintModal();
                }}>Reveal hint</Button>
              </div>

              {/* إذا تم كشف التلميح بالفعل، نعرضه مع زر كشف الإجابة */}
              {revealedHintMap[hintModalQuestionId] && q && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="text-sm"><strong>Hint:</strong> {q.hint || 'لا يوجد تلميح متاح.'}</div>
                  {!revealedAnswerMap[hintModalQuestionId] && (
                    <div className="mt-3 flex justify-end">
                      <Button onClick={() => revealAnswer(hintModalQuestionId)}>Reveal answer</Button>
                    </div>
                  )}
                  {revealedAnswerMap[hintModalQuestionId] && (
                    <div className="mt-3 p-2 bg-slate-100 border rounded">
                      <div className="text-sm"><strong>Answer:</strong> {q.answer}</div>
                      {q.explanation && <div className="text-sm mt-1 text-slate-700"><strong>Explanation:</strong> {typeof q.explanation === 'string' ? q.explanation : (q.explanation?.ar || q.explanation?.en || JSON.stringify(q.explanation))}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
