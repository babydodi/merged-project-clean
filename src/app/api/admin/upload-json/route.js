// src/app/api/admin/upload-json/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Safe App Router POST route to upload a combined test JSON.
 * - Creates Supabase client at runtime (prevents build-time error)
 * - Normalizes different field names (transcript / passage / text, listening_questions / questions, etc.)
 * - Upserts chapters, pieces, and questions
 * - Collects and returns detailed per-chapter errors (message + stack) so the frontend can display exact causes
 *
 * Requirements:
 * - Set env vars in your deployment: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 *   SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY fallback).
 * - Ensure DB unique constraints used in onConflict exist (e.g., test_id+idx, chapter_id+idx, listening_piece_id+idx).
 */

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
    base.raw = ch;
  }
  return base;
}

async function upsertChapterRow(supabase, test_id, ch) {
  const chapterRow = {
    test_id: test_id ?? null,
    idx: ch.idx,
    type: ch.type,
    title: ch.title,
    duration_seconds: ch.duration_seconds
  };

  const { data, error } = await supabase
    .from('chapters')
    .upsert(chapterRow, { onConflict: ['test_id', 'idx'] })
    .select('id')
    .single();

  if (error) throw error;
  return data?.id;
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC fallback) env vars');
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Please send JSON body (Content-Type: application/json)' }, { status: 400 });
    }

    const payload = await request.json();
    if (!payload || !payload.chapters) {
      return NextResponse.json({ error: 'Missing chapters in JSON payload' }, { status: 400 });
    }

    // create supabase client at runtime
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (e) {
      console.error('Supabase client creation error', e);
      return NextResponse.json({ error: 'Server configuration error: missing Supabase env vars', detail: e.message }, { status: 500 });
    }

    const incomingChapters = Array.isArray(payload.chapters) ? payload.chapters : [payload.chapters];
    const normalizedChapters = incomingChapters.map(normalizeChapter);
    const test_id = payload.test_id ?? null;

    const results = { chapters: [], errors: [] };

    for (const ch of normalizedChapters) {
      try {
        const chapterId = await upsertChapterRow(supabase, test_id, ch);

        // listening pieces
        if (ch.type === 'listening') {
          for (const p of ch.pieces || []) {
            const pieceRow = { chapter_id: chapterId, idx: p.idx, audio_url: p.audio_url, transcript: p.transcript };
            const { error: pieceErr } = await supabase.from('listening_pieces').upsert(pieceRow, { onConflict: ['chapter_id', 'idx'] });
            if (pieceErr) throw pieceErr;

            const { data: foundPiece, error: findPieceErr } = await supabase
              .from('listening_pieces')
              .select('id')
              .eq('chapter_id', chapterId)
              .eq('idx', p.idx)
              .limit(1)
              .single();

            if (findPieceErr) throw findPieceErr;
            const listening_piece_id = foundPiece?.id;

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
              const { error: qErr } = await supabase.from('listening_questions').upsert(questionRows, { onConflict: ['listening_piece_id', 'idx'] });
              if (qErr) throw qErr;
            }
          }
        }

        // reading pieces
        if (ch.type === 'reading') {
          for (const p of ch.pieces || []) {
            const pieceRow = { chapter_id: chapterId, idx: p.idx, passage_title: p.passage_title, passage: p.passage };
            const { error: pieceErr } = await supabase.from('reading_pieces').upsert(pieceRow, { onConflict: ['chapter_id', 'idx'] });
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
              const { error: qErr } = await supabase.from('reading_questions').upsert(questionRows, { onConflict: ['reading_piece_id', 'idx'] });
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
            const { error: gErr } = await supabase.from('grammar_questions').upsert(questionRows, { onConflict: ['chapter_id', 'idx'] });
            if (gErr) throw gErr;
          }
        }

        results.chapters.push({ type: ch.type, idx: ch.idx, chapterId });
      } catch (chError) {
        console.error('Chapter processing error:', ch.idx ?? ch.title ?? null, chError);
        results.errors.push({
          chapter: ch.idx ?? ch.title ?? null,
          message: chError?.message ?? String(chError),
          stack: chError?.stack ?? null
        });
        // continue processing next chapters
      }
    }

    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (err) {
    console.error('Upload error', err);
    return NextResponse.json({ error: err?.message ?? String(err), stack: err?.stack ?? null }, { status: 500 });
  }
}
