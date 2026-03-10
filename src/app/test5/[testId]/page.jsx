'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Volume2, ChevronRight, ArrowLeft, Tag } from 'lucide-react';
import { Button } from '../../../components/ui/button';

const REQUIRED_MINUTES_BY_INDEX = { 0:13,1:13,2:20,3:20,4:20,5:20,6:20,7:10,8:10 };
const minsToSecs = (m) => Math.max(0, Math.round(m * 60));

function AlertBanner({ alert, onClose }) {
  if (!alert) return null;
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[min(900px,95%)]">
      <div className="bg-white border shadow-md rounded p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold text-lg">{alert.title}</div>
            <div className="text-sm text-slate-600 mt-1">{alert.message}</div>
          </div>
          <div className="flex items-center gap-2">
            {alert.type === 'confirm' ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { if (alert.onCancel) alert.onCancel(); if (onClose) onClose(); }}>{alert.cancelLabel || 'إلغاء'}</Button>
                <Button size="sm" onClick={() => { if (alert.onConfirm) alert.onConfirm(); if (onClose) onClose(); }}>{alert.confirmLabel || 'موافق'}</Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { if (onClose) onClose(); }}>إغلاق</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const [chapterRemainingSecs, setChapterRemainingSecs] = useState(null);
  const timerRef = useRef(null);

  // audio
  const audioRef = useRef(null);
  const lastTimeRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // played map to prevent re-showing button / re-playing
  const playedMapRef = useRef({}); // pieceId -> true

  // play button logic
  const playTimeoutRef = useRef(null);
  const playCountdownIntervalRef = useRef(null);
  const [playCountdown, setPlayCountdown] = useState(null);
  const [showPlayButton, setShowPlayButton] = useState(false);

  const [totalPossible, setTotalPossible] = useState(0);
  const [resultSummary, setResultSummary] = useState(null);

  const [currentAlert, setCurrentAlert] = useState(null);
  const alertTimeoutRef = useRef(null);
  const alertedRef = useRef({});

  useEffect(() => { initTest(); /* eslint-disable-next-line */ }, [id]);

  async function initTest() {
    try {
      if (!id) { setLoading(false); return; }
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData?.user || null;
      const payload = currentUser ? { test_id: id, user_id: currentUser.id } : { test_id: id };

      const { data: attempt, error: attemptErr } = await supabase.from('test_attempts').insert(payload).select().single();
      if (attemptErr) throw attemptErr;
      setAttemptId(attempt.id);

      const { data: testData, error: testErr } = await supabase.from('tests').select('*').eq('id', id).single();
      if (testErr) throw testErr;
      setTest(testData);

      const { data: chaptersData, error: chErr } = await supabase.from('chapters').select('id, type, title, idx, duration_seconds').eq('test_id', id).order('idx', { ascending: true });
      if (chErr) throw chErr;

      const assembled = [];
      for (const ch of chaptersData || []) {
        if (ch.type === 'listening') {
          const { data: pieces, error: lpErr } = await supabase.from('listening_pieces').select(`id, audio_url, transcript, idx, listening_questions ( id, idx, question_text, options, answer, hint, explanation, points )`).eq('chapter_id', ch.id).order('idx', { ascending: true });
          if (lpErr) throw lpErr;
          assembled.push({ ...ch, pieces: pieces || [] });
        } else if (ch.type === 'reading') {
          const { data: pieces, error: rpErr } = await supabase.from('reading_pieces').select(`id, passage_title, passage, idx, image_url, reading_questions ( id, idx, question_text, options, answer, hint, explanation, base_text, underlined_words, underlined_positions, points )`).eq('chapter_id', ch.id).order('idx', { ascending: true });
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
          const { data: questions, error: gErr } = await supabase.from('grammar_questions').select('id, idx, question_text, options, answer, hint, explanation, category, base_text, underlined_words, underlined_positions, points').eq('chapter_id', ch.id).order('idx', { ascending: true });
          if (gErr) throw gErr;
          assembled.push({ ...ch, questions: questions || [] });
        }
      }

      assembled.sort((a,b) => (a.idx ?? 0) - (b.idx ?? 0));
      const enforced = assembled.map((ch,i) => {
        const mins = REQUIRED_MINUTES_BY_INDEX[i];
        const enforcedDuration = mins != null ? minsToSecs(mins) : ch.duration_seconds;
        return { ...ch, duration_seconds: enforcedDuration };
      });

      let total = 0;
      for (const ch of enforced) {
        if (ch.type === 'listening') for (const p of (ch.pieces||[])) for (const q of (p.listening_questions||[])) total += Number(q.points||1);
        if (ch.type === 'reading') for (const p of (ch.pieces||[])) for (const q of (p.reading_questions||[])) total += Number(q.points||1);
        if (ch.type === 'grammar') for (const q of (ch.questions||[])) total += Number(q.points||1);
      }

      setChapters(enforced);
      setTotalPossible(total);

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
      playedMapRef.current = {};

      const firstDuration = enforced[0]?.duration_seconds ?? minsToSecs(13);
      setChapterRemainingSecs(firstDuration);
      startChapterTimer(firstDuration);
    } catch (err) {
      console.error('Init error:', err);
    } finally {
      setLoading(false);
    }
  }

  function startChapterTimer(totalSecs) {
    clearInterval(timerRef.current);
    setChapterRemainingSecs(totalSecs);
    if (!alertedRef.current[currentChapterIndex]) alertedRef.current[currentChapterIndex] = new Set();
    timerRef.current = setInterval(() => {
      setChapterRemainingSecs(prev => {
        if (prev == null) return null;
        if (prev <= 1) { clearInterval(timerRef.current); handleChapterTimeout(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }
  function stopChapterTimer() { clearInterval(timerRef.current); }

  async function handleChapterTimeout() {
    await saveAllAnswersInCurrentChapter();
    goToNextChapterOrFinish();
  }

  const currentChapter = useMemo(() => chapters[currentChapterIndex], [chapters, currentChapterIndex]);
  const currentPiece = useMemo(() => {
    if (!currentChapter) return null;
    if (currentChapter.type === 'grammar') return null;
    return currentChapter.pieces?.[currentPieceIndex] || null;
  }, [currentChapter, currentPieceIndex]);

  async function saveAllAnswersInCurrentChapter() {
    if (!attemptId || !currentChapter) return;
    const rows = [];
    if (currentChapter.type === 'listening') {
      for (const p of (currentChapter.pieces||[])) for (const q of (p.listening_questions||[])) {
        const selected = answers[q.id];
        const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
        const pointsAwarded = isCorrect ? Number(q.points||1) : 0;
        rows.push({ attempt_id: attemptId, question_id: q.id, question_type: 'listening', selected_choice: selected != null ? String(selected) : null, is_correct: isCorrect, points_awarded: pointsAwarded, answered_at: new Date().toISOString() });
        if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
      }
    } else if (currentChapter.type === 'reading') {
      for (const p of (currentChapter.pieces||[])) for (const q of (p.reading_questions||[])) {
        const selected = answers[q.id];
        const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
        const pointsAwarded = isCorrect ? Number(q.points||1) : 0;
        rows.push({ attempt_id: attemptId, question_id: q.id, question_type: 'reading', selected_choice: selected != null ? String(selected) : null, is_correct: isCorrect, points_awarded: pointsAwarded, answered_at: new Date().toISOString() });
        if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
      }
    } else if (currentChapter.type === 'grammar') {
      for (const q of (currentChapter.questions||[])) {
        const selected = answers[q.id];
        const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
        const pointsAwarded = isCorrect ? Number(q.points||1) : 0;
        rows.push({ attempt_id: attemptId, question_id: q.id, question_type: 'grammar', selected_choice: selected != null ? String(selected) : null, is_correct: isCorrect, points_awarded: pointsAwarded, answered_at: new Date().toISOString() });
        if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
      }
    }
    if (rows.length) {
      const { error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] });
      if (error) console.error('saveAllAnswers error', error);
    }
  }

  // ------------- إصلاح ظهور زر التشغيل -------------
  useEffect(() => {
    // تنظيف سابق
    if (playTimeoutRef.current) { clearTimeout(playTimeoutRef.current); playTimeoutRef.current = null; }
    if (playCountdownIntervalRef.current) { clearInterval(playCountdownIntervalRef.current); playCountdownIntervalRef.current = null; }
    setPlayCountdown(null);
    setShowPlayButton(false);
    setIsPlaying(false);

    if (!currentPiece?.audio_url) return;

    // إذا سبق وتشغّل هذه القطعة فلا نعرض زر
    if (playedMapRef.current[currentPiece.id]) {
      setShowPlayButton(false);
      setPlayCountdown(null);
      return;
    }

    const numQs = (currentPiece.listening_questions || []).length || 1;
    const delaySecs = Math.min(numQs * 15, 45);

    // عرض العد التنازلي فوراً
    setPlayCountdown(delaySecs);
    playCountdownIntervalRef.current = setInterval(() => {
      setPlayCountdown(prev => {
        if (prev == null) return null;
        if (prev <= 1) {
          clearInterval(playCountdownIntervalRef.current);
          playCountdownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // بعد delaySecs نعرض الزر (مرة واحدة)
    playTimeoutRef.current = setTimeout(() => {
      // تأكد أن القطعة لم تُشغّل أثناء الانتظار
      if (!playedMapRef.current[currentPiece.id]) setShowPlayButton(true);
      setPlayCountdown(null);
      if (playCountdownIntervalRef.current) { clearInterval(playCountdownIntervalRef.current); playCountdownIntervalRef.current = null; }
      playTimeoutRef.current = null;
    }, delaySecs * 1000);

    return () => {
      if (playTimeoutRef.current) { clearTimeout(playTimeoutRef.current); playTimeoutRef.current = null; }
      if (playCountdownIntervalRef.current) { clearInterval(playCountdownIntervalRef.current); playCountdownIntervalRef.current = null; }
      setPlayCountdown(null);
      setShowPlayButton(false);
    };
  }, [currentPiece?.id]);

  // تشغيل الصوت عند ضغط المستخدم (مرة واحدة فقط)
  const handlePlayAudioNow = async () => {
    if (!currentPiece?.audio_url || !audioRef.current) return;
    try {
      audioRef.current.src = currentPiece.audio_url;
      audioRef.current.load();
      await audioRef.current.play();
      setIsPlaying(true);
      playedMapRef.current[currentPiece.id] = true;
      setShowPlayButton(false);
      setPlayCountdown(null);
    } catch (err) {
      console.warn('Play failed:', err);
      setCurrentAlert({ title: 'تعذر تشغيل الصوت', message: 'المتصفح منع التشغيل. حاول الضغط مرة أخرى.', type: 'info' });
    }
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    function onPause() { setIsPlaying(false); }
    function onTimeUpdate() { lastTimeRef.current = el.currentTime; }
    function onEnded() { setIsPlaying(false); }
    el.addEventListener('pause', onPause);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('pause', onPause);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
    };
  }, [currentPiece?.id]);

  function stopAudioHardReset() {
    const el = audioRef.current;
    if (!el) return;
    try {
      el.pause();
      el.src = '';
      el.load();
      setIsPlaying(false);
      lastTimeRef.current = 0;
      if (playTimeoutRef.current) { clearTimeout(playTimeoutRef.current); playTimeoutRef.current = null; }
      if (playCountdownIntervalRef.current) { clearInterval(playCountdownIntervalRef.current); playCountdownIntervalRef.current = null; }
      setPlayCountdown(null);
      setShowPlayButton(false);
    } catch {}
  }

  const handleSelect = (questionId, value) => { setAnswers(prev => ({ ...prev, [questionId]: value })); setAnsweredMap(prev => ({ ...prev, [questionId]: true })); };
  const toggleMark = (questionId) => { setMarkedMap(prev => { const next = { ...prev }; if (next[questionId]) delete next[questionId]; else next[questionId] = true; return next; }); };
  const goToQuestionInCurrent = (questionId) => { const el = document.getElementById(`q-${questionId}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  useEffect(() => {
    if (!currentChapter || chapterRemainingSecs == null) return;
    const totalSecs = currentChapter.duration_seconds || 0;
    const chapterIdx = currentChapterIndex;
    const alertedSet = alertedRef.current[chapterIdx] || new Set();
    const thresholds = [];
    if (totalSecs >= minsToSecs(10) && totalSecs <= minsToSecs(13)) thresholds.push(minsToSecs(5));
    else if (totalSecs >= minsToSecs(20)) thresholds.push(minsToSecs(10), minsToSecs(5));
    else if (totalSecs >= minsToSecs(10) && totalSecs < minsToSecs(20)) thresholds.push(minsToSecs(5));
    for (const t of thresholds) {
      if (chapterRemainingSecs <= t && !alertedSet.has(t)) {
        alertedSet.add(t);
        alertedRef.current[chapterIdx] = alertedSet;
        const minutesLeft = Math.ceil(t / 60);
        const title = `تبقى ${minutesLeft} دقيقة`;
        const message = `الوقت المتبقي في هذا القسم الآن ${formatMMSS(chapterRemainingSecs)}. استخدم الوقت بحكمة.`;
        setCurrentAlert({ title, message, type: 'info' });
        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = setTimeout(() => setCurrentAlert(null), 7000);
      }
    }
  }, [chapterRemainingSecs, currentChapterIndex, currentChapter]);

  function showConfirm({ title, message, confirmLabel = 'موافق', cancelLabel = 'إلغاء' }) {
    return new Promise((resolve) => {
      const onConfirm = () => { resolve(true); setCurrentAlert(null); };
      const onCancel = () => { resolve(false); setCurrentAlert(null); };
      setCurrentAlert({ title, message, type: 'confirm', confirmLabel, cancelLabel, onConfirm, onCancel });
    });
  }

  const closeAlert = () => {
    setCurrentAlert(null);
    if (alertTimeoutRef.current) { clearTimeout(alertTimeoutRef.current); alertTimeoutRef.current = null; }
  };

  async function finalizeScoresAndFinish() {
    if (!attemptId) return;
    const { data: attemptsRows = [], error: attemptsErr } = await supabase.from('question_attempts').select('question_id, question_type, selected_choice, is_correct, points_awarded').eq('attempt_id', attemptId);
    if (attemptsErr) { console.error('fetch question_attempts error', attemptsErr); return; }
    let totalAwarded = 0;
    for (const r of attemptsRows) totalAwarded += Number(r.points_awarded || 0);
    const totalPossibleLocal = Number(totalPossible || 0);
    const percentage = totalPossibleLocal ? Math.round((totalAwarded / totalPossibleLocal) * 10000) / 100 : 0;
    const totalScore = Math.round(percentage);
    const { error: upsertErr } = await supabase.from('user_results').upsert({ attempt_id: attemptId, score: totalScore, total_questions: attemptsRows.length, percentage, total_possible: totalPossibleLocal }, { onConflict: ['attempt_id'] });
    if (upsertErr) console.error('Error saving user result:', upsertErr);
    const { error: completeErr } = await supabase.from('test_attempts').update({ completed_at: new Date().toISOString() }).eq('id', attemptId);
    if (completeErr) console.error('Error updating attempt completion time:', completeErr);
    setResultSummary({ totalAwarded, totalPossible: totalPossibleLocal, percentage, totalScore });
    setShowResult(true);
    stopChapterTimer();
    stopAudioHardReset();
  }

  async function goToNextChapterOrFinish() {
    const unanswered = getUnansweredInChapter(currentChapter);
    if (unanswered.length > 0) {
      const ok = await showConfirm({ title: `فيه ${unanswered.length} سؤال غير مُجاب في هذا الفصل`, message: 'تبي تتابع للفصل التالي؟', confirmLabel: 'نعم، تابع', cancelLabel: 'لا، أرجع' });
      if (!ok) { goToQuestionInCurrent(unanswered[0]); return; }
    }
    if (currentChapterIndex < chapters.length - 1) { setCurrentChapterIndex(i => i + 1); setCurrentPieceIndex(0); }
    else { await finalizeScoresAndFinish(); }
  }

  const handleNext = async () => {
    if (!currentChapter) return;
    // حفظ إجابات القطعة الحالية (كما في الكود السابق)
    if (currentChapter.type === 'listening') {
      const p = currentChapter.pieces?.[currentPieceIndex];
      if (p) {
        const rows = [];
        for (const q of (p.listening_questions || [])) {
          const selected = answers[q.id];
          const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
          const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;
          rows.push({ attempt_id: attemptId, question_id: q.id, question_type: 'listening', selected_choice: selected != null ? String(selected) : null, is_correct: isCorrect, points_awarded: pointsAwarded, answered_at: new Date().toISOString() });
          if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
        }
        if (rows.length) { const { error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] }); if (error) console.error('save listening piece answers error', error); }
      }
      const last = (currentChapter.pieces?.length || 1) - 1;
      if (currentPieceIndex < last) { stopAudioHardReset(); setCurrentPieceIndex(i => i + 1); return; }
      await saveAllAnswersInCurrentChapter();
      goToNextChapterOrFinish();
      return;
    }
    // reading & grammar same as before
    if (currentChapter.type === 'reading') {
      const p = currentChapter.pieces?.[currentPieceIndex];
      if (p) {
        const rows = [];
        for (const q of (p.reading_questions || [])) {
          const selected = answers[q.id];
          const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
          const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;
          rows.push({ attempt_id: attemptId, question_id: q.id, question_type: 'reading', selected_choice: selected != null ? String(selected) : null, is_correct: isCorrect, points_awarded: pointsAwarded, answered_at: new Date().toISOString() });
          if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
        }
        if (rows.length) { const { error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] }); if (error) console.error('save reading piece answers error', error); }
      }
      const last = (currentChapter.pieces?.length || 1) - 1;
      if (currentPieceIndex < last) { setCurrentPieceIndex(i => i + 1); return; }
      await saveAllAnswersInCurrentChapter();
      goToNextChapterOrFinish();
      return;
    }
    if (currentChapter.type === 'grammar') {
      const q = currentChapter.questions?.[currentPieceIndex];
      if (q) {
        const selected = answers[q.id];
        const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
        const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;
        const row = { attempt_id: attemptId, question_id: q.id, question_type: 'grammar', selected_choice: selected != null ? String(selected) : null, is_correct: isCorrect, points_awarded: pointsAwarded, answered_at: new Date().toISOString() };
        const { error } = await supabase.from('question_attempts').upsert([row], { onConflict: ['attempt_id', 'question_id'] });
        if (error) console.error('save grammar question error', error);
        if (selected != null) setAnsweredMap(prev => ({ ...prev, [q.id]: true }));
      }
      const last = (currentChapter.questions?.length || 1) - 1;
      if (currentPieceIndex < last) { setCurrentPieceIndex(i => i + 1); return; }
      await saveAllAnswersInCurrentChapter();
      goToNextChapterOrFinish();
      return;
    }
  };

  const handlePrev = async () => {
    if (!currentChapter) return;
    // حفظ إجابات مشابهة كما في الكود السابق ثم التنقل
    if (currentChapter.type === 'listening') {
      const p = currentChapter.pieces?.[currentPieceIndex];
      if (p) {
        const rows = [];
        for (const q of (p.listening_questions || [])) {
          const selected = answers[q.id];
          const isCorrect = selected != null ? String(selected).trim() === String(q.answer).trim() : false;
          const pointsAwarded = isCorrect ? Number(q.points || 1) : 0;
          rows.push({ attempt_id: attemptId, question_id: q.id, question_type: 'listening', selected_choice: selected != null ? String(selected) : null, is_correct: isCorrect, points_awarded: pointsAwarded, answered_at: new Date().toISOString() });
        }
        if (rows.length) { const { error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] }); if (error) console.error('save prev listening answers error', error); }
      }
      if (currentPieceIndex > 0) { stopAudioHardReset(); setCurrentPieceIndex(i => i - 1); }
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
          rows.push({ attempt_id: attemptId, question_id: q.id, question_type: 'reading', selected_choice: selected != null ? String(selected) : null, is_correct: isCorrect, points_awarded: pointsAwarded, answered_at: new Date().toISOString() });
        }
        if (rows.length) { const { error } = await supabase.from('question_attempts').upsert(rows, { onConflict: ['attempt_id', 'question_id'] }); if (error) console.error('save prev reading answers error', error); }
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
        const row = { attempt_id: attemptId, question_id: q.id, question_type: 'grammar', selected_choice: selected != null ? String(selected) : null, is_correct: isCorrect, points_awarded: pointsAwarded, answered_at: new Date().toISOString() };
        const { error } = await supabase.from('question_attempts').upsert([row], { onConflict: ['attempt_id', 'question_id'] });
        if (error) console.error('save prev grammar question error', error);
      }
      if (currentPieceIndex > 0) setCurrentPieceIndex(i => i - 1);
    }
  };

  if (loading) return <div className="p-6">جاري تحميل الاختبار...</div>;

  if (showResult) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">{test?.title}</h1>
        <h2 className="text-lg mb-2">اكتمل الاختبار</h2>
        <div className="mb-4">النتيجة: {resultSummary ? `${resultSummary.percentage}%` : '—'}</div>
        <div className="mb-4">النقاط المحققة: {resultSummary ? resultSummary.totalAwarded : '—'} من {resultSummary ? resultSummary.totalPossible : totalPossible}</div>
        <div className="mt-6">
          <h3 className="font-semibold mb-2">الأسئلة الخاطئة</h3>
          <div className="text-sm text-slate-600">سيتم عرض الأسئلة الخاطئة هنا لمراجعتك.</div>
        </div>
        <div className="mt-6">
          <Button onClick={() => router.push('/dashboard')} variant="outline">الرئيسية</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <AlertBanner alert={currentAlert} onClose={closeAlert} />

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
          <div className="bg-white rounded-lg p-6 shadow-sm max-h-[70vh] overflow-y-auto text-left relative">
            <audio ref={audioRef} preload="auto" className="hidden" />

            {playCountdown != null && playCountdown > 0 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded text-sm text-blue-700">
                You have <span className="font-semibold">{playCountdown}</span> seconds to read the questions before the audio button appears.
              </div>
            )}

            {showPlayButton && !playedMapRef.current[currentPiece.id] && (
              <div className="mt-4 flex justify-center">
                <button onClick={handlePlayAudioNow} className="flex items-center gap-2 px-3 py-2 border rounded-md bg-white shadow-sm text-sm text-slate-700" aria-label="Play audio">
                  <Volume2 className="w-4 h-4" />
                  <span>Play Audio</span>
                </button>
              </div>
            )}

            {isPlaying && <div className="mt-3 p-2 text-sm text-green-700">Audio is playing...</div>}
            {!isPlaying && !showPlayButton && playCountdown == null && <div className="mt-3 text-sm text-slate-500">المقطع سيصبح قابلاً للتشغيل بعد انتهاء العد.</div>}
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reading & Grammar (unchanged rendering) */}
      {currentChapter?.type === 'reading' && currentPiece && (
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
          {currentPiece.image_url && <div className="mb-4"><img src={currentPiece.image_url} alt={currentPiece.passage_title || 'passage image'} className="max-w-full h-auto rounded" /></div>}
          {currentPiece.passage_paragraphs ? currentPiece.passage_paragraphs.map(pp => <p key={pp.num} className="mb-3 text-justify">{pp.text}</p>) : <p className="mb-3 text-justify">{currentPiece.passage}</p>}
          <div className="mt-4">
            {currentPiece.reading_questions?.map((q, i) => (
              <div key={q.id} id={`q-${q.id}`} className="bg-white rounded-lg p-4 shadow-sm mb-3">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-lg font-medium"><span className="text-blue-600 mr-2 font-semibold">{i + 1}.</span>{q.question_text}</p>
                  <button type="button" onClick={() => toggleMark(q.id)} title="علامة للرجوع" className="text-yellow-600 ml-3"><Tag className={`w-4 h-4 ${markedMap[q.id] ? 'text-yellow-600' : 'text-slate-300'}`} /></button>
                </div>
                <div className="space-y-2">
                  {q.options?.map((opt, oi) => (
                    <label key={oi} className={`flex items-center p-3 border-2 rounded-md cursor-pointer ${answers[q.id] === opt ? 'border-blue-600' : 'border-slate-200'}`}>
                      <input type="radio" name={`q-${q.id}`} value={opt} onChange={() => handleSelect(q.id, opt)} checked={answers[q.id] === opt} className="w-4 h-4 text-blue-600 mr-3" />
                      <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentChapter?.type === 'grammar' && (
        <div className="space-y-4">
          {currentChapter.questions?.map((q, i) => (
            <div key={q.id} id={`q-${q.id}`} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <p className="text-lg font-medium"><span className="text-blue-600 mr-2 font-semibold">{i + 1}.</span>{q.question_text}</p>
                <button type="button" onClick={() => toggleMark(q.id)} title="علامة للرجوع" className="text-yellow-600 ml-3"><Tag className={`w-4 h-4 ${markedMap[q.id] ? 'text-yellow-600' : 'text-slate-300'}`} /></button>
              </div>
              <div className="space-y-2">
                {q.options?.map((opt, oi) => (
                  <label key={oi} className={`flex items-center p-3 border-2 rounded-md cursor-pointer ${answers[q.id] === opt ? 'border-blue-600' : 'border-slate-200'}`}>
                    <input type="radio" name={`q-${q.id}`} value={opt} onChange={() => handleSelect(q.id, opt)} checked={answers[q.id] === opt} className="w-4 h-4 text-blue-600 mr-3" />
                    <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={handlePrev} variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> السابق</Button>
        <Button onClick={handleNext}>التالي <ChevronRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </div>
  );
}

// small helper
function formatMMSS(secs) {
  const m = Math.floor((secs || 0) / 60);
  const s = Math.floor((secs || 0) % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
