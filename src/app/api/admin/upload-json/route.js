// app/api/admin/upload-json/route.js
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const body = await req.json();
    const { title, description, availability, is_published, chapters } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: "العنوان مطلوب" }, { status: 400 });
    }
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json({ success: false, error: "chapters يجب أن تكون مصفوفة وغير فارغة" }, { status: 400 });
    }

    // 1) إدراج الاختبار
    const { data: testRow, error: testError } = await supabase
      .from("tests")
      .insert({
        title,
        description: description || null,
        availability: availability || "all",
        is_published: is_published ?? true,
      })
      .select()
      .single();

    if (testError) throw testError;

    // 2) لكل فصل — إدراج الفصل ثم محتوياته بحسب النوع
    for (const chapter of chapters) {
      // تأكد من الحقول الأساسية
      const chIdx = typeof chapter.idx === "number" ? chapter.idx : null;
      const chType = chapter.type || null;
      if (!chType) throw new Error("chapter.type مفقود في أحد الفصول");

      const { data: chapterRow, error: chapterError } = await supabase
        .from("chapters")
        .insert({
          test_id: testRow.id,
          idx: chIdx,
          type: chType,
          title: chapter.title || null,
          duration_seconds: chapter.duration_seconds ?? null,
        })
        .select()
        .single();

      if (chapterError) throw chapterError;

      // GRAMMAR
      if (chType === "grammar") {
        for (const q of chapter.questions || []) {
          const { error: qError } = await supabase.from("grammar_questions").insert({
            chapter_id: chapterRow.id,
            idx: typeof q.idx === "number" ? q.idx : null,
            question_text: q.question_text || null,
            options: q.options || [], // jsonb
            answer: q.answer != null ? String(q.answer) : null,
            explanation: q.explanation || null, // can be object or text
            hint: q.hint || null,
            category: q.category || null,
            base_text: q.base_text || null,
            underlined_words: q.underlined_words || null, // jsonb or null
            underlined_positions: q.underlined_positions || null, // jsonb or null
          });
          if (qError) throw qError;
        }
      }

      // READING
      if (chType === "reading") {
        for (const piece of chapter.pieces || []) {
          const { data: pieceRow, error: pieceError } = await supabase
            .from("reading_pieces")
            .insert({
              chapter_id: chapterRow.id,
              idx: typeof piece.idx === "number" ? piece.idx : null,
              passage_title: piece.passage_title || null,
              passage: piece.passage || null,
            })
            .select()
            .single();

          if (pieceError) throw pieceError;

          for (const q of piece.questions || []) {
            const { error: qError } = await supabase.from("reading_questions").insert({
              reading_piece_id: pieceRow.id,
              idx: typeof q.idx === "number" ? q.idx : null,
              question_text: q.question_text || null,
              options: q.options || [],
              answer: q.answer != null ? String(q.answer) : null,
              explanation: q.explanation || null,
              hint: q.hint || null,
              base_text: q.base_text || null,
              underlined_words: q.underlined_words || null,
              underlined_positions: q.underlined_positions || null,
            });
            if (qError) throw qError;
          }
        }
      }

      // LISTENING
      if (chType === "listening") {
        for (const piece of chapter.pieces || []) {
          const { data: pieceRow, error: pieceError } = await supabase
            .from("listening_pieces")
            .insert({
              chapter_id: chapterRow.id,
              idx: typeof piece.idx === "number" ? piece.idx : null,
              audio_url: piece.audio_url || null,
              transcript: piece.transcript || null,
            })
            .select()
            .single();

          if (pieceError) throw pieceError;

          for (const q of piece.questions || []) {
            const { error: qError } = await supabase.from("listening_questions").insert({
              listening_piece_id: pieceRow.id,
              idx: typeof q.idx === "number" ? q.idx : null,
              question_text: q.question_text || null,
              options: q.options || [],
              answer: q.answer != null ? String(q.answer) : null,
              explanation: q.explanation || null,
              hint: q.hint || null,
            });
            if (qError) throw qError;
          }
        }
      }
    }

    return NextResponse.json({ success: true, test_id: testRow.id });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
