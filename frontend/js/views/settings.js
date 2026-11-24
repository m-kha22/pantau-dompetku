import { $, $$, esc, download, todayISO } from '../utils.js';
import { CONFIG } from '../config.js';
import { getConn, setConn, clearConn, request } from '../api.js';
import { state, saveSettings, load } from '../store.js';
import { getTheme, saveTheme } from '../theme.js';
import { toast, confirmDialog } from '../ui.js';
import { swatchesHTML } from '../components.js';
import { showConnect } from './connect.js';

const LOCKED = ['Tabungan', 'Lainnya'];

function catSection(title, key, list) {
  return `<div class="field"><label>${title}</label>
    <div class="chips" data-list="${key}">${list.map(c => `<span class="chip ${LOCKED.includes(c) ? 'lock' : ''}">${esc(c)}${LOCKED.includes(c) ? '' : `<button data-rm="${esc(c)}" aria-label="Hapus ${esc(c)}"><i class="fa-solid fa-xmark"></i></button>`}</span>`).join('')}</div>
    <div class="row" style="margin-top:8px"><input class="input" data-add="${key}" maxlength="40" placeholder="Kategori baru"><button class="btn" data-addbtn="${key}">Tambah</button></div></div>`;
}

export function render(root) {
  const t = getTheme(), conn = getConn(), st = state.settings;
  root.innerHTML = `
    <div class="grid grid-2" style="align-items:start">
      <div class="stack">
        <div class="card">
          <div class="card-head"><div class="card-title"><i class="fa-solid fa-palette"></i>Tampilan</div></div>
          <div class="form">
            <div class="field"><label>Mode tema</label>
              <div class="seg">${[['auto', 'Otomatis'], ['light', 'Terang'], ['dark', 'Gelap']].map(([v, l]) => `<label><input type="radio" name="mode" value="${v}" ${t.mode === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
            <div class="field"><label>Warna aplikasi</label>
              <div class="swatches" id="accSw">${swatchesHTML(CONFIG.ACCENT_COLORS, t.accent)}
                <input type="color" class="swatch" id="accCustom" value="${esc(t.accent)}" title="Warna kustom" style="padding:0;border-radius:50%;overflow:hidden"></div>
              <span class="hint">Berlaku untuk tombol, sidebar, dan grafik. Tersimpan di perangkat ini.</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title"><i class="fa-solid fa-calendar-days"></i>Siklus Bulanan</div></div>
          <div class="field"><label>Tanggal gajian / awal siklus (1–28)</label>
            <div class="row"><input class="input" type="number" id="startDay" min="1" max="28" value="${st.startDay}" style="max-width:110px">
            <button class="btn btn-primary" id="saveDay">Simpan</button></div>
            <span class="hint">Contoh: 25 → siklus 25 Okt – 24 Nov. Dipakai di Dashboard, Transaksi, dan Laporan.</span></div>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title"><i class="fa-solid fa-tags"></i>Kategori</div></div>
          <div class="form">${catSection('Pengeluaran', 'expenseCategories', st.expenseCategories)}${catSection('Pemasukan', 'incomeCategories', st.incomeCategories)}
          <span class="hint">“Tabungan” dan “Lainnya” bersifat tetap. Menghapus kategori tidak mengubah transaksi lama.</span></div>
        </div>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-head"><div class="card-title"><i class="fa-solid fa-plug"></i>Koneksi Backend</div>
            <span class="badge good">Terhubung</span></div>
          <div class="form">
            <div class="field"><label>URL Web App (Apps Script)</label><input class="input" id="cUrl" value="${esc(conn.url)}" placeholder="https://script.google.com/macros/s/…/exec"></div>
            <div class="field"><label>Token API</label><input class="input" id="cToken" type="password" value="${esc(conn.token)}" placeholder="Sama dengan API_TOKEN di Script Properties" autocomplete="off"></div>
            <div class="row"><button class="btn grow" id="cTest"><i class="fa-solid fa-vial"></i>Uji</button>
              <button class="btn btn-primary grow" id="cSave">Simpan</button></div>
            <button class="btn btn-danger" id="cReset"><i class="fa-solid fa-link-slash"></i>Putuskan koneksi di perangkat ini</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title"><i class="fa-solid fa-robot"></i>Asisten AI & Info</div></div>
          <div class="kv"><span>Mode AI</span><b>${state.meta.aiEnabled ? 'Gemini aktif' : 'Berbasis aturan'}</b></div>
          <div class="kv"><span>Token API di server</span><b>${state.meta.tokenRequired ? 'Aktif 🔒' : 'Belum diatur ⚠️'}</b></div>
          <div class="kv"><span>Versi backend</span><b>${esc(state.meta.version || '-')}</b></div>
          <div class="kv"><span>Zona waktu</span><b>${esc(state.meta.timezone || '-')}</b></div>
          <p class="hint" style="margin-top:10px">Untuk mengaktifkan Gemini, isi <code>GEMINI_API_KEY</code> di Apps Script → Project Settings → Script Properties.</p>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title"><i class="fa-solid fa-database"></i>Data</div></div>
          <div class="row wrap"><button class="btn" id="expAll"><i class="fa-solid fa-file-csv"></i>Ekspor semua transaksi (CSV)</button>
            <button class="btn" id="reload"><i class="fa-solid fa-arrows-rotate"></i>Muat ulang dari Sheet</button></div>
        </div>
      </div>
    </div>`;

  /* tema */
  $$('input[name="mode"]', root).forEach(r => r.onchange = () => saveTheme({ mode: r.value }));
  $$('#accSw [data-color]', root).forEach(b => b.onclick = () => { saveTheme({ accent: b.dataset.color }); $('#accCustom', root).value = b.dataset.color; });
  $('#accCustom', root).onchange = e => saveTheme({ accent: e.target.value });

  /* siklus */
  $('#saveDay', root).onclick = async () => {
    const v = parseInt($('#startDay', root).value, 10);
    if (!(v >= 1 && v <= 28)) return toast('Tanggal harus antara 1 dan 28.', 'error');
    try { await saveSettings({ startDay: v }); toast(`Siklus dimulai setiap tanggal ${v}.`); } catch (e) { toast(e.message, 'error'); }
  };

  /* kategori */
  const addCat = async key => {
    const inp = $(`[data-add="${key}"]`, root), v = inp.value.trim();
    if (!v) return;
    const list = state.settings[key];
    if (list.some(c => c.toLowerCase() === v.toLowerCase())) return toast('Kategori sudah ada.', 'error');
    try { await saveSettings({ [key]: [...list, v] }); toast('Kategori ditambahkan.'); } catch (e) { toast(e.message, 'error'); }
  };
  $$('[data-addbtn]', root).forEach(b => b.onclick = () => addCat(b.dataset.addbtn));
  $$('[data-add]', root).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') addCat(i.dataset.add); }));
  $$('[data-list]', root).forEach(box => box.addEventListener('click', async e => {
    const btn = e.target.closest('[data-rm]'); if (!btn) return;
    const key = box.dataset.list;
    try { await saveSettings({ [key]: state.settings[key].filter(c => c !== btn.dataset.rm) }); } catch (err) { toast(err.message, 'error'); }
  }));

  /* koneksi */
  const vals = () => ({ url: $('#cUrl', root).value.trim(), token: $('#cToken', root).value.trim() });
  $('#cTest', root).onclick = async () => {
    const { url, token } = vals();
    try { const r = await request(url, token, 'ping'); toast(`Koneksi OK (backend v${r.version})`); } catch (e) { toast(e.message, 'error'); }
  };
  $('#cSave', root).onclick = async () => {
    const c = vals();
    try { await request(c.url, c.token, 'ping'); setConn(c); toast('Koneksi disimpan.'); await load(); } catch (e) { toast(e.message, 'error'); }
  };
  $('#cReset', root).onclick = async () => {
    if (!await confirmDialog({ title: 'Putuskan koneksi?', message: 'URL dan token di perangkat ini akan dihapus. Data di Google Sheet tidak terpengaruh.', okLabel: 'Putuskan', danger: true })) return;
    clearConn(); showConnect();
  };

  /* data */
  $('#reload', root).onclick = async () => { try { await load(); toast('Data dimuat ulang.'); } catch (e) { toast(e.message, 'error'); } };
  $('#expAll', root).onclick = () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['Tanggal,Dompet,Jenis,Kategori,Nominal,Keterangan',
      ...state.transactions.map(t => [t.tanggal, q(t.dompet), t.jenis, q(t.kategori), t.nominal, q(t.keterangan)].join(','))].join('\n');
    download(`semua-transaksi-${todayISO()}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
  };
}
