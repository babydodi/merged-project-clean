'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function AdminPage() {
  const [testTitle, setTestTitle] = useState('');
  const [testDescription, setTestDescription] = useState('');
  const [listeningQuestions, setListeningQuestions] = useState([]);
  const [readingPassages, setReadingPassages] = useState([]);
  const [grammarQuestions, setGrammarQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('listening');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // معالجة رفع ملف JSON
  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target.result);
          if (type === 'listening') {
            setListeningQuestions(content);
          } else if (type === 'reading') {
            setReadingPassages(content);
          } else if (type === 'grammar') {
            setGrammarQuestions(content);
          }
        } catch (error) {
          alert('خطأ: الملف ليس بصيغة JSON صحيحة');
          console.error(error);
        }
      };
      reader.readAsText(file);
    }
  };

  // معالجة تغيير محتوى السؤال مباشرة
  const handleQuestionChange = (e, type, index, field) => {
    let newQuestions;
    const value = e.target.value;
    if (type === 'listening') {
      newQuestions = [...listeningQuestions];
      newQuestions[index][field] = value;
      setListeningQuestions(newQuestions);
    } else if (type === 'reading') {
      newQuestions = [...readingPassages];
      newQuestions[index][field] = value;
      setReadingPassages(newQuestions);
    } else if (type === 'grammar') {
      newQuestions = [...grammarQuestions];
      newQuestions[index][field] = value;
      setGrammarQuestions(newQuestions);
    }
  };

  // إضافة سؤال جديد
  const addQuestion = (type) => {
    if (type === 'listening') {
      setListeningQuestions([...listeningQuestions, { audio_url: '', transcript: '', question_text: '', options: [], answer: '', explanation: { en: '', ar: '' } }]);
    } else if (type === 'reading') {
      setReadingPassages([...readingPassages, { passage_title: '', passage: '', question_text: '', options: [], answer: '', explanation: { en: '', ar: '' } }]);
    } else if (type === 'grammar') {
      setGrammarQuestions([...grammarQuestions, { question_text: '', type: '', options: [], answer: '', explanation: { en: '', ar: '' } }]);
    }
  };

  // حذف سؤال
  const deleteQuestion = (type, index) => {
    if (confirm('هل أنت متأكد أنك تريد حذف هذا السؤال؟')) {
      if (type === 'listening') {
        const newQuestions = listeningQuestions.filter((_, i) => i !== index);
        setListeningQuestions(newQuestions);
      } else if (type === 'reading') {
        const newQuestions = readingPassages.filter((_, i) => i !== index);
        setReadingPassages(newQuestions);
      } else if (type === 'grammar') {
        const newQuestions = grammarQuestions.filter((_, i) => i !== index);
        setGrammarQuestions(newQuestions);
      }
    }
  };

  // إرسال البيانات إلى API
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const testData = {
      title: testTitle,
      description: testDescription,
      listening: listeningQuestions,
      reading: readingPassages,
      grammar: grammarQuestions,
    };

    try {
      const response = await fetch('/api/save-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل حفظ الاختبار.');
      }

      setMessage(result.message);
      // إعادة تهيئة النموذج بعد الحفظ
      setTestTitle('');
      setTestDescription('');
      setListeningQuestions([]);
      setReadingPassages([]);
      setGrammarQuestions([]);
    } catch (error) {
      setMessage(`خطأ: ${error.message}`);
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-blue-800">لوحة تحكم الأدمن</h1>
        
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="testTitle" className="block text-gray-700 text-sm font-bold mb-2">عنوان الاختبار</label>
              <input
                type="text"
                id="testTitle"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="mb-6">
              <label htmlFor="testDescription" className="block text-gray-700 text-sm font-bold mb-2">وصف الاختبار</label>
              <textarea
                id="testDescription"
                value={testDescription}
                onChange={(e) => setTestDescription(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                rows="3"
              />
            </div>

            <div className="flex justify-center border-b border-gray-300 mb-6">
              <button
                type="button"
                className={`py-2 px-4 text-center font-semibold transition-colors duration-200 ${activeTab === 'listening' ? 'border-b-4 border-blue-500 text-blue-700' : 'text-gray-500 hover:text-blue-700'}`}
                onClick={() => setActiveTab('listening')}
              >
                أسئلة الاستماع
              </button>
              <button
                type="button"
                className={`py-2 px-4 text-center font-semibold transition-colors duration-200 ${activeTab === 'reading' ? 'border-b-4 border-blue-500 text-blue-700' : 'text-gray-500 hover:text-blue-700'}`}
                onClick={() => setActiveTab('reading')}
              >
                فقرات القراءة
              </button>
              <button
                type="button"
                className={`py-2 px-4 text-center font-semibold transition-colors duration-200 ${activeTab === 'grammar' ? 'border-b-4 border-blue-500 text-blue-700' : 'text-gray-500 hover:text-blue-700'}`}
                onClick={() => setActiveTab('grammar')}
              >
                أسئلة القواعد
              </button>
            </div>

            {/* محتوى كل قسم (تاب) */}
            {activeTab === 'listening' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <div className="mb-4">
                  <label htmlFor="listening-file" className="block text-gray-700 text-sm font-bold mb-2">
                    رفع ملف JSON لأسئلة الاستماع
                  </label>
                  <input
                    type="file"
                    id="listening-file"
                    accept=".json"
                    onChange={(e) => handleFileChange(e, 'listening')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                {listeningQuestions.length > 0 && (
                  <div className="overflow-x-auto shadow-md rounded-lg">
                    <table className="min-w-full bg-white">
                      <thead className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                        <tr>
                          <th className="py-3 px-6 text-right">السؤال</th>
                          <th className="py-3 px-6 text-right">الخيارات</th>
                          <th className="py-3 px-6 text-right">الإجابة</th>
                          <th className="py-3 px-6 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-600 text-sm font-light">
                        {listeningQuestions.map((q, index) => (
                          <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">
                            <td className="py-3 px-6 whitespace-normal">
                              <textarea
                                value={q.question_text}
                                onChange={(e) => handleQuestionChange(e, 'listening', index, 'question_text')}
                                className="w-full h-20 p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 whitespace-normal">
                              <textarea
                                value={JSON.stringify(q.options, null, 2)}
                                onChange={(e) => handleQuestionChange(e, 'listening', index, 'options')}
                                className="w-full h-20 p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 whitespace-normal">
                              <input
                                type="text"
                                value={q.answer}
                                onChange={(e) => handleQuestionChange(e, 'listening', index, 'answer')}
                                className="w-full p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 text-center">
                              <button
                                type="button"
                                onClick={() => deleteQuestion('listening', index)}
                                className="text-red-500 hover:text-red-700 font-semibold"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => addQuestion('listening')}
                  className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full transition-transform transform hover:scale-105"
                >
                  أضف سؤال استماع جديد
                </button>
              </motion.div>
            )}

            {activeTab === 'reading' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <div className="mb-4">
                  <label htmlFor="reading-file" className="block text-gray-700 text-sm font-bold mb-2">
                    رفع ملف JSON لفقرات القراءة
                  </label>
                  <input
                    type="file"
                    id="reading-file"
                    accept=".json"
                    onChange={(e) => handleFileChange(e, 'reading')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                {readingPassages.length > 0 && (
                  <div className="overflow-x-auto shadow-md rounded-lg">
                    <table className="min-w-full bg-white">
                      <thead className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                        <tr>
                          <th className="py-3 px-6 text-right">الفقرة</th>
                          <th className="py-3 px-6 text-right">السؤال</th>
                          <th className="py-3 px-6 text-right">الخيارات</th>
                          <th className="py-3 px-6 text-right">الإجابة</th>
                          <th className="py-3 px-6 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-600 text-sm font-light">
                        {readingPassages.map((q, index) => (
                          <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">
                            <td className="py-3 px-6 whitespace-normal">
                              <textarea
                                value={q.passage}
                                onChange={(e) => handleQuestionChange(e, 'reading', index, 'passage')}
                                className="w-full h-20 p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 whitespace-normal">
                              <textarea
                                value={q.question_text}
                                onChange={(e) => handleQuestionChange(e, 'reading', index, 'question_text')}
                                className="w-full h-20 p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 whitespace-normal">
                              <textarea
                                value={JSON.stringify(q.options, null, 2)}
                                onChange={(e) => handleQuestionChange(e, 'reading', index, 'options')}
                                className="w-full h-20 p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 whitespace-normal">
                              <input
                                type="text"
                                value={q.answer}
                                onChange={(e) => handleQuestionChange(e, 'reading', index, 'answer')}
                                className="w-full p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 text-center">
                              <button
                                type="button"
                                onClick={() => deleteQuestion('reading', index)}
                                className="text-red-500 hover:text-red-700 font-semibold"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => addQuestion('reading')}
                  className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full transition-transform transform hover:scale-105"
                >
                  أضف فقرة قراءة جديدة
                </button>
              </motion.div>
            )}

            {activeTab === 'grammar' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <div className="mb-4">
                  <label htmlFor="grammar-file" className="block text-gray-700 text-sm font-bold mb-2">
                    رفع ملف JSON لأسئلة القواعد
                  </label>
                  <input
                    type="file"
                    id="grammar-file"
                    accept=".json"
                    onChange={(e) => handleFileChange(e, 'grammar')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                {grammarQuestions.length > 0 && (
                  <div className="overflow-x-auto shadow-md rounded-lg">
                    <table className="min-w-full bg-white">
                      <thead className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                        <tr>
                          <th className="py-3 px-6 text-right">السؤال</th>
                          <th className="py-3 px-6 text-right">النوع</th>
                          <th className="py-3 px-6 text-right">الخيارات</th>
                          <th className="py-3 px-6 text-right">الإجابة</th>
                          <th className="py-3 px-6 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-600 text-sm font-light">
                        {grammarQuestions.map((q, index) => (
                          <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">
                            <td className="py-3 px-6 whitespace-normal">
                              <textarea
                                value={q.question_text}
                                onChange={(e) => handleQuestionChange(e, 'grammar', index, 'question_text')}
                                className="w-full h-20 p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 whitespace-normal">
                              <input
                                type="text"
                                value={q.type}
                                onChange={(e) => handleQuestionChange(e, 'grammar', index, 'type')}
                                className="w-full p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 whitespace-normal">
                              <textarea
                                value={JSON.stringify(q.options, null, 2)}
                                onChange={(e) => handleQuestionChange(e, 'grammar', index, 'options')}
                                className="w-full h-20 p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 whitespace-normal">
                              <input
                                type="text"
                                value={q.answer}
                                onChange={(e) => handleQuestionChange(e, 'grammar', index, 'answer')}
                                className="w-full p-2 border rounded"
                              />
                            </td>
                            <td className="py-3 px-6 text-center">
                              <button
                                type="button"
                                onClick={() => deleteQuestion('grammar', index)}
                                className="text-red-500 hover:text-red-700 font-semibold"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => addQuestion('grammar')}
                  className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full transition-transform transform hover:scale-105"
                >
                  أضف سؤال قواعد جديد
                </button>
              </motion.div>
            )}

            <div className="mt-8 text-center">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-6 rounded-lg text-white font-bold text-lg transition-transform transform hover:scale-105 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {loading ? 'جاري الحفظ...' : 'إنشاء الاختبار'}
              </button>
              {message && (
                <p className="mt-4 text-center font-semibold text-green-600">
                  {message}
                </p>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
