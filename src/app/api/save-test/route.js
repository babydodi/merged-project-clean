import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  // تحقق من الدور
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
  }

  try {
    const payload = await req.json()
    const { test } = payload
    const chapters = test.chapters || []

    // إنشاء اختبار
    const { data: testRow, error: testErr } = await supabase
      .from('tests')
      .insert([
        {
          title: test.title,
          description: test.description,
          availability: test.availability || 'all',
          is_published: true,
        },
      ])
      .select('*')
      .single()

    if (testErr) throw testErr

    // loop على الشابترات
    for (const ch of chapters) {
      const { data: chRow, error: chErr } = await supabase
        .from('chapters')
        .insert([
          {
            test_id: testRow.id,
            idx: ch.idx,
            type: ch.type,
            title: ch.title,
            duration_seconds: ch.duration_seconds || null,
          },
        ])
        .select('*')
        .single()
      if (chErr) throw chErr

      if (ch.type === 'listening') {
        for (const piece of ch.pieces || []) {
          const { data: pRow, error: pErr } = await supabase
            .from('listening_pieces')
            .insert([
              {
                chapter_id: chRow.id,
                idx: piece.idx,
                audio_url: piece.audio_url,
                transcript: piece.transcript || null,
              },
            ])
            .select('*')
            .single()
          if (pErr) throw pErr

          for (const q of piece.questions || []) {
            await supabase.from('listening_questions').insert([
              {
                listening_piece_id: pRow.id,
                idx: q.idx,
                question_text: q.question_text,
                options: q.options,
                answer: q.answer,
                explanation: q.explanation || null,
                hint: q.hint || null,
              },
            ])
          }
        }
      } else if (ch.type === 'reading') {
        for (const piece of ch.pieces || []) {
          const { data: pRow, error: pErr } = await supabase
            .from('reading_pieces')
            .insert([
              {
                chapter_id: chRow.id,
                idx: piece.idx,
                passage_title: piece.passage_title || null,
                passage: piece.passage,
              },
            ])
            .select('*')
            .single()
          if (pErr) throw pErr

          for (const q of piece.questions || []) {
            await supabase.from('reading_questions').insert([
              {
                reading_piece_id: pRow.id,
                idx: q.idx,
                question_text: q.question_text,
                options: q.options,
                answer: q.answer,
                explanation: q.explanation || null,
                hint: q.hint || null,
              },
            ])
          }
        }
      } else if (ch.type === 'grammar') {
        for (const q of ch.questions || []) {
          await supabase.from('grammar_questions').insert([
            {
              chapter_id: chRow.id,
              idx: q.idx,
              question_text: q.question_text,
              options: q.options,
              answer: q.answer,
              explanation: q.explanation || null,
              hint: q.hint || null,
            },
          ])
        }
      }
    }

    return NextResponse.json({ ok: true, test_id: testRow.id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
