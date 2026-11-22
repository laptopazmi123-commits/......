const form       = document.getElementById('form');
const btn        = document.getElementById('btn');
const statusEl   = document.getElementById('status');
const msgInput   = document.getElementById('message');
const charCount  = document.getElementById('charCount');
const jumlahInp  = document.getElementById('jumlah');
const delayInp   = document.getElementById('delay');
const fileInput  = document.getElementById('file');
const preview    = document.getElementById('preview');
const previewIn  = document.getElementById('previewInner');

const MAX_FILE_SIZE = 4 * 1024 * 1024;

function updateCount() { charCount.textContent = msgInput.value.length; }
msgInput.addEventListener('input', updateCount);
updateCount();

function updateBtnLabel() {
  const n = parseInt(jumlahInp.value) || 1;
  btn.innerHTML = `🚀 Kirim Sekarang <span class="count-badge">${n}x</span>`;
}
jumlahInp.addEventListener('input', updateBtnLabel);
updateBtnLabel();

function setStatus(type, text) {
  statusEl.className = 'status visible ' + type;
  statusEl.textContent = text;
}
function clearStatus() {
  statusEl.className = 'status';
  statusEl.textContent = '';
}

fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (!f) { hapusFile(); return; }

  if (f.size > MAX_FILE_SIZE) {
    setStatus('err', `❌ File terlalu besar (${(f.size/1024/1024).toFixed(1)} MB). Maks 4 MB.`);
    fileInput.value = '';
    hapusFile();
    return;
  }

  const type = f.type || '';
  let mediaHtml = '';
  if (type.startsWith('image/')) {
    mediaHtml = `<img src="${URL.createObjectURL(f)}" alt="preview">`;
  } else if (type.startsWith('video/')) {
    mediaHtml = `<video src="${URL.createObjectURL(f)}" muted></video>`;
  } else {
    setStatus('err', '❌ Hanya foto atau video.');
    fileInput.value = '';
    hapusFile();
    return;
  }

  previewIn.innerHTML = `
    ${mediaHtml}
    <div class="file-info">
      <strong>${f.name}</strong><br>
      ${(f.size/1024).toFixed(1)} KB · ${type}
    </div>
  `;
  preview.style.display = 'flex';
  clearStatus();
});

window.hapusFile = function () {
  fileInput.value = '';
  previewIn.innerHTML = '';
  preview.style.display = 'none';
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const target = document.getElementById('target').value.trim();
  const message = msgInput.value.trim();
  const jumlah = parseInt(jumlahInp.value) || 1;
  const delay = parseInt(delayInp.value) || 2;
  const file = fileInput.files[0];

  if (!/^\d{8,15}$/.test(target)) {
    setStatus('err', '❌ Nomor tidak valid. Gunakan format 62xxx.');
    return;
  }
  if (!message && !file) {
    setStatus('err', '❌ Isi pesan atau pilih file.');
    return;
  }
  if (jumlah < 1 || jumlah > 50) {
    setStatus('err', '❌ Jumlah harus 1–50.');
    return;
  }
  if (file && file.size > MAX_FILE_SIZE) {
    setStatus('err', '❌ File terlalu besar. Maks 4 MB.');
    return;
  }

  const fd = new FormData();
  fd.append('target', target);
  if (message) fd.append('message', message);
  fd.append('jumlah', String(jumlah));
  fd.append('delay', String(delay));
  if (file) fd.append('file', file);

  btn.disabled = true;
  btn.textContent = `⏳ Mengirim 0/${jumlah}...`;
  setStatus('loading', `Mengunggah & mengirim 0 dari ${jumlah}...`);

  try {
    let tick = 0;
    const progress = setInterval(() => {
      tick++;
      if (tick <= jumlah) {
        const pct = Math.round((tick / jumlah) * 100);
        setStatus('loading', `Mengirim... ${tick}/${jumlah} (${pct}%)`);
        btn.textContent = `⏳ Mengirim ${tick}/${jumlah}...`;
      }
    }, 800);

    const res = await fetch('/api/send', { method: 'POST', body: fd });
    clearInterval(progress);

    const data = await res.json();

    if (data.ok) {
      const tipeLabel = data.tipe === 'teks' ? 'teks' : data.tipe;
      setStatus('ok',
        `✅ ${data.terkirim}/${data.total} ${tipeLabel} terkirim ke ${data.target}` +
        (data.gagal ? ` · ${data.gagal} gagal` : '')
      );
    } else {
      setStatus('err', `❌ Gagal: ${data.error || 'Tidak diketahui'}`);
    }
  } catch (err) {
    setStatus('err', `❌ Error jaringan: ${err.message}`);
  } finally {
    btn.disabled = false;
    updateBtnLabel();
  }
});
