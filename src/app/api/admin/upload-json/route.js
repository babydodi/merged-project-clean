// pages/api/upload-json.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

function ensureArray(x) {
  return Array.isArray(x) ? x : [];
}

function normalizeListeningQuestion(q) {
  return {
    idx: q.idx ?? null,
    question_text: q.question_text ?? q.text ?? '',
    options: ensureArray(q.options).map(String),
    answer: q.answer != null ? String(q.answer) : null,
    hint: q.hint ?? null,
    explanation: q.explanation ?? null,
    base_text: q.base_text ?? null,
    underlined_words: ensureArray(q.underlined_words),
    underlined_positions: ensureArray(q.underlined_positions)
  };
}

function normalizeReadingQuestion(q) {
  return {
    idx: q.idx ?? null,
    question_text: q.question_text ?? q.text ?? '',
    options: ensureArray(q.options).map(String),
    answer: q.answer != null ? String(q.answer) : null,
    hint: q.hint ?? null,
    explanation: q.explanation ?? null,
    base_text: q.base_text ?? null,
    underlined_words: ensureArray(q.underlined_words),
    underlined_positions: ensureArray(q.underlined_positions)
  };
}

function normalizeGrammarQuestion(q) {
  return {
    idx: q.idx ?? null,
    question_text: q.question_text ?? q.text ?? '',
    options: ensureArray(q.options).map(String),
    answer: q.answer != null ? String(q.answer) : null,
    hint: q.hint ?? null,
    explanation: q.explanation ?? null,
    category: q.category ?? null,
    base_text: q.base_text ?? null,
    underlined_words: ensureArray(q.underlined_words),
    underlined_positions: ensureArray(q.underlined_positions)
  };
}

function normalizeListeningPiece(piece) {
  return {
    idx: piece.idx ?? null,
    audio_url: piece.audio_url ?? piece.audio ?? null,
    // prefer transcript, fallback to passage/text for compatibility
    transcript: piece.transcript ?? piece.passage ?? piece.text ?? null,
    listening_questions: ensureArray(piece.listening_questions || piece.questions).map(normalizeListeningQuestion)
  };
}

function normalizeReadingPiece(piece) {
  return {
    idx: piece.idx ?? null,
    passage_title: piece.passage_title ?? piece.title ?? null,
    passage: piece.passage ?? piece.transcript ?? piece.text ?? null,
    reading_questions: ensureArray(piece.reading_questions || piece.questions).map(normalizeReadingQuestion)
  };
}

function normalizeChapter(ch) {
  const base = {
    idx: ch.idx ?? null,
    type: ch.type ?? null,
    title: ch.title ?? null,
    duration_seconds: ch.duration_seconds ?? null
  };

  if (ch.type === 'listening') {
    base.pieces = ensureArray(ch.pieces).map(normalizeListeningPiece);
  } else if (ch.type === 'reading') {
    base.pieces = ensureArray(ch.pieces).map(normalizeReadingPiece);
  } else if (ch.type === 'grammar') {
    base.questions = ensureArray(ch.questions).map(normalizeGrammarQuestion);
  } else {
    // unknown type — keep raw
    base.raw = ch;
  }
  return base;
}

