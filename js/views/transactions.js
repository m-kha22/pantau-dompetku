import { $, $$, esc, rupiah, todayISO, parseMoney, bindMoney, setMoney, download, debounce } from '../utils.js';
import { state, mutate, activeCycle, txInRange, summarize } from '../store.js';
import { formModal, confirmDialog, toast } from '../ui.js';
import { txGroupsHTML, emptyHTML, cycleNavHTML, bindCycleNav } from '../components.js';

/* =====================================================================
   FORM TRANSAKSI (tambah / edit) — dipakai juga oleh FAB, Target, dan AI
   preset: {jenis, kategori, goalId, tanggal, dompet, nominal, keterangan}
   ===================================================================== */
export function openTxForm({ tx = null, preset = {} } = {}) {
  if (!state.wallets.length) { toast('Buat dompet dulu di menu Dompet.', 'error'); location.hash = '#/wallets'; return; }

  const isEdit = !!tx;
  const isTransfer = isEdit && tx.jenis.startsWith('Transfer');
  const base = tx || { jenis: 'Keluar', tanggal: todayISO(), dompet: state.wallets[0].nama, nominal: 0, kategori: '', keterangan: '', goalId: '', ...preset };

  const walletOpts = sel => state.wallets.map(w => `<option value="${esc(w.nama)}" ${w.nama === sel ? 'selected' : ''}>${esc(w.nama)}</option>`).join('');
  const deleteBtn = isEdit ? `<button type="button" class="btn btn-danger" data-delete><i class="fa-solid fa-trash"></i></button>` : '';

  if (isTransfer) {
    return formModal({
      title: 'Detail Transfer',
      html: `<p class="muted">Transfer tidak dapat diedit. Hapus lalu buat ulang bila ada yang salah. Menghapus satu sisi akan menghapus pasangannya.</p>
        <div class="kv"><span>Dompet</span><b>${esc(tx.dompet)}</b></div>
        <div class="kv"><span>Jenis</span><b>${esc(tx.jenis)}</b></div>
        <div class="kv"><span>Nominal</span><b>${rupiah(tx.nominal)}</b></div>
        <div class="kv"><span>Tanggal</span><b>${esc(tx.tanggal)}</b></div>
        <div class="kv"><span>Keterangan</span><b>${esc(tx.keterangan || '-')}</b></div>`,
      submitLabel: 'Tutup',
      extraFooter: deleteBtn,
      onSubmit: (_, d) => d.close(),
      onMount: (d) => bindDelete(d, tx)
    });
  }

  return formModal({
    title: isEdit ? 'Edit Transaksi' : 'Transaksi Baru',
    submitLabel: isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi',
    extraFooter: deleteBtn,
    html: `
      <div class="seg tone" id="jenisSeg">
        ${['Keluar', 'Masuk', ...(isEdit ? [] : ['Transfer'])].map(j =>
          `<label><input type="radio" name="jenis" value="${j}" ${base.jenis === j ? 'checked' : ''}><span>${j === 'Keluar' ? 'Pengeluaran' : j === 'Masuk' ? 'Pemasukan' : 'Transfer'}</span></label>`).join('')}
      </div>
      <div class="field"><label>Nominal</label>
        <div class="input-prefix"><span>Rp</span><input class="input" name="nominal" inputmode="numeric" placeholder="0" autocomplete="off" required></div></div>
      <div class="field-row keep">
        <div class="field"><label>Tanggal</label><input class="input" type="date" name="tanggal" value="${esc(base.tanggal)}" required></div>
        <div class="field"><label id="lblDompet">Dompet</label><select class="select" name="dompet">${walletOpts(base.dompet)}</select></div>
      </div>
      <div class="field" id="boxTujuan" hidden><label>Ke Dompet (Tujuan)</label>
        <select class="select" name="dompetTujuan">${walletOpts('')}</select></div>
      <div class="field" id="boxKategori"><label>Kategori</label><select class="select" name="kategori"></select></div>
      <div class="field" id="boxGoal" hidden><label>Alokasikan ke Target Tabungan</label>
        <select class="select" name="goalId"></select></div>
      <div class="field"><label>Keterangan</label><input class="input" name="keterangan" maxlength="200" placeholder="Opsional" value="${esc(base.keterangan)}"></div>`,
    onMount(d, form) {
      const nom = form.nominal; bindMoney(nom); setMoney(nom, base.nominal);
      const jenisVal = () => form.querySelector('input[name="jenis"]:checked').value;

      const refresh = () => {
        const j = jenisVal();
        form.querySelector('#boxTujuan').hidden = j !== 'Transfer';
        form.querySelector('#boxKategori').hidden = j === 'Transfer';
        form.querySelector('#lblDompet').textContent = j === 'Transfer' ? 'Dari Dompet' : 'Dompet';
        if (j === 'Transfer') {
          const other = state.wallets.find(w => w.nama !== form.dompet.value);
          if (other && form.dompetTujuan.value === form.dompet.value) form.dompetTujuan.value = other.nama;
        }
        // kategori
        const list = [...(j === 'Masuk' ? state.settings.incomeCategories : state.settings.expenseCategories)];
        const want = form.kategori.value || base.kategori;
        if (want && !list.includes(want)) list.unshift(want);
        form.kategori.innerHTML = list.map(c => `<option ${c === want ? 'selected' : ''}>${esc(c)}</option>`).join('');
        refreshGoal();
      };
      const refreshGoal = () => {
        const show = jenisVal() === 'Keluar' && form.kategori.value === 'Tabungan' && state.goals.length > 0;
        form.querySelector('#boxGoal').hidden = !show;
        const want = form.goalId.value || base.goalId;
        form.goalId.innerHTML = '<option value="">— Tanpa target —</option>' +
          state.goals.map(g => `<option value="${esc(g.id)}" ${g.id === want ? 'selected' : ''}>${esc(g.nama)}</option>`).join('');
      };
      form.querySelectorAll('input[name="jenis"]').forEach(r => r.addEventListener('change', () => { form.kategori.value = ''; refresh(); }));
      form.kategori.addEventListener('change', refreshGoal);
      refresh();
      if (!isEdit) setTimeout(() => nom.focus(), 60);
      if (isEdit) bindDelete(d, tx);
    },
    async onSubmit(form, d) {
      const j = form.querySelector('input[name="jenis"]:checked').value;
      const payload = {
        jenis: j, tanggal: form.tanggal.value, dompet: form.dompet.value, dompetTujuan: form.dompetTujuan.value,
        nominal: parseMoney(form.nominal.value), kategori: form.kategori.value,
        goalId: form.goalId.value, keterangan: form.keterangan.value.trim()
      };
      if (!(payload.nominal > 0)) throw new Error('Nominal harus lebih dari 0.');
      await mutate(isEdit ? 'tx.update' : 'tx.create', isEdit ? { ...payload, id: tx.id } : payload);
      d.close();
    }
  });
}

