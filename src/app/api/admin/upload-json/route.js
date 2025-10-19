import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const body = await req.json();
    const { title, description, availability, is_published, chapters } = body;

    if (!title) {
      return NextResponse.json({ error: "العنوان مطلوب" }, { status: 400 });
    }

    // 1. إنشاء الاختبار
    const { data: testRow, error: testError } = await supabase
      .from("tests")
      .insert({
        title,
        description,
        availability: availability || "all",
        is_published: is_published ?? true,
      })
      .select()
      .single();

    if (testError) throw testError;

    // 2. إضافة الفصول
    for (const chapter of chapters) {
      const { data: chapterRow, error: chapterError } = await supabase
        .from("chapters")
        .insert({
          test_id: testRow.id,
          idx: chapter.idx,
          type: chapter.type,
          title: chapter.title,
          duration_seconds: chapter.duration_seconds || null,
        })
        .select()
        .single();

      if (chapterError) throw chapterError;

      // Grammar
      if (chapter.type === "grammar") {
        for (const q of chapter.questions || []) {
          const { error: qError } = await supabase.from("grammar_questions").insert({
            chapter_id: chapterRow.id,
            idx: q.idx,
            question_text: q.question_text,
            options: q.options,
            answer: q.answer,
            hint: q.hint || null,
            explanation: q.explanation || null,
          });
          if (qError) throw qError;
        }
      }

      // Reading
      if (chapter.type === "reading") {
        for (const piece of chapter.pieces || []) {
          const { data: pieceRow, error: pieceError } = await supabase
            .from("reading_pieces")
            .insert({
              chapter_id: chapterRow.id,
              idx: piece.idx,
              passage_title: piece.passage_title,
              passage: piece.passage,
            })
            .select()
            .single();

          if (pieceError) throw pieceError;

          for (const q of piece.questions || []) {
            const { error: qError } = await supabase.from("reading_questions").insert({
              reading_piece_id: pieceRow.id,
              idx: q.idx,
              question_text: q.question_text,
              options: q.options,
              answer: q.answer,
              hint: q.hint || null,
              explanation: q.explanation || null,
            });
            if (qError) throw qError;
          }
        }
      }

      // Listening
      if (chapter.type === "listening") {
        for (const piece of chapter.pieces || []) {
          const { data: pieceRow, error: pieceError } = await supabase
            .from("listening_pieces")
            .insert({
              chapter_id: chapterRow.id,
              idx: piece.idx,
              audio_url: piece.audio_url,
              transcript: piece.transcript,
            })
            .select()
            .single();

          if (pieceError) throw pieceError;

          for (const q of piece.questions || []) {
            const { error: qError } = await supabase.from("listening_questions").insert({
              listening_piece_id: pieceRow.id,
              idx: q.idx,
              question_text: q.question_text,
              options: q.options,
              answer: q.answer,
              hint: q.hint || null,
              explanation: q.explanation || null,
            });
            if (qError) throw qError;
          }
        }
      }
    }

    return NextResponse.json({ success: true, test_id: testRow.id });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
