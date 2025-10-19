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

  // 1. حفظ الإجابات في question_attempts
  const rows = Object.entries(answers).map(([questionId, selected]) => ({
    attempt_id: attemptId,
    question_id: questionId,
    selected_choice: selected,
    question_type: 'auto', // ممكن تحدد النوع حسب الجدول
  }));

  const { error: insertError } = await supabase.from('question_attempts').insert(rows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 2. حساب النتيجة
  let correctCount = 0;
  let total = 0;

  for (const [questionId, selected] of Object.entries(answers)) {
    // نبحث في كل جداول الأسئلة
    let correctAnswer = null;

    // Grammar
    const { data: g } = await supabase
      .from('grammar_questions')
      .select('answer')
      .eq('id', questionId)
      .single();
    if (g) correctAnswer = g.answer;

    // Listening
    if (!correctAnswer) {
      const { data: l } = await supabase
        .from('listening_questions')
        .select('answer')
        .eq('id', questionId)
        .single();
      if (l) correctAnswer = l.answer;
    }

    // Reading
    if (!correctAnswer) {
      const { data: r } = await supabase
        .from('reading_questions')
        .select('answer')
        .eq('id', questionId)
        .single();
      if (r) correctAnswer = r.answer;
    }

    total++;
    if (correctAnswer && String(correctAnswer) === String(selected)) {
      correctCount++;
      // تحديث is_correct في question_attempts
      await supabase
        .from('question_attempts')
        .update({ is_correct: true })
        .eq('attempt_id', attemptId)
        .eq('question_id', questionId);
    }
  }

  const percentage = total > 0 ? (correctCount / total) * 100 : 0;

  // 3. حفظ النتيجة في user_results
  const { error: resultError } = await supabase.from('user_results').insert({
    attempt_id: attemptId,
    score: correctCount,
    total_questions: total,
    percentage,
  });

  if (resultError) {
    return NextResponse.json({ error: resultError.message }, { status: 500 });
  }

  // 4. تحديث حالة المحاولة
  await supabase
    .from('test_attempts')
    .update({ completed_at: new Date() })
    .eq('id', attemptId);

  return NextResponse.json({
    message: '✅ تم حفظ الإجابات وحساب النتيجة',
    correct: correctCount,
    total,
    percentage,
  });
}
