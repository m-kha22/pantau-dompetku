import { $, $$, esc, download, todayISO } from '../utils.js';
import { CONFIG } from '../config.js';
import { call, clearSession } from '../api.js';
import { state, saveSettings, load, canWrite } from '../store.js';
import { getTheme, saveTheme } from '../theme.js';
import { toast, confirmDialog, formModal, busy } from '../ui.js';
import { swatchesHTML } from '../components.js';
import { showLogin, googleSignOut } from './login.js';

const LOCKED = ['Tabungan', 'Lainnya'];

function catSection(title, key, list) {
  return `<div class="field"><label>${title}</label>
    <div class="chips" data-list="${key}">${list.map(c => `<span class="chip ${LOCKED.includes(c) ? 'lock' : ''}">${esc(c)}${LOCKED.includes(c) ? '' : `<button data-rm="${esc(c)}" aria-label="Hapus ${esc(c)}"><i class="fa-solid fa-xmark"></i></button>`}</span>`).join('')}</div>
    <div class="row" style="margin-top:8px"><input class="input" data-add="${key}" maxlength="40" placeholder="Kategori baru"><button class="btn" data-addbtn="${key}">Tambah</button></div></div>`;
}

export function render(root) {
  const t = getTheme(), st = state.settings, me = state.me || {}, sp = state.space || {};
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
          <div class="card-head"><div class="card-title"><i class="fa-solid fa-circle-user"></i>Akun</div></div>
          <div class="member" style="padding-top:0">
            ${me.picture ? `<img class="avatar" src="${esc(me.picture)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((me.name || '?').charAt(0).toUpperCase())}</span>`}
            <div class="grow"><b>${esc(me.name)}</b><small class="muted">${esc(me.email)}</small></div></div>
          <div class="kv"><span>Ruang aktif</span><b>${esc(sp.type === 'personal' ? 'Pribadi' : sp.name || '-')}</b></div>
          <div class="kv"><span>Peran Anda</span><b>${{ owner: 'Pemilik', member: 'Anggota', viewer: 'Hanya lihat' }[state.role] || '-'}</b></div>
          <div class="row wrap" style="margin-top:12px"><button class="btn" id="logout"><i class="fa-solid fa-right-from-bracket"></i>Keluar</button>
            <button class="btn btn-danger" id="delAcc"><i class="fa-solid fa-user-slash"></i>Hapus akun & data</button></div>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title"><i class="fa-solid fa-shield-halved"></i>Keamanan & Privasi</div></div>
          <div class="kv"><span>Enkripsi data keuangan</span><b>AES-256 + HMAC 🔒</b></div>
          <div class="kv"><span>Penyimpanan</span><b>Terpisah per ruang</b></div>
          <div class="kv"><span>Mode AI</span><b>${state.meta.aiEnabled ? 'Gemini aktif' : 'Berbasis aturan'}</b></div>
          <div class="kv"><span>Versi backend</span><b>${esc(state.meta.version || '-')}</b></div>
          <p class="hint" style="margin-top:10px">Dompet, transaksi, dan target dienkripsi sebelum disimpan. Kunci dipegang server aplikasi (bukan enkripsi ujung-ke-ujung), sehingga pengelola layanan secara teknis dapat membukanya. Nama & email akun disimpan apa adanya untuk login dan undangan keluarga.${state.meta.aiEnabled ? ' Fitur AI hanya mengirim ringkasan agregat atau satu kalimat transaksi ke Google Gemini.' : ''}</p>
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

  if (!canWrite()) $$('#saveDay, [data-addbtn], [data-add], [data-rm]', root).forEach(e => { e.disabled = true; e.title = 'Akses hanya-lihat'; });
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

  /* akun */
  $('#logout', root).onclick = async () => {
    try { await call('auth.logout'); } catch (e) { /* abaikan */ }
    clearSession(); googleSignOut(); showLogin();
  };
  $('#delAcc', root).onclick = () => formModal({
    title: 'Hapus akun & semua data', submitLabel: 'Hapus permanen',
    html: `<p>Seluruh data di <b>ruang pribadi</b> Anda, keanggotaan keluarga, dan akun akan dihapus <b>permanen</b>. Ruang Keluarga yang Anda miliki harus dihapus lebih dulu.</p>
      <div class="field"><label>Ketik <b>HAPUS</b> untuk melanjutkan</label><input class="input" name="c" autocomplete="off"></div>`,
    async onSubmit(form) {
      if (form.c.value.trim() !== 'HAPUS') throw new Error('Ketik HAPUS (huruf besar) untuk konfirmasi.');
      await call('account.delete', { confirm: 'HAPUS' });
      clearSession(); googleSignOut(); document.getElementById('modal').close(); showLogin(); toast('Akun dan data Anda telah dihapus.');
    }
  });

  /* data */
  $('#reload', root).onclick = async () => { try { await load(); toast('Data dimuat ulang.'); } catch (e) { toast(e.message, 'error'); } };
  $('#expAll', root).onclick = () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['Tanggal,Dompet,Jenis,Kategori,Nominal,Keterangan',
      ...state.transactions.map(t => [t.tanggal, q(t.dompet), t.jenis, q(t.kategori), t.nominal, q(t.keterangan)].join(','))].join('\n');
    download(`semua-transaksi-${todayISO()}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
  };
}
