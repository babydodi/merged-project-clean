import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const { testId, attemptId, answers } = await req.json();

  // 1) تحقق أن المحاولة تخص المستخدم الحالي
  const { data: attemptRow, error: attemptErr } = await supabase
    .from('test_attempts')
    .select('id, user_id, test_id')
    .eq('id', attemptId)
    .single();

  if (attemptErr || !attemptRow) {
    return NextResponse.json({ error: 'محاولة غير موجودة' }, { status: 404 });
  }
  if (attemptRow.user_id !== user.id || attemptRow.test_id !== testId) {
    return NextResponse.json({ error: 'غير مصرح: هذه المحاولة لا تخصك أو التست غير مطابق' }, { status: 403 });
  }

  // 2) جلب الإجابات الصحيحة دفعة واحدة (ثلاث جداول)
  const questionIds = Object.keys(answers);
  if (questionIds.length === 0) {
    return NextResponse.json({ error: 'لا توجد إجابات مُرسلة' }, { status: 400 });
  }

  const [gRes, lRes, rRes] = await Promise.all([
    supabase.from('grammar_questions').select('id, answer').in('id', questionIds),
    supabase.from('listening_questions').select('id, answer').in('id', questionIds),
    supabase.from('reading_questions').select('id, answer').in('id', questionIds),
  ]);

  const answerMap = {};
  (gRes.data || []).forEach(x => { answerMap[x.id] = { answer: x.answer, type: 'grammar' }; });
  (lRes.data || []).forEach(x => { answerMap[x.id] = { answer: x.answer, type: 'listening' }; });
  (rRes.data || []).forEach(x => { answerMap[x.id] = { answer: x.answer, type: 'reading' }; });

  // 3) تجهيز صفوف question_attempts مع is_correct والنوع الصحيح
  const rows = [];
  let correctCount = 0;
  let total = 0;

  for (const [qid, selectedRaw] of Object.entries(answers)) {
    const meta = answerMap[qid] || null;
    const selected = selectedRaw != null ? String(selectedRaw).trim() : null;
    const expected = meta?.answer != null ? String(meta.answer).trim() : null;
    const isCorrect = !!(expected && selected && expected === selected);

    if (isCorrect) correctCount++;
    total++;

    rows.push({
      attempt_id: attemptId,
      question_id: qid,
      question_type: meta ? meta.type : 'unknown',
      selected_choice: selected,
      is_correct: isCorrect,
      answered_at: new Date().toISOString(),
    });
  }

  // 4) حفظ/تحديث المحاولات (upsert لمنع التكرار)
  const { error: upErr } = await supabase
    .from('question_attempts')
    .upsert(rows, { onConflict: ['attempt_id', 'question_id'] });

  if (upErr) {
    return NextResponse.json({ error: upErr.message || 'فشل حفظ المحاولات' }, { status: 500 });
  }

  // 5) حساب النتيجة العامة (percentage بسيطة: صحيح/إجمالي)
  const percentage = total ? (correctCount / total) * 100 : 0;

  // 6) حفظ/تحديث النتيجة في user_results (تحتاج سياسة RLS المناسبة)
  const { error: resultErr } = await supabase
    .from('user_results')
    .upsert(
      {
        attempt_id: attemptId,
        score: correctCount,
        total_questions: total,
        percentage,
      },
      { onConflict: ['attempt_id'] }
    );

  if (resultErr) {
    return NextResponse.json({ error: resultErr.message || 'فشل حفظ النتيجة (RLS?)' }, { status: 500 });
  }

  // 7) تحديث حالة المحاولة
  const { error: completeErr } = await supabase
    .from('test_attempts')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', attemptId);

  if (completeErr) {
    // غير حرجة، نرجّع نجاح ونطبع تحذير
    console.warn('complete attempt update error', completeErr);
  }

  return NextResponse.json({
    message: '✅ تم حفظ الإجابات وحساب النتيجة',
    correct: correctCount,
    total,
    percentage,
  });
}
