import React, { useState } from 'react';
import { X, Lightbulb, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

export default function HintModal({ question, onClose }) {
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4" data-testid="hint-modal">
      <div className="modal-content bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-slate-900">Hint & Answer</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            data-testid="close-hint-modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-900 font-medium">تنبيه | Warning</p>
              <p className="text-sm text-amber-800 mt-1">
                Using hints frequently may affect your learning progress.
              </p>
              <p className="text-sm text-amber-800 rtl">
                استخدام التلميحات بكثرة قد يؤثر على تقدمك في التعلم.
              </p>
            </div>
          </div>

          {/* Hint Section */}
          {!showHint ? (
            <Button
              onClick={() => setShowHint(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
              data-testid="reveal-hint-button"
            >
              Reveal Hint | إظهار التلميح
            </Button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Hint:
              </p>
              <p className="text-blue-800">{question?.hint || 'No hint available. | لا يوجد تلميح.'}</p>
            </div>
          )}

          {/* Answer Section */}
          {showHint && !showAnswer && (
            <Button
              onClick={() => setShowAnswer(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3"
              data-testid="reveal-answer-button"
            >
              Reveal Answer | إظهار الإجابة
            </Button>
          )}

          {showAnswer && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Correct Answer | الإجابة الصحيحة:
                </p>
                <p className="text-emerald-800 text-lg font-medium">{question?.answer}</p>
              </div>

              {question?.explanation && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="font-semibold text-slate-900 mb-2">Explanation | الشرح:</p>
                  <p className="text-slate-700">
                    {question.explanation.en || question.explanation.ar || 'No explanation available.'}
                  </p>
                  {question.explanation.ar && question.explanation.en && (
                    <p className="text-slate-700 mt-2 rtl">
                      {question.explanation.ar}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-slate-300 py-3"
            data-testid="close-button"
          >
            Close | إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}