function bindDelete(d, tx) {
  const btn = d.querySelector('[data-delete]');
  if (!btn) return;
  btn.onclick = async () => {
    const ok = await confirmDialog({ title: 'Hapus transaksi?', message: 'Transaksi ini akan dihapus permanen dan saldo dompet dihitung ulang.', okLabel: 'Hapus', danger: true });
    if (!ok) return;
    try { await mutate('tx.delete', { id: tx.id }); d.close(); }
    catch (e) { toast(e.message, 'error'); }
  };
}

/* =====================================================================
   HALAMAN DAFTAR TRANSAKSI
   ===================================================================== */
const F = { mode: 'cycle', from: '', to: '', q: '', wallet: 'ALL', jenis: 'ALL', kategori: 'ALL', limit: 100 };

window.addEventListener('spacechange', () => Object.assign(F, { wallet: 'ALL', jenis: 'ALL', kategori: 'ALL', q: '', limit: 100 }));

function filtered() {
  let from = '', to = '';
  if (F.mode === 'cycle') { const c = activeCycle(); from = c.start; to = c.end; }
  else if (F.mode === 'custom') { from = F.from; to = F.to; }
  const q = F.q.trim().toLowerCase();
  return txInRange(from, to).filter(t =>
    (F.wallet === 'ALL' || t.dompet === F.wallet) &&
    (F.jenis === 'ALL' || t.jenis === F.jenis || (F.jenis === 'Transfer' && t.jenis.startsWith('Transfer'))) &&
    (F.kategori === 'ALL' || t.kategori === F.kategori) &&
    (!q || (t.keterangan + ' ' + t.kategori + ' ' + t.dompet).toLowerCase().includes(q)));
}

