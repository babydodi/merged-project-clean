// src/app/admin/upload/page.client.jsx
'use client';

import React, { useState } from 'react';

export default function UploadJsonPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [availability, setAvailability] = useState('all'); // all | subscribers | non_subscribers
  const [isPublished, setIsPublished] = useState(false);
  const [testId, setTestId] = useState('');

  const [fileGrammar, setFileGrammar] = useState(null);
  const [fileReading, setFileReading] = useState(null);
  const [fileListening, setFileListening] = useState(null);
  const [fileFull, setFileFull] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [detailedErrors, setDetailedErrors] = useState(null);

  const readFileAsJson = (file) =>
    new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result;
          const json = text ? JSON.parse(text) : null;
          resolve(json);
        } catch (err) {
          reject(new Error(`Invalid JSON in ${file.name}: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
      reader.readAsText(file);
    });

  const buildPayload = async () => {
    let payload = { chapters: [] };

    // optional direct test_id
    if (testId) payload.test_id = testId;

    // optional test object to create tests row
    const testObj = {};
    if (title) testObj.title = title;
    if (description) testObj.description = description;
    if (availability) testObj.availability = availability;
    if (isPublished != null) testObj.is_published = isPublished;
    if (Object.keys(testObj).length > 0) payload.test = testObj;

    if (fileFull) {
      const fullJson = await readFileAsJson(fileFull);
      if (!fullJson) throw new Error('Full file is empty or invalid JSON');
      // merge: keep top-level test/test_id from form as priority, but merge chapters from file
      payload.chapters = Array.isArray(fullJson.chapters) ? fullJson.chapters : (fullJson.chapters ? [fullJson.chapters] : []);
      // if user didn’t fill form fields, adopt from file
      if (!payload.test && fullJson.test) payload.test = fullJson.test;
      if (!payload.test_id && fullJson.test_id) payload.test_id = fullJson.test_id;
    } else {
      if (fileGrammar) {
        const g = await readFileAsJson(fileGrammar);
        if (g) {
          if (Array.isArray(g.chapters)) payload.chapters.push(...g.chapters);
          else if (g.questions || g.chapter) payload.chapters.push(g);
          else if (Array.isArray(g.grammar)) payload.chapters.push(...g.grammar);
        }
      }
      if (fileReading) {
        const r = await readFileAsJson(fileReading);
        if (r) {
          if (Array.isArray(r.chapters)) payload.chapters.push(...r.chapters);
          else if (r.pieces || r.chapter) payload.chapters.push(r);
          else if (Array.isArray(r.reading)) payload.chapters.push(...r.reading);
        }
      }
      if (fileListening) {
        const l = await readFileAsJson(fileListening);
        if (l) {
          if (Array.isArray(l.chapters)) payload.chapters.push(...l.chapters);
          else if (l.pieces || l.chapter) payload.chapters.push(l);
          else if (Array.isArray(l.listening)) payload.chapters.push(...l.listening);
        }
      }
    }

    payload.chapters = payload.chapters.filter(Boolean);
    if (!payload.chapters.length) throw new Error('No chapters found in selected files');

    return payload;
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setMessage(null);
    setDetailedErrors(null);
    setLoading(true);

    try {
      const payload = await buildPayload();

      const res = await fetch('/api/admin/upload-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const raw = await res.text();
      let body;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.error('upload-json raw response (non-json):', raw);
        throw new Error(`Server returned non-JSON response (status ${res.status}). See console.`);
      }

      console.info('upload-json status', res.status, 'body', body);

      if (!body) throw new Error('Empty response from server');

      if (body.error) {
        console.error('upload-json returned error', body);
        setMessage(`❌ خطأ من السيرفر: ${body.error}`);
        if (body.stack) setDetailedErrors(body.stack);
        setLoading(false);
        return;
      }

      if (body.results) {
        const createdTestId = body.results.testId || body.results.test_id || null;
        const chapterCount = (body.results.chapters || []).length;
        const errCount = (body.results.errors || []).length;

        let msg = `✅ تم الرفع.`;
        if (createdTestId) msg += ` تم إنشاء اختبار: ${createdTestId}`;
        msg += ` عدد الفصول: ${chapterCount}.`;
        if (errCount > 0) msg = `⚠️ تم الرفع جزئياً — أخطاء: ${errCount}.`;

        setMessage(msg);
        if (errCount > 0) setDetailedErrors(body.results.errors);
        setLoading(false);
        return;
      }

      setMessage('✅ تم معالجة الرد (تحقق من الكونسول لمزيد من التفاصيل)');
      setLoading(false);
    } catch (err) {
      console.error('Upload client error', err);
      setMessage(`❌ خطأ أثناء الرفع: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 920, margin: '24px auto', direction: 'rtl', textAlign: 'right', padding: 20 }}>
      <h2 style={{ marginBottom: 12 }}>{`واجهة رفع JSON للاختبارات`}</h2>

      <form onSubmit={handleUpload}>
        <fieldset style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <legend style={{ padding: '0 8px' }}>{`معلومات الاختبار (اختياري)`}</legend>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>{`معرّف اختبار موجود (test_id)`}</label>
            <input
              placeholder="إذا عندك test_id موجود، الصقه هنا"
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>{`عنوان الاختبار`}</label>
              <input
                placeholder="عنوان الاختبار"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>{`حالة الإتاحة`}</label>
              <select
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
              >
                <option value="all">{`all`}</option>
                <option value="subscribers">{`subscribers`}</option>
                <option value="non_subscribers">{`non_subscribers`}</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>{`الوصف`}</label>
            <textarea
              placeholder="اكتب وصف قصير للاختبار"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
            />
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            <span>{`نشر الاختبار بعد الإنشاء`}</span>
          </label>
        </fieldset>

        <fieldset style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <legend style={{ padding: '0 8px' }}>{`ملفات JSON`}</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontWeight: 600 }}>{`Grammar ملف`}</label>
              <input type="file" accept=".json,application/json" onChange={(e) => setFileGrammar(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label style={{ fontWeight: 600 }}>{`Reading ملف`}</label>
              <input type="file" accept=".json,application/json" onChange={(e) => setFileReading(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label style={{ fontWeight: 600 }}>{`Listening ملف`}</label>
              <input type="file" accept=".json,application/json" onChange={(e) => setFileListening(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label style={{ fontWeight: 600 }}>{`ملف كامل (يشمل كل الأقسام)`}</label>
              <input type="file" accept=".json,application/json" onChange={(e) => setFileFull(e.target.files?.[0] ?? null)} />
            </div>
          </div>
        </fieldset>

        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button type="submit" disabled={loading} style={{ padding: '8px 16px', borderRadius: 6, background: '#0369a1', color: 'white', border: 'none' }}>
            {loading ? 'جارِ الرفع...' : 'رفع الاختبار'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTitle(''); setDescription(''); setAvailability('all'); setIsPublished(false); setTestId('');
              setFileGrammar(null); setFileReading(null); setFileListening(null); setFileFull(null);
              setMessage(null); setDetailedErrors(null);
            }}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: 'white' }}
          >
            {`مسح الحقول`}
          </button>
        </div>
      </form>

      {message && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#fff8f0', border: '1px solid #ffd8a8' }}>
          <div style={{ fontWeight: 700 }}>{message}</div>
          {detailedErrors && (
            <pre style={{ marginTop: 8, maxHeight: 320, overflow: 'auto', background: '#fff', padding: 8, borderRadius: 6 }}>
              {typeof detailedErrors === 'string' ? detailedErrors : JSON.stringify(detailedErrors, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
