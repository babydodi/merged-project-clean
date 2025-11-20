// app/api/admin/upload-json/route.js
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/*
  نسخة محدثة من الـ route تدعم جميع الحقول المذكورة في مخطط القاعدة:
  - grammar_questions: category, base_text, underlined_words, underlined_positions, explanation (json)
  - reading_questions: base_text, underlined_words, underlined_positions, explanation (json)
  - listening_questions: explanation (json), hint
  ويتضمن تحقق بسيط من الصيغة وصلاحية المستخدم (admin).
*/

async function requireAdmin(supabase) {
  // يحصل على user من الجلسة ثم يقرأ دوره من جدول users
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) throw new Error("غير مسموح: اليوزر غير مسجل");

  // جلب دور المستخدم من جدول users (أو من ملف metadata إن اعتمدت ذلك)
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) throw new Error("فشل التحقق من صلاحية المستخدم");
  if (!data || data.role !== "admin") throw new Error("غير مسموح: مطلوب دور admin");
}

function ensureArray(x) {
  return Array.isArray(x) ? x : [];
}

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // تحقق صلاحية الـ admin
    await requireAdmin(supabase);

    const body = await req.json();
    const { title, description, availability, is_published, chapters } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: "العنوان مطلوب" }, { status: 400 });
    }
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json({ success: false, error: "chapters يجب أن تكون مصفوفة وغير فارغة" }, { status: 400 });
    }

    // إدراج الاختبار
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

    // تصفح الفصول
    for (const chapter of chapters) {
      const chIdx = typeof chapter.idx === "number" ? chapter.idx : null;
      const chType = chapter.type || null;
      if (!chType) throw new Error("chapter.type مفقود في أحد الفصول");

      // إدراج السجل في جدول chapters
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

      // ===== GRAMMAR =====
      if (chType === "grammar") {
        const questions = ensureArray(chapter.questions);
        for (const q of questions) {
          // احفظ كل الحقول ذات الصلة من المخطط
          const payload = {
            chapter_id: chapterRow.id,
            idx: typeof q.idx === "number" ? q.idx : null,
            question_text: q.question_text || null,
            options: q.options || [],
            answer: q.answer != null ? String(q.answer) : null,
            hint: q.hint || null,
            explanation: q.explanation || null, // يمكن أن يكون { ar, en }
            category: q.category || null,
            base_text: q.base_text || null,
            underlined_words: q.underlined_words || null,
            underlined_positions: q.underlined_positions || null,
          };

          const { error: qError } = await supabase.from("grammar_questions").insert(payload);
          if (qError) throw qError;
        }
      }

      // ===== READING =====
      if (chType === "reading") {
        const pieces = ensureArray(chapter.pieces);
        for (const piece of pieces) {
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

          const questions = ensureArray(piece.questions);
          for (const q of questions) {
            const payload = {
              reading_piece_id: pieceRow.id,
              idx: typeof q.idx === "number" ? q.idx : null,
              question_text: q.question_text || null,
              options: q.options || [],
              answer: q.answer != null ? String(q.answer) : null,
              hint: q.hint || null,
              explanation: q.explanation || null,
              base_text: q.base_text || null,
              underlined_words: q.underlined_words || null,
              underlined_positions: q.underlined_positions || null,
            };
            const { error: qError } = await supabase.from("reading_questions").insert(payload);
            if (qError) throw qError;
          }
        }
      }

      // ===== LISTENING =====
      if (chType === "listening") {
        const pieces = ensureArray(chapter.pieces);
        for (const piece of pieces) {
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

          const questions = ensureArray(piece.questions);
          for (const q of questions) {
            const payload = {
              listening_piece_id: pieceRow.id,
              idx: typeof q.idx === "number" ? q.idx : null,
              question_text: q.question_text || null,
              options: q.options || [],
              answer: q.answer != null ? String(q.answer) : null,
              hint: q.hint || null,
              explanation: q.explanation || null,
            };
            const { error: qError } = await supabase.from("listening_questions").insert(payload);
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
