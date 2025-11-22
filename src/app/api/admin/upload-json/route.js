// src/app/api/admin/upload-json/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function ensureArray(x) { return Array.isArray(x) ? x : []; }
function pick(obj, keys) { const out = {}; for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k]; return out; }

function normalizeListeningQuestion(q) {
  return {
    idx: q.idx ?? null,
    question_text: q.question_text ?? q.text ?? '',
    options: ensureArray(q.options),
    answer: q.answer != null ? q.answer : null,
    hint: q.hint ?? null,
    explanation: q.explanation ?? null
  };
}
function normalizeReadingQuestion(q) {
  return {
    idx: q.idx ?? null,
    question_text: q.question_text ?? q.text ?? '',
    options: ensureArray(q.options),
    answer: q.answer != null ? q.answer : null,
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
    options: ensureArray(q.options),
    answer: q.answer != null ? q.answer : null,
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
    passage_paragraphs: Array.isArray(piece.passage_paragraphs) ? piece.passage_paragraphs : null,
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
  if (ch.type === 'listening') base.pieces = ensureArray(ch.pieces).map(normalizeListeningPiece);
  else if (ch.type === 'reading') base.pieces = ensureArray(ch.pieces).map(normalizeReadingPiece);
  else if (ch.type === 'grammar') base.questions = ensureArray(ch.questions).map(normalizeGrammarQuestion);
  else base.raw = ch;
  return base;
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC fallback) env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function ensureTestRow(supabase, testPayload) {
  if (!testPayload) return null;
  const testRow = {
    title: testPayload.title ?? 'اختبار بدون عنوان',
    description: testPayload.description ?? null,
    availability: testPayload.availability ?? 'all',
    is_published: testPayload.is_published ?? false
  };
  const { data, error } = await supabase
    .from('tests')
    .insert(testRow)
    .select('id')
    .single();
  if (error) throw error;
  return data?.id ?? null;
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
  return data?.id ?? null;
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

    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (e) {
      return NextResponse.json({ error: 'Server configuration error: missing Supabase env vars', detail: e.message }, { status: 500 });
    }

    const incomingChapters = Array.isArray(payload.chapters) ? payload.chapters : [payload.chapters];
    const normalizedChapters = incomingChapters.map(normalizeChapter);

    // test handling: prefer provided test_id, otherwise create test from payload.test
    let test_id = payload.test_id ?? null;
    let createdTestId = null;
    if (!test_id && payload.test) {
      createdTestId = await ensureTestRow(supabase, payload.test);
      test_id = createdTestId;
    }

    const results = { chapters: [], errors: [] };
    if (createdTestId) results.testId = createdTestId;

    // allowed columns per table (match your DB schema)
    const LISTENING_PIECE_COLS = ['chapter_id', 'idx', 'audio_url', 'transcript'];
    const LISTENING_QUESTION_COLS = ['listening_piece_id', 'idx', 'question_text', 'options', 'answer', 'hint', 'explanation'];
    const READING_PIECE_COLS = ['chapter_id', 'idx', 'passage_title', 'passage'];
    const READING_QUESTION_COLS = ['reading_piece_id', 'idx', 'question_text', 'options', 'answer', 'hint', 'explanation', 'base_text', 'underlined_words', 'underlined_positions'];
    const GRAMMAR_QUESTION_COLS = ['chapter_id', 'idx', 'question_text', 'options', 'answer', 'hint', 'explanation', 'category', 'base_text', 'underlined_words', 'underlined_positions'];

    for (const ch of normalizedChapters) {
      try {
        const chapterId = await upsertChapterRow(supabase, test_id, ch);

        // LISTENING
        if (ch.type === 'listening') {
          for (const p of ch.pieces || []) {
            const pieceRow = pick({ chapter_id: chapterId, ...p }, LISTENING_PIECE_COLS);
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
            const listening_piece_id = foundPiece?.id ?? null;

            const questionRows = (p.listening_questions || []).map(q => {
              const normalized = normalizeListeningQuestion(q);
              return pick({ listening_piece_id, ...normalized }, LISTENING_QUESTION_COLS);
            });
            if (questionRows.length) {
              const { error: qErr } = await supabase.from('listening_questions').upsert(questionRows, { onConflict: ['listening_piece_id', 'idx'] });
              if (qErr) throw qErr;
            }
          }
        }

        // READING (convert passage_paragraphs -> passage string before upsert)
        if (ch.type === 'reading') {
          for (const p of ch.pieces || []) {
            const normalizedPiece = normalizeReadingPiece(p);

            let passageValue = normalizedPiece.passage;
            if (normalizedPiece.passage_paragraphs && Array.isArray(normalizedPiece.passage_paragraphs) && normalizedPiece.passage_paragraphs.length) {
              passageValue = normalizedPiece.passage_paragraphs
                .map((pp, idx) => {
                  const num = pp.num ?? (idx + 1);
                  return `${num}. ${pp.text}`;
                })
                .join('\n\n');
            }

            const pieceRow = pick({
              chapter_id: chapterId,
              idx: normalizedPiece.idx,
              passage_title: normalizedPiece.passage_title,
              passage: passageValue
            }, READING_PIECE_COLS);

            const { error: pieceErr } = await supabase.from('reading_pieces').upsert(pieceRow, { onConflict: ['chapter_id', 'idx'] });
            if (pieceErr) throw pieceErr;

            const { data: foundPiece, error: findPieceErr } = await supabase
              .from('reading_pieces')
              .select('id')
              .eq('chapter_id', chapterId)
              .eq('idx', normalizedPiece.idx)
              .limit(1)
              .single();
            if (findPieceErr) throw findPieceErr;
            const reading_piece_id = foundPiece?.id ?? null;

            const questionRows = (normalizedPiece.reading_questions || []).map(q => {
              const normalized = normalizeReadingQuestion(q);
              return pick({ reading_piece_id, ...normalized }, READING_QUESTION_COLS);
            });
            if (questionRows.length) {
              const { error: qErr } = await supabase.from('reading_questions').upsert(questionRows, { onConflict: ['reading_piece_id', 'idx'] });
              if (qErr) throw qErr;
            }
          }
        }

        // GRAMMAR
        if (ch.type === 'grammar') {
          const questionRows = (ch.questions || []).map(q => {
            const normalized = normalizeGrammarQuestion(q);
            return pick({ chapter_id: chapterId, ...normalized }, GRAMMAR_QUESTION_COLS);
          });
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
      }
    }

    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (err) {
    console.error('Upload error', err);
    return NextResponse.json({ error: err?.message ?? String(err), stack: err?.stack ?? null }, { status: 500 });
  }
}
