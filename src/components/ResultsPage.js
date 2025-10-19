import React, { useState } from 'react';
import { Home, CheckCircle, XCircle, Eye, EyeOff, Trophy, Target } from 'lucide-react';
import { Button } from './ui/button';

export default function ResultsPage({ scores, wrongAnswers, answers, navigate }) {
  const [showWrongs, setShowWrongs] = useState(false);

  const getPerformanceLevel = (score) => {
    if (score >= 90) return { text: 'Excellent | ممتاز', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (score >= 70) return { text: 'Good | جيد', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= 50) return { text: 'Fair | مقبول', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { text: 'Needs Improvement | يحتاج تحسين', color: 'text-rose-600', bg: 'bg-rose-50' };
  };

  const performance = getPerformanceLevel(scores.total);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-slate-900">Test Results | نتائج الاختبار</h1>
            </div>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="border-slate-300"
              data-testid="home-button"
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overall Score */}
        <div className={`${performance.bg} border-2 border-${performance.color.split('-')[1]}-200 rounded-xl p-8 mb-8 text-center`}>
          <div className="flex items-center justify-center gap-3 mb-4">
            <Target className={`w-12 h-12 ${performance.color}`} />
          </div>
          <h2 className="text-5xl font-bold text-slate-900 mb-2">{scores.total}<span className="text-3xl text-slate-600">/100</span></h2>
          <p className={`text-xl font-semibold ${performance.color}`}>{performance.text}</p>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Listening */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Listening</h3>
              <div className="text-3xl font-bold text-blue-600">{scores.listening}</div>
            </div>
            <div className="text-sm text-slate-600 mb-2">استماع</div>
            <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full"
                style={{ width: `${(scores.listening / 20) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Out of 20</p>
          </div>

          {/* Reading */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Reading</h3>
              <div className="text-3xl font-bold text-emerald-600">{scores.reading}</div>
            </div>
            <div className="text-sm text-slate-600 mb-2">قراءة</div>
            <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-full"
                style={{ width: `${(scores.reading / 40) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Out of 40</p>
          </div>

          {/* Grammar */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Grammar</h3>
              <div className="text-3xl font-bold text-slate-600">{scores.grammar}</div>
            </div>
            <div className="text-sm text-slate-600 mb-2">قواعد</div>
            <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-slate-600 h-full"
                style={{ width: `${(scores.grammar / 40) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Out of 40</p>
          </div>
        </div>

        {/* Wrong Answers Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <XCircle className="w-6 h-6 text-rose-600" />
              Review Mistakes | مراجعة الأخطاء
            </h3>
            {wrongAnswers.length > 0 && (
              <Button
                onClick={() => setShowWrongs(!showWrongs)}
                className="bg-slate-600 hover:bg-slate-700 text-white"
                data-testid="toggle-wrong-answers"
              >
                {showWrongs ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide | إخفاء
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Show | عرض
                  </>
                )}
              </Button>
            )}
          </div>

          {wrongAnswers.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-emerald-700">Perfect! No mistakes.</p>
              <p className="text-slate-600 rtl mt-1">ممتاز! لا توجد أخطاء.</p>
            </div>
          ) : (
            <div>
              <p className="text-slate-600 mb-4">
                You got {wrongAnswers.length} question{wrongAnswers.length > 1 ? 's' : ''} wrong. Review them below to improve.
              </p>
              <p className="text-slate-600 mb-6 rtl">
                لديك {wrongAnswers.length} {wrongAnswers.length > 1 ? 'أسئلة' : 'سؤال'} خاطئ. راجعها أدناه للتحسين.
              </p>

              {showWrongs && (
                <div className="space-y-4" data-testid="wrong-answers-list">
                  {wrongAnswers.map((q, i) => (
                    <div key={q.id} className="bg-rose-50 border border-rose-200 rounded-lg p-5">
                      <p className="font-semibold text-slate-900 mb-3">
                        <span className="text-rose-600">Q{i + 1}:</span> {q.question_text}
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-rose-700">Your Answer:</span>
                            <span className="ml-2 text-slate-700">{answers[q.id]}</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-emerald-700">Correct Answer:</span>
                            <span className="ml-2 text-slate-700">{q.answer}</span>
                          </div>
                        </div>
                        {q.explanation && (
                          <div className="mt-3 pt-3 border-t border-rose-200">
                            <p className="font-medium text-slate-900 mb-1">Explanation:</p>
                            <p className="text-slate-700">
                              {q.explanation.en || q.explanation.ar || 'No explanation available.'}
                            </p>
                            {q.explanation.ar && q.explanation.en && (
                              <p className="text-slate-700 mt-2 rtl">{q.explanation.ar}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
