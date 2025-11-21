'use client';

import React, { useState } from 'react';

export default function UploadJsonPage() {
  const [description, setDescription] = useState('');
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
    let payload = { test: null, chapters: [] };
    if (fileFull) {
      const fullJson = await readFileAsJson(fileFull);
      if (!fullJson) throw new Error('Full file is empty or invalid JSON');
      payload = fullJson;
    } else {
      if (fileGrammar) {
        const g = await readFileAsJson(fileGrammar);
        if (g) {
          if (Array.isArray(g.chapters)) payload.chapters.push(...g.chapters);
          else if (g.questions || g.chapter) payload.chapters.push(g);
          else payload.chapters.push(...(g?.grammar ? g.grammar : []));
        }
      }
      if (fileReading) {
        const r = await readFileAsJson(fileReading);
        if (r) {
          if (Array.isArray(r.chapters)) payload.chapters.push(...r.chapters);
          else if (r.pieces || r.chapter) payload.chapters.push(r);
          else payload.chapters.push(...(r?.reading ? r.reading : []));
        }
      }
      if (fileListening) {
        const l = await readFileAsJson(fileListening);
        if (l) {
          if (Array.isArray(l.chapters)) payload.chapters.push(...l.chapters);
          else if (l.pieces || l.chapter) payload.chapters.push(l);
          else payload.chapters.push(...(l?.listening ? l.listening : []));
        }
      }
      payload.chapters = payload.chapters.filter(Boolean);
    }

    if (description) payload.test = payload.test ?? {};
    if (description) payload.test.description = description;

    if (!payload.chapters || payload.chapters.length === 0) {
      throw new Error('No chapters found in selected files');
    }

    return payload;
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setMessage(null);
    setDetailedErrors(null);
    setLoading(true);

    try {
      const payload = await buildPayload();

      console.info('Uploading payload (preview):', {
        chaptersCount: (payload.chapters || []).length,
        test: payload.test ?? null
      });

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
        console.group('upload-json results');
        console.log('chapters:', body.results.chapters || []);
        console.log('errors:', body.results.errors || []);
        console.groupEnd();

        if (body.results.errors && body.results.errors.length > 0) {
          setMessage(`⚠️ تم الرفع جزئياً — وجد أخطاء في ${body.results.errors.length} فصل. راجع التفاصيل في الكونسول.`);
          setDetailedErrors(body.results.errors);
          setLoading(false);
          return;
        }

        setMessage('✅ تم رفع الملف بنجاح');
        setDetailedErrors(null);
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
      <h2 style={{ marginBottom: 12 }}>واجهة رفع JSON للاختبارات</h2>

      <form onSubmit={handleUpload}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>الوصف</label>
          <input
            placeholder="اكتب وصف قصير للاختبار"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontWeight: 600 }}>Grammar ملف</label>
            <input type="file" accept=".json,application/json" onChange={(e) => setFileGrammar(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Reading ملف</label>
            <input type="file" accept=".json,application/json" onChange={(e) => setFileReading(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Listening ملف</label>
            <input type="file" accept=".json,application/json" onChange={(e) => setFileListening(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>ملف كامل (يشمل كل الأقسام)</label>
            <input type="file" accept=".json,application/json" onChange={(e) => setFileFull(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button type="submit" disabled={loading} style={{ padding: '8px 16px', borderRadius: 6, background: '#0369a1', color: 'white', border: 'none' }}>
            {loading ? 'جارِ الرفع...' : 'رفع الاختبار'}
          </button>
          <button
            type="button"
            onClick={() => {
              setFileGrammar(null);
              setFileReading(null);
              setFileListening(null);
              setFileFull(null);
              setDescription('');
              setMessage(null);
              setDetailedErrors(null);
            }}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', background: 'white' }}
          >
            مسح الحقول
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

      <div style={{ marginTop: 18, color: '#666', fontSize: 13 }}>
        <div>{`ملاحظات:`}</div>
        <ul>
          <li>{`افتح الكونسول (F12) للاطّلاع على تفاصيل الرد الخام من السيرفر — ستجد body و results.errors هناك`}</li>
          <li>{`إذا ظهر خطأ "Server configuration error" تأكد أن متغيرات البيئة SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY موجودة في بيئة التشغيل`}</li>
          <li>{`إذا ظهر خطأ متعلق بقاعدة البيانات انسخ تفاصيل body.results.errors أو سجلات السيرفر وأرسلها لي لأعطيك تصحيح مباشر`}</li>
        </ul>
      </div>
    </div>
  );
}