// helper: upsert chapter row and return chapter id
async function upsertChapterRow(test_id, ch) {
  // adjust fields to match your DB schema for chapters table
  const chapterRow = {
    test_id: test_id ?? null,
    idx: ch.idx,
    type: ch.type,
    title: ch.title,
    duration_seconds: ch.duration_seconds
  };

  // onConflict: choose a suitable unique constraint; here we use test_id + idx
  const { data, error } = await supabase
    .from('chapters')
    .upsert(chapterRow, { onConflict: ['test_id', 'idx'] })
    .select('id')
    .single();

  if (error) throw error;
  return data?.id;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // parse body: accept JSON body or raw file upload that contains JSON
    let payload;
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      payload = req.body;
    } else {
      // if using form-data file upload, next.js pages API does not parse it by default.
      // require client to send JSON content-type.
      return res.status(400).json({ error: 'Please send JSON body (Content-Type: application/json)' });
    }

    if (!payload || !payload.chapters) {
      return res.status(400).json({ error: 'Missing chapters in JSON payload' });
    }

    // normalize top-level chapters array
    const incomingChapters = Array.isArray(payload.chapters) ? payload.chapters : [payload.chapters];
    const normalizedChapters = incomingChapters.map(normalizeChapter);

    // optional: test_id to attach chapters (you can include test_id at top-level)
    const test_id = payload.test_id ?? null;

    const results = {
      chapters: [],
      errors: []
    };

    // process each chapter sequentially (you may parallelize if needed)
    for (const ch of normalizedChapters) {
      try {
        // upsert chapter row and obtain chapter id
        const chapterId = await upsertChapterRow(test_id, ch);

        // listening pieces
        if (ch.type === 'listening') {
          for (const p of ch.pieces || []) {
            // build listening_pieces row
            const pieceRow = {
              chapter_id: chapterId,
              idx: p.idx,
              audio_url: p.audio_url,
              transcript: p.transcript
            };

            // upsert piece (use unique on chapter_id + idx)
            const { error: pieceErr } = await supabase
              .from('listening_pieces')
              .upsert(pieceRow, { onConflict: ['chapter_id', 'idx'] });

            if (pieceErr) throw pieceErr;

            // fetch the piece id (needed to upsert questions)
            const { data: foundPiece, error: findPieceErr } = await supabase
              .from('listening_pieces')
              .select('id')
              .eq('chapter_id', chapterId)
              .eq('idx', p.idx)
              .limit(1)
              .single();

            if (findPieceErr) throw findPieceErr;
            const listening_piece_id = foundPiece?.id;

            // prepare question rows
            const questionRows = (p.listening_questions || []).map(q => ({
              listening_piece_id,
              idx: q.idx,
              question_text: q.question_text,
              options: q.options,
              answer: q.answer,
              hint: q.hint,
              explanation: q.explanation,
              base_text: q.base_text,
              underlined_words: q.underlined_words,
              underlined_positions: q.underlined_positions
            }));

            if (questionRows.length) {
              const { error: qErr } = await supabase
                .from('listening_questions')
                .upsert(questionRows, { onConflict: ['listening_piece_id', 'idx'] });
              if (qErr) throw qErr;
            }
          }
        }

        // reading pieces
        if (ch.type === 'reading') {
          for (const p of ch.pieces || []) {
            const pieceRow = {
              chapter_id: chapterId,
              idx: p.idx,
              passage_title: p.passage_title,
              passage: p.passage
            };

            const { error: pieceErr } = await supabase
              .from('reading_pieces')
              .upsert(pieceRow, { onConflict: ['chapter_id', 'idx'] });

            if (pieceErr) throw pieceErr;

            const { data: foundPiece, error: findPieceErr } = await supabase
              .from('reading_pieces')
              .select('id')
              .eq('chapter_id', chapterId)
              .eq('idx', p.idx)
              .limit(1)
              .single();

            if (findPieceErr) throw findPieceErr;
            const reading_piece_id = foundPiece?.id;

            const questionRows = (p.reading_questions || []).map(q => ({
              reading_piece_id,
              idx: q.idx,
              question_text: q.question_text,
              options: q.options,
              answer: q.answer,
              hint: q.hint,
              explanation: q.explanation,
              base_text: q.base_text,
              underlined_words: q.underlined_words,
              underlined_positions: q.underlined_positions
            }));

            if (questionRows.length) {
              const { error: qErr } = await supabase
                .from('reading_questions')
                .upsert(questionRows, { onConflict: ['reading_piece_id', 'idx'] });
              if (qErr) throw qErr;
            }
          }
        }

        // grammar questions
        if (ch.type === 'grammar') {
          const questionRows = (ch.questions || []).map(q => ({
            chapter_id: chapterId,
            idx: q.idx,
            question_text: q.question_text,
            options: q.options,
            answer: q.answer,
            hint: q.hint,
            explanation: q.explanation,
            category: q.category,
            base_text: q.base_text,
            underlined_words: q.underlined_words,
            underlined_positions: q.underlined_positions
          }));

          if (questionRows.length) {
            const { error: gErr } = await supabase
              .from('grammar_questions')
              .upsert(questionRows, { onConflict: ['chapter_id', 'idx'] });
            if (gErr) throw gErr;
          }
        }

        results.chapters.push({ type: ch.type, idx: ch.idx, chapterId });
      } catch (chError) {
        console.error('Chapter processing error', ch, chError);
        results.errors.push({ chapter: ch.idx ?? ch.title ?? null, error: chError.message ?? String(chError) });
      }
    }

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error('Upload error', err);
    return res.status(500).json({ error: err.message ?? String(err) });
  }
}
