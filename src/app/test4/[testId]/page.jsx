// TestPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import PropTypes from "prop-types";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function TestPage({ testId, userId }) {
  const [loading, setLoading] = useState(true);
  const [testData, setTestData] = useState(null);
  const [answers, setAnswers] = useState({}); // { "chapter-idx|q-idx": selectedOptionIndexOrValue }
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!testId) return;
    setLoading(true);
    fetchTest(testId)
      .then((data) => setTestData(data))
      .catch((e) => setError("فشل جلب الاختبار"))
      .finally(() => setLoading(false));
  }, [testId]);

  async function fetchTest(id) {
    // افترضنا أن جدول tests يحتوي حقل payload (JSON) مع الهيكل المطلوب
    const { data, error } = await supabase
      .from("tests")
      .select("payload")
      .eq("id", id)
      .single();

    if (error) throw error;
    // payload يمكن أن يكون هيكل الاختبار الكامل
    return data.payload;
  }

  function keyFor(chapterIdx, qIdx) {
    return `${chapterIdx}|${qIdx}`;
  }

  function handleSelect(chapterIdx, qIdx, option) {
    setAnswers((s) => ({ ...s, [keyFor(chapterIdx, qIdx)]: option }));
  }

  function renderUnderlined(baseText, underlinedWords = [], underlinedPositions = []) {
    if (!baseText || !underlinedWords || underlinedWords.length === 0) {
      return <span>{baseText}</span>;
    }

    // تبسيط: نعمل تقسيم للنص ونضع وسم <u> على أول تطابق لكل كلمة في underlinedWords
    let remaining = baseText;
    const nodes = [];
    const used = {}; // track counts for repeated words
    while (remaining.length) {
      let found = null;
      let foundIndex = -1;
      let foundWord = null;

      for (const w of underlinedWords) {
        const regex = new RegExp(`\\b${escapeRegExp(w)}\\b`, "i");
        const m = regex.exec(remaining);
        if (m && (foundIndex === -1 || m.index < foundIndex)) {
          found = m[0];
          foundIndex = m.index;
          foundWord = w;
        }
      }

      if (foundIndex === -1) {
        nodes.push(<span key={nodes.length}>{remaining}</span>);
        break;
      }

      if (foundIndex > 0) {
        nodes.push(<span key={nodes.length}>{remaining.slice(0, foundIndex)}</span>);
      }

      // underline the found
      nodes.push(
        <u key={nodes.length} data-uline={foundWord}>
          {remaining.substr(foundIndex, found.length)}
        </u>
      );
      remaining = remaining.slice(foundIndex + found.length);
    }

    return <span>{nodes}</span>;
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async function handleSubmit() {
    if (!testData) return;
    setSubmitted(true);

    // حساب النتيجة
    let total = 0;
    let correct = 0;
    (testData.chapters || []).forEach((chapter) => {
      if (chapter.type === "grammar") {
        chapter.questions.forEach((q) => {
          total++;
          const key = keyFor(chapter.idx, q.idx);
          const ans = answers[key];
          // مقارنة مباشرة: إذا stored answer هو نفس q.answer (يمكن أن يكون نص أو index)
          if (ans !== undefined && String(ans).trim() === String(q.answer).trim()) {
            correct++;
          }
        });
      } else if (chapter.type === "reading") {
        chapter.pieces.forEach((piece) => {
          piece.questions.forEach((q) => {
            total++;
            const key = keyFor(chapter.idx + "-" + piece.idx, q.idx);
            const ans = answers[key];
            if (ans !== undefined && String(ans).trim() === String(q.answer).trim()) {
              correct++;
            }
          });
        });
      } else if (chapter.type === "listening") {
        chapter.pieces.forEach((piece) => {
          piece.questions.forEach((q) => {
            total++;
            const key = keyFor(chapter.idx + "-" + piece.idx, q.idx);
            const ans = answers[key];
            if (ans !== undefined && String(ans).trim() === String(q.answer).trim()) {
              correct++;
            }
          });
        });
      }
    });

    const percent = total ? Math.round((correct / total) * 100) : 0;
    setScore({ correct, total, percent });

    // حفظ النتائج في جدول responses
    try {
      const payload = {
        test_id: testId,
        user_id: userId || null,
        answers,
        score: { correct, total, percent },
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("responses").insert(payload);
      if (error) {
        console.error("save response error", error);
      }
    } catch (e) {
      console.error(e);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderOptions(chapterIdx, qIdx, q) {
    // options can be array of strings; answer stored as string (we saved q.answer as string in payload)
    return q.options.map((opt, i) => {
      const key = keyFor(chapterIdx, q.idx);
      const selected = answers[key] === opt || answers[key] === i || String(answers[key]) === String(opt);
      return (
        <label key={i} style={{ display: "block", marginBottom: 6 }}>
          <input
            type="radio"
            name={key}
            checked={selected}
            onChange={() => handleSelect(chapterIdx, q.idx, opt)}
          />{" "}
          {opt}
        </label>
      );
    });
  }

  if (loading) return <div>جارٍ تحميل الاختبار...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!testData) return <div>لا يوجد اختبار محمّل.</div>;

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto", fontFamily: "Inter, Arial" }}>
      <h2>{testData.title || "اختبار"}</h2>

      {score && (
        <div style={{ padding: 12, border: "1px solid #ddd", marginBottom: 12, background: "#f7fff7" }}>
          <strong>نتيجتك: {score.correct} من {score.total} — {score.percent}%</strong>
        </div>
      )}

      {testData.chapters.map((chapter) => (
        <section key={chapter.idx} style={{ marginBottom: 28 }}>
          <h3>{chapter.title || chapter.type}</h3>

          {chapter.type === "grammar" &&
            chapter.questions.map((q) => (
              <div key={q.idx} style={{ marginBottom: 18, padding: 12, border: "1px solid #eee" }}>
                <div style={{ marginBottom: 8 }}>
                  <strong>Q{chapter.idx}.{q.idx}:</strong>{" "}
                  <span>{q.question_text || q.base_text}</span>
                </div>

                {q.base_text && (
                  <div style={{ marginBottom: 8 }}>{renderUnderlined(q.base_text, q.underlined_words)}</div>
                )}

                <div>{renderOptions(chapter.idx, q.idx, q)}</div>

                {submitted && (
                  <div style={{ marginTop: 8, background: "#fff9e6", padding: 8 }}>
                    <div><strong>الإجابة الصحيحة:</strong> {q.answer}</div>
                    {q.explanation?.ar && <div style={{ marginTop: 6 }}><strong>شرح:</strong> {q.explanation.ar}</div>}
                  </div>
                )}
              </div>
            ))}

          {chapter.type === "reading" &&
            chapter.pieces.map((piece) => (
              <div key={piece.idx} style={{ marginBottom: 18 }}>
                <h4>{piece.passage_title}</h4>
                <div style={{ whiteSpace: "pre-line", marginBottom: 8 }}>{piece.passage}</div>

                {piece.questions.map((q) => (
                  <div key={q.idx} style={{ padding: 12, border: "1px solid #f0f0f0", marginBottom: 10 }}>
                    <div><strong>Q{chapter.idx}.{piece.idx}.{q.idx}:</strong> {q.question_text}</div>
                    <div style={{ marginTop: 8 }}>{renderOptions(chapter.idx + "-" + piece.idx, q.idx, q)}</div>
                    {submitted && (
                      <div style={{ marginTop: 8, background: "#f0f8ff", padding: 8 }}>
                        <div><strong>الإجابة الصحيحة:</strong> {q.answer}</div>
                        {q.explanation?.ar && <div style={{ marginTop: 6 }}><strong>شرح:</strong> {q.explanation.ar}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

          {chapter.type === "listening" &&
            chapter.pieces.map((piece) => (
              <div key={piece.idx} style={{ marginBottom: 18 }}>
                <h4>Listening {piece.idx}</h4>
                {piece.audio_url && (
                  <audio controls src={piece.audio_url} style={{ width: "100%", marginBottom: 8 }} />
                )}
                {piece.transcript && (
                  <details style={{ marginBottom: 8 }}>
                    <summary>Transcript</summary>
                    <div style={{ whiteSpace: "pre-line", padding: 8 }}>{piece.transcript}</div>
                  </details>
                )}

                {piece.questions.map((q) => (
                  <div key={q.idx} style={{ padding: 12, border: "1px solid #f7f7f7", marginBottom: 10 }}>
                    <div><strong>Q{chapter.idx}.{piece.idx}.{q.idx}:</strong> {q.question_text}</div>
                    <div style={{ marginTop: 8 }}>{renderOptions(chapter.idx + "-" + piece.idx, q.idx, q)}</div>
                    {submitted && (
                      <div style={{ marginTop: 8, background: "#f7fff7", padding: 8 }}>
                        <div><strong>الإجابة الصحيحة:</strong> {q.answer}</div>
                        {q.explanation?.ar && <div style={{ marginTop: 6 }}><strong>شرح:</strong> {q.explanation.ar}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </section>
      ))}

      <div style={{ display: "flex", gap: 12 }}>
        {!submitted ? (
          <button onClick={handleSubmit} style={{ padding: "10px 16px", cursor: "pointer" }}>
            ارسِل الإجابات
          </button>
        ) : (
          <button onClick={() => window.location.reload()} style={{ padding: "10px 16px" }}>
            أعد المحاولة
          </button>
        )}
        <button
          onClick={() => {
            // export answers JSON للتحميل محليًا
            const blob = new Blob([JSON.stringify({ testId, answers }, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `answers_${testId}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{ padding: "10px 12px" }}
        >
          تنزيل الإجابات (JSON)
        </button>
      </div>
    </div>
  );
}

TestPage.propTypes = {
  testId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
