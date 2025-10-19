'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AdminTestsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // رفع اختبار جديد
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  // ✅ جلب كل الاختبارات
  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tests')
      .select('id, title, description, availability, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setTests(data || []);
    }
    setLoading(false);
  };

  // ✅ رفع اختبار جديد
  const handleUpload = async () => {
    if (!title) {
      setMessage('❌ العنوان مطلوب');
      return;
    }
    if (!file) {
      setMessage('❌ اختر ملف JSON');
      return;
    }

    try {
      setUploading(true);
      setMessage('');

      const text = await file.text();
      const json = JSON.parse(text);

      const body = {
        title,
        description,
        availability: 'all',
        is_published: true,
        chapters: json.chapters || [],
      };

      const res = await fetch('/api/admin/upload-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setMessage(`✅ تم رفع الاختبار بنجاح (ID: ${data.test_id})`);
        setTitle('');
        setDescription('');
        setFile(null);
        loadTests(); // إعادة تحميل القائمة
      } else {
        setMessage(`❌ خطأ: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ حدث خطأ أثناء رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">📋 لوحة تحكم الاختبارات</h1>

      {/* قسم رفع اختبار جديد */}
      <div className="bg-white shadow rounded-lg p-6 mb-10">
        <h2 className="text-xl font-semibold mb-4">📤 رفع اختبار جديد</h2>

        <div className="mb-4">
          <label className="block mb-1 font-semibold">عنوان الاختبار</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="مثال: STEP Grammar Test"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-semibold">الوصف</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="اكتب وصف قصير للاختبار"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-semibold">ملف JSON</label>
          <input
            type="file"
            accept=".json"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-4 py-2 bg-indigo-600 text-white rounded"
        >
          {uploading ? '⏳ جاري الرفع...' : 'رفع الاختبار'}
        </button>

        {message && <p className="mt-4">{message}</p>}
      </div>

      {/* قسم عرض كل الاختبارات */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">📚 قائمة الاختبارات</h2>

        {loading ? (
          <p>⏳ جاري التحميل...</p>
        ) : tests.length === 0 ? (
          <p>❌ لا توجد اختبارات حالياً</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-right">
                <th className="p-2 border">#</th>
                <th className="p-2 border">العنوان</th>
                <th className="p-2 border">الوصف</th>
                <th className="p-2 border">الحالة</th>
                <th className="p-2 border">تاريخ الإنشاء</th>
                <th className="p-2 border">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test, idx) => (
                <tr key={test.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{idx + 1}</td>
                  <td className="p-2 border">{test.title}</td>
                  <td className="p-2 border">{test.description}</td>
                  <td className="p-2 border">{test.availability}</td>
                  <td className="p-2 border">
                    {new Date(test.created_at).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="p-2 border">
                    <button
                      onClick={() => router.push(`/admin/tests/${test.id}`)}
                      className="px-3 py-1 bg-blue-600 text-white rounded mr-2"
                    >
                      ✏️ تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
