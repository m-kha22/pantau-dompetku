import { $, $$, esc, rupiah, parseMoney, bindMoney, setMoney, todayISO, fmtDate } from '../utils.js';
import { state, mutate, realCycle } from '../store.js';
import { shiftCycle } from '../cycle.js';
import { formModal, confirmDialog, toast } from '../ui.js';
import { emptyHTML } from '../components.js';
import { openTxForm } from './transactions.js';

function openGoalForm(g = null) {
  const isEdit = !!g;
  const cur = { nama: '', targetNominal: 0, deadline: '', catatan: '', ...(g || {}) };
  formModal({
    title: isEdit ? 'Edit Target' : 'Target Baru',
    submitLabel: isEdit ? 'Simpan Perubahan' : 'Simpan Target',
    html: `
      <div class="field"><label>Nama target</label><input class="input" name="nama" maxlength="60" placeholder="mis. Beli laptop, Dana darurat" value="${esc(cur.nama)}" required></div>
      <div class="field"><label>Target nominal</label><div class="input-prefix"><span>Rp</span><input class="input" name="target" inputmode="numeric" placeholder="0"></div></div>
      <div class="field"><label>Tenggat (opsional)</label><input class="input" type="date" name="deadline" value="${esc(cur.deadline)}"></div>
      <div class="field"><label>Catatan</label><input class="input" name="catatan" maxlength="200" value="${esc(cur.catatan)}" placeholder="Opsional"></div>`,
    onMount(d, form) { bindMoney(form.target); setMoney(form.target, cur.targetNominal); },
    async onSubmit(form, d) {
      const payload = { nama: form.nama.value.trim(), targetNominal: parseMoney(form.target.value), deadline: form.deadline.value, catatan: form.catatan.value.trim() };
      if (!payload.nama) throw new Error('Nama target wajib diisi.');
      if (!(payload.targetNominal > 0)) throw new Error('Target nominal harus lebih dari 0.');
      await mutate(isEdit ? 'goal.update' : 'goal.create', isEdit ? { ...payload, id: g.id } : payload);
      d.close();
    }
  });
}

/** Setoran per siklus yang dibutuhkan sampai tenggat. */
function perCycleNeed(g) {
  if (!g.deadline || g.terkumpul >= g.targetNominal) return null;
  const s = state.settings.startDay;
  let c = realCycle(), n = 0;
  if (g.deadline < todayISO()) return { late: true };
  while (c.end < g.deadline && n < 600) { c = shiftCycle(c, 1, s); n++; }
  const cycles = n + 1;
  return { cycles, amount: Math.ceil((g.targetNominal - g.terkumpul) / cycles) };
}

export function render(root) {
  const total = state.goals.reduce((a, g) => a + g.terkumpul, 0);
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Target Tabungan</h2><p class="muted">${state.goals.length} target · terkumpul <b class="num">${rupiah(total)}</b></p></div>
      <button class="btn btn-primary write-only" id="addGoal"><i class="fa-solid fa-plus"></i>Tambah Target</button>
    </div>
    ${state.goals.length ? `<div class="grid grid-2">${state.goals.map(g => {
      const pct = g.targetNominal ? Math.min(100, Math.round(g.terkumpul / g.targetNominal * 100)) : 0;
      const need = perCycleNeed(g);
      return `<div class="card">
        <div class="row between"><div class="card-title" style="font-size:16px"><i class="fa-solid fa-bullseye"></i>${esc(g.nama)}</div><span class="badge ${pct >= 100 ? 'good' : ''}">${pct}%</span></div>
        <div class="bar ${pct >= 100 ? 'good' : ''}" style="margin:14px 0 8px;height:10px"><i style="width:${pct}%"></i></div>
        <div class="row between"><span class="num"><b>${rupiah(g.terkumpul)}</b></span><span class="muted num">${rupiah(g.targetNominal)}</span></div>
        <div class="muted" style="margin-top:10px;font-size:13.5px">
          ${g.deadline ? `<div><i class="fa-regular fa-calendar"></i> Tenggat ${fmtDate(g.deadline)}</div>` : ''}
          ${need && need.late ? '<div class="text-danger">Tenggat sudah lewat</div>' : need ? `<div>Perlu menabung ± <b class="num">${rupiah(need.amount)}</b> per siklus (${need.cycles} siklus lagi)</div>` : ''}
          ${pct >= 100 ? '<div class="text-success"><b>Target tercapai! 🎉</b></div>' : g.targetNominal > g.terkumpul ? `<div>Kurang ${rupiah(g.targetNominal - g.terkumpul)}</div>` : ''}
          ${g.catatan ? `<div>${esc(g.catatan)}</div>` : ''}
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn btn-primary btn-sm grow write-only" data-fund="${esc(g.id)}"><i class="fa-solid fa-piggy-bank"></i>Tambah Dana</button>
          <button class="btn-icon write-only" data-edit="${esc(g.id)}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon write-only" data-del="${esc(g.id)}" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button>
        </div></div>`;
    }).join('')}</div>` : `<div class="card">${emptyHTML('bullseye', 'Belum ada target. Buat target pertama, misalnya dana darurat.')}</div>`}
    <p class="hint" style="margin-top:14px">“Tambah Dana” mencatat pengeluaran kategori Tabungan dari dompet yang Anda pilih, lalu menambah jumlah terkumpul. Menghapus transaksi tersebut otomatis mengurangi kembali.</p>`;

  $('#addGoal', root).onclick = () => openGoalForm();
  $$('[data-edit]', root).forEach(b => b.onclick = () => openGoalForm(state.goals.find(g => g.id === b.dataset.edit)));
  $$('[data-fund]', root).forEach(b => b.onclick = () => openTxForm({ preset: { jenis: 'Keluar', kategori: 'Tabungan', goalId: b.dataset.fund, keterangan: 'Setoran ' + state.goals.find(g => g.id === b.dataset.fund).nama } }));
  $$('[data-del]', root).forEach(b => b.onclick = async () => {
    const g = state.goals.find(x => x.id === b.dataset.del);
    if (!await confirmDialog({ title: 'Hapus target?', message: `Target "${g.nama}" akan dihapus. Transaksi tabungan yang sudah tercatat tetap ada.`, okLabel: 'Hapus', danger: true })) return;
    try { await mutate('goal.delete', { id: g.id }); } catch (e) { toast(e.message, 'error'); }
  });
}
