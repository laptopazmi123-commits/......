// api/send.js
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: { bodyParser: false },
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parseForm(req) {
  const form = formidable({
    maxFileSize: 20 * 1024 * 1024,
    keepExtensions: true,
    multiples: false,
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.FONNTE_TOKEN;
  if (!token) return res.status(500).json({ error: 'FONNTE_TOKEN belum diset' });

  let fields, files;
  try {
    ({ fields, files } = await parseForm(req));
  } catch (e) {
    return res.status(400).json({ error: 'Gagal baca form: ' + e.message });
  }

  const get = (k) => Array.isArray(fields[k]) ? fields[k][0] : fields[k];

  const target = (get('target') || '').trim();
  const message = (get('message') || '').trim();
  const jumlah = parseInt(get('jumlah') || '1');
  const delaySec = Math.max(1, Math.min(60, parseInt(get('delay') || '2')));

  if (!/^\d{8,15}$/.test(target)) {
    return res.status(400).json({ error: 'Nomor tidak valid (format 62xxx)' });
  }
  if (!message && !files?.file) {
    return res.status(400).json({ error: 'Pesan atau file wajib ada' });
  }
  if (isNaN(jumlah) || jumlah < 1 || jumlah > 50) {
    return res.status(400).json({ error: 'Jumlah harus 1–50' });
  }

  let filePath = null;
  let fileName = null;
  let fileType = null;
  if (files?.file) {
    const f = Array.isArray(files.file) ? files.file[0] : files.file;
    filePath = f.filepath;
    fileName = f.originalFilename || 'file';
    fileType = f.mimetype || 'application/octet-stream';

    if (!fileType.startsWith('image/') && !fileType.startsWith('video/')) {
      return res.status(400).json({ error: 'Hanya foto atau video yang diizinkan' });
    }
  }

  let terkirim = 0;
  let gagal = 0;
  const errors = [];

  for (let i = 1; i <= jumlah; i++) {
    try {
      const formData = new FormData();
      formData.append('target', target);
      if (message) formData.append('message', message);
      formData.append('delay', String(delaySec));

      if (filePath) {
        const buffer = fs.readFileSync(filePath);
        const blob = new Blob([buffer], { type: fileType });
        formData.append('file', blob, fileName);
      }

      const r = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': token },
        body: formData,
      });

      const data = await r.json();

      if (data.status === true) terkirim++;
      else {
        gagal++;
        errors.push(data.reason || data.detail || 'Gagal');
      }
    } catch (e) {
      gagal++;
      errors.push(e.message);
    }

    if (i < jumlah) await sleep(delaySec * 1000);
  }

  if (filePath) { try { fs.unlinkSync(filePath); } catch {} }

  return res.status(200).json({
    ok: terkirim > 0,
    total: jumlah,
    terkirim,
    gagal,
    target,
    tipe: filePath ? (fileType.startsWith('video/') ? 'video' : 'foto') : 'teks',
    errors: errors.slice(0, 5),
  });
}