export function render(root) {
  const cats = [...new Set([...state.settings.expenseCategories, ...state.settings.incomeCategories, ...state.transactions.map(t => t.kategori)])].sort();
  root.innerHTML = `
    <div class="page-head">
      <div id="periodBox" class="row wrap">
        <div class="seg seg-sm">
          ${[['cycle', 'Siklus'], ['all', 'Semua'], ['custom', 'Kustom']].map(([v, l]) =>
            `<label><input type="radio" name="mode" value="${v}" ${F.mode === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>
        <div id="cycleSlot">${F.mode === 'cycle' ? cycleNavHTML() : ''}</div>
        <div id="customSlot" class="row" ${F.mode === 'custom' ? '' : 'hidden'}>
          <input class="input" type="date" id="fFrom" value="${esc(F.from)}" style="width:auto">
          <span class="muted">–</span>
          <input class="input" type="date" id="fTo" value="${esc(F.to)}" style="width:auto">
        </div>
      </div>
      <button class="btn" id="btnExport"><i class="fa-solid fa-file-csv"></i>Ekspor CSV</button>
    </div>

    <div class="card">
      <div class="toolbar" style="margin-bottom:12px">
        <input class="input" id="fQ" placeholder="Cari keterangan, kategori…" value="${esc(F.q)}" style="flex:2 1 200px">
        <select class="select" id="fWallet"><option value="ALL">Semua dompet</option>${state.wallets.map(w => `<option ${F.wallet === w.nama ? 'selected' : ''}>${esc(w.nama)}</option>`).join('')}</select>
        <select class="select" id="fJenis">${[['ALL', 'Semua jenis'], ['Masuk', 'Pemasukan'], ['Keluar', 'Pengeluaran'], ['Transfer', 'Transfer']].map(([v, l]) => `<option value="${v}" ${F.jenis === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="select" id="fKat"><option value="ALL">Semua kategori</option>${cats.map(c => `<option ${F.kategori === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </div>
      <div id="summaryLine" class="row wrap" style="margin-bottom:6px"></div>
      <div id="txList"></div>
    </div>`;

  bindCycleNav(root);
  const list = $('#txList', root), sumEl = $('#summaryLine', root);

  const paint = () => {
    const rows = filtered();
    const s = summarize(rows);
    sumEl.innerHTML = `<span class="badge good">Masuk ${rupiah(s.masuk)}</span><span class="badge bad">Keluar ${rupiah(s.keluar)}</span>
      <span class="badge">${rows.length} transaksi</span>`;
    if (!rows.length) { list.innerHTML = emptyHTML('receipt', 'Tidak ada transaksi yang cocok dengan filter.'); return; }
    const shown = rows.slice(0, F.limit);
    list.innerHTML = txGroupsHTML(shown) +
      (rows.length > shown.length ? `<div style="text-align:center;padding:12px"><button class="btn btn-sm" id="more">Muat ${Math.min(100, rows.length - shown.length)} lagi</button></div>` : '');
    $$('[data-tx]', list).forEach(b => b.onclick = () => openTxForm({ tx: state.transactions.find(t => t.id === b.dataset.tx) }));
    const more = $('#more', list); if (more) more.onclick = () => { F.limit += 100; paint(); };
  };
  paint();

  $$('input[name="mode"]', root).forEach(r => r.onchange = () => { F.mode = r.value; F.limit = 100; render(root); });
  $('#fFrom', root)?.addEventListener('change', e => { F.from = e.target.value; paint(); });
  $('#fTo', root)?.addEventListener('change', e => { F.to = e.target.value; paint(); });
  $('#fQ', root).addEventListener('input', debounce(e => { F.q = e.target.value; F.limit = 100; paint(); }, 200));
  [['fWallet', 'wallet'], ['fJenis', 'jenis'], ['fKat', 'kategori']].forEach(([id, key]) =>
    $('#' + id, root).addEventListener('change', e => { F[key] = e.target.value; F.limit = 100; paint(); }));

  $('#btnExport', root).onclick = () => {
    const rows = filtered();
    if (!rows.length) return toast('Tidak ada data untuk diekspor.', 'error');
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['Tanggal,Dompet,Jenis,Kategori,Nominal,Keterangan',
      ...rows.map(t => [t.tanggal, q(t.dompet), t.jenis, q(t.kategori), t.nominal, q(t.keterangan)].join(','))].join('\n');
    download(`transaksi-${todayISO()}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
  };
}
