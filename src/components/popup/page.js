"use client";
import { useState } from "react";

export default function HintPopup({ question, onClose }) {
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
        <h2 className="text-lg font-bold mb-2">💡 Hint</h2>
        <p className="text-sm text-gray-700 mb-4">
          لا يفضل تستعمل هالميزة بكثرة عشان ما تأثر على تدريبك وتعلمك
        </p>

        {!showHint && (
          <button
            onClick={() => setShowHint(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded mb-2"
          >
            Reveal Hint
          </button>
        )}

        {showHint && (
          <div className="mb-4">
            <p className="text-gray-800">{question.hint}</p>
          </div>
        )}

        {showHint && !showAnswer && (
          <button
            onClick={() => setShowAnswer(true)}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Reveal Answer
          </button>
        )}

        {showAnswer && (
          <div className="mt-4">
            <p className="font-bold text-gray-900">✅ الإجابة: {question.answer}</p>
            {question.explanation && (
              <pre className="bg-gray-100 p-2 rounded text-sm mt-2">
                {JSON.stringify(question.explanation, null, 2)}
              </pre>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 px-4 py-2 bg-gray-400 text-white rounded"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}
