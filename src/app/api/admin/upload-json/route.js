// app/api/admin/upload-json/route.js
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/*
  Route محسّن لاستقبال:
  - body.chapters: [ ... ]  (الأمثل)
  - أو body.grammar_chapters, body.reading_chapters, body.listening_chapters (منفصل)
  - أو body.chapter (كائن واحد) أو body (كائن فصل وحيد)
  يقوم بتطبيع المدخلات إلى مصفوفة chapters ثم يدخلها في DB.
*/

async function requireAdmin(supabase) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) throw new Error("غير مسموح: اليوزر غير مسجل");

  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) throw new Error("فشل التحقق من صلاحية المستخدم");
  if (!data || data.role !== "admin") throw new Error("غير مسموح: مطلوب دور admin");
}

const ensureArray = (x) => (Array.isArray(x) ? x : []);

// محاولة كشف ما إذا كان كائن يمثل فصل (chapter)
const looksLikeChapter = (obj) => {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj);
  // فصل عادة يحتوي على نوع أو أسئلة أو pieces أو idx أو title
  return (
    keys.includes("type") ||
    keys.includes("questions") ||
    keys.includes("pieces") ||
    keys.includes("idx") ||
    keys.includes("title")
  );
};

// تطبيع فصل: ضمان وجود type و idx وأشياء افتراضية بسيطة
const normalizeChapter = (ch) => {
  const chapter = { ...ch };
  if (!chapter.type) {
    if (Array.isArray(chapter.questions)) chapter.type = "grammar";
    else if (Array.isArray(chapter.pieces)) {
      // إذا يحتوي على pieces قد يكون reading أو listening
      // نحاول تخمين بحسب وجود audio_url أو passage داخل pieces[0]
      const firstPiece = Array.isArray(chapter.pieces) ? chapter.pieces[0] : null;
      if (firstPiece && (firstPiece.audio_url || firstPiece.transcript)) chapter.type = "listening";
      else chapter.type = "reading";
    } else {
      chapter.type = "unknown";
    }
  }
  chapter.idx = typeof chapter.idx === "number" ? chapter.idx : null;
  chapter.title = chapter.title || null;
  chapter.duration_seconds = typeof chapter.duration_seconds === "number" ? chapter.duration_seconds : null;
  return chapter;
};

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // تحقق صلاحية admin
    await requireAdmin(supabase);

    const body = await req.json();

    // التحقق السطحي للحقل العنوان لضمان أننا نتعامل مع طلب صحيح
    const { title, description, availability, is_published } = body;
    if (!title) {
      return NextResponse.json({ success: false, error: "العنوان (title) مطلوب في جذر الـ JSON" }, { status: 400 });
    }

    // نقاط احتمال استقبال الفصول:
    // 1) body.chapters (مصطفى) - الأفضل
    // 2) body.grammar_chapters / reading_chapters / listening_chapters (منفصل)
    // 3) body.chapter (كائن مفرد)
    // 4) body نفسه قد يكون فصل مفرد (لو العميل أرسل فصل بدون مفتاح)

    let chapters = [];

    // 1) chapters مباشرة
    if (Array.isArray(body.chapters) && body.chapters.length) {
      chapters = body.chapters;
    } else {
      // 2) الفصول المنفصلة الثلاث (قد تكون غير موجودة)
      const g = ensureArray(body.grammar_chapters);
      const r = ensureArray(body.reading_chapters);
      const l = ensureArray(body.listening_chapters);

      if (g.length || r.length || l.length) {
        chapters = [...g, ...r, ...l];
      } else if (body.chapter && typeof body.chapter === "object") {
        // 3) chapter مفرد
        chapters = [body.chapter];
      } else {
        // 4) ربما body نفسه هو فصل واحد (لو تم إرسال فصل بدون envelope)
        if (looksLikeChapter(body)) {
          // ولكن تأكد أننا لا نخلط مع الحقول العامة مثل title/description
          // إذا body يحتوي حقول فصل ويتم إرسال مع title الأعلى فذلك غير متوقع، نسمح به فقط إن كان شكل body فصل فقط (بلا title في root)
          // هنا نأخذ قرار مرن: إذا body يحتوي على questions أو pieces نعتبره فصلًا
          if (Array.isArray(body.questions) || Array.isArray(body.pieces)) {
            chapters = [body];
          }
        }
      }
    }

    // إن لم نجد أي chapters، نرجع خطأ واضح
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "لا توجد فصول (chapters) صالحة في الطلب. تأكد من إرسال أحد الحقول: chapters (array) أو grammar_chapters/reading_chapters/listening_chapters أو chapter واحد",
        },
        { status: 400 }
      );
    }

    // تطبيع: كل فصل يجب أن يصبح كائن مناسب، ونتأكد من وجود questions أو pieces في النهاية
    const normalized = chapters.map(normalizeChapter);

    // فلترة الفصول الفارغة (لا تحتوي questions أو pieces)
    const filtered = normalized.filter((c) => {
      const hasQuestions = Array.isArray(c.questions) && c.questions.length > 0;
      const hasPieces = Array.isArray(c.pieces) && c.pieces.length > 0;
      return hasQuestions || hasPieces;
    });

    if (filtered.length === 0) {
      return NextResponse.json(
        { success: false, error: "بعد التطبيع لم نجد فصولاً تحتوي على questions أو pieces. تحقق من بنية الفصول." },
        { status: 400 }
      );
    }

    // إدراج الاختبار (tests table)
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

    // إدراج الفصول والأسئلة
    for (const ch of filtered) {
      const { data: chapterRow, error: chapterError } = await supabase
        .from("chapters")
        .insert({
          test_id: testRow.id,
          idx: ch.idx,
          type: ch.type,
          title: ch.title || null,
          duration_seconds: ch.duration_seconds || null,
        })
        .select()
        .single();

      if (chapterError) throw chapterError;

      // إذا الفصل يحتوي على questions (grammar / some reading questions)
      if (Array.isArray(ch.questions) && ch.questions.length) {
        for (const q of ch.questions) {
          const payload = {
            chapter_id: chapterRow.id,
            idx: typeof q.idx === "number" ? q.idx : null,
            question_text: q.question_text || q.text || null,
            options: Array.isArray(q.options) ? q.options : q.options ? [q.options] : [],
            answer: q.answer != null ? String(q.answer) : null,
            hint: q.hint || null,
            explanation: q.explanation || null,
            category: q.category || null,
            base_text: q.base_text || null,
            underlined_words: q.underlined_words || null,
            underlined_positions: q.underlined_positions || null,
          };

          const { error: qError } = await supabase.from("grammar_questions").insert(payload);
          if (qError) throw qError;
        }
      }

      // إذا الفصل يحتوي على pieces (reading/listening)
      if (Array.isArray(ch.pieces) && ch.pieces.length) {
        for (const piece of ch.pieces) {
          // إدراج القطعة أولاً
          const piecePayload = {
            chapter_id: chapterRow.id,
            idx: typeof piece.idx === "number" ? piece.idx : null,
            passage_title: piece.passage_title || piece.title || null,
            passage: piece.passage || null,
            audio_url: piece.audio_url || null,
            transcript: piece.transcript || null,
          };

          const { data: pieceRow, error: pieceError } = await supabase
            .from("reading_pieces")
            .insert(piecePayload)
            .select()
            .single();

          if (pieceError) throw pieceError;

          // ثم إدراج أسئلة القطعة إن وُجدت
          if (Array.isArray(piece.questions) && piece.questions.length) {
            for (const q of piece.questions) {
              const payload = {
                reading_piece_id: pieceRow.id,
                idx: typeof q.idx === "number" ? q.idx : null,
                question_text: q.question_text || q.text || null,
                options: Array.isArray(q.options) ? q.options : q.options ? [q.options] : [],
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
      }

      // إذا فصل استماع (listening) وكنت تُدخِله في جدول listening_pieces بدلاً من reading_pieces
      // هنا نُعيد استخدام reading_pieces لسهولة؛ إن أردت فصلًا واضحًا يمكنك تعديل لإنشاء listening_pieces.
    }

    return NextResponse.json({ success: true, test_id: testRow.id });
  } catch (err) {
    console.error("Upload-json route error:", err);
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
