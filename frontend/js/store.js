import { call } from './api.js';
import { busy, toast } from './ui.js';
import { cycleContaining, shiftCycle } from './cycle.js';
import { todayISO } from './utils.js';

export const state = {
  wallets: [], transactions: [], goals: [],
  settings: { startDay: 1, expenseCategories: [], incomeCategories: [] },
  meta: {}, loaded: false,
  cycleOffset: 0          // 0 = siklus berjalan, -1 = siklus sebelumnya, dst.
};

const subs = new Set();
export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
export const emit = () => subs.forEach(fn => fn());

export async function load() {
  busy(true);
  try {
    const d = await call('bootstrap');
    state.wallets = d.wallets;
    // urut terbaru dulu: tanggal desc, lalu urutan input desc
    state.transactions = d.transactions
      .map((t, i) => ({ ...t, _i: i }))
      .sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : b._i - a._i));
    state.goals = d.goals;
    state.settings = d.settings;
    state.meta = d.meta || {};
    state.loaded = true;
    emit();
  } finally { busy(false); }
}

/** Kirim perubahan ke backend lalu muat ulang data. Error dilempar ke pemanggil. */
export async function mutate(action, payload, successMsg) {
  busy(true);
  try {
    const r = await call(action, payload);
    await load();
    toast(successMsg || (r && r.message) || 'Berhasil');
    return r;
  } finally { busy(false); }
}

/** Simpan pengaturan tanpa memuat ulang semua data. */
export async function saveSettings(patch) {
  busy(true);
  try {
    await call('settings.save', patch);
    Object.assign(state.settings, patch);
    if (patch.startDay !== undefined) state.cycleOffset = 0;
    emit();
  } finally { busy(false); }
}

/* ---------- siklus ---------- */
export const realCycle = () => cycleContaining(todayISO(), state.settings.startDay);
export const activeCycle = () => shiftCycle(realCycle(), state.cycleOffset, state.settings.startDay);
export function setCycleOffset(n) { state.cycleOffset = Math.min(1, n); emit(); }

/* ---------- turunan data ---------- */
export function walletBalances() {
  const byName = {};
  state.wallets.forEach(w => { byName[w.nama] = w.saldoAwal || 0; });
  state.transactions.forEach(t => {
    if (!(t.dompet in byName)) return;
    if (t.jenis === 'Masuk' || t.jenis === 'Transfer Masuk') byName[t.dompet] += t.nominal;
    else if (t.jenis === 'Keluar' || t.jenis === 'Transfer Keluar') byName[t.dompet] -= t.nominal;
  });
  const total = Object.values(byName).reduce((a, b) => a + b, 0);
  return { byName, total };
}

export const walletByName = n => state.wallets.find(w => w.nama === n);
export const txInRange = (from, to) => state.transactions.filter(t => (!from || t.tanggal >= from) && (!to || t.tanggal <= to));

/** Ringkasan arus kas. Transfer antar dompet tidak dihitung sebagai masuk/keluar. */
export function summarize(txs) {
  const r = { masuk: 0, keluar: 0, selisih: 0, expenseByCat: {}, incomeByCat: {}, byWallet: {}, count: 0 };
  txs.forEach(t => {
    if (t.jenis !== 'Masuk' && t.jenis !== 'Keluar') return;
    r.count++;
    const w = (r.byWallet[t.dompet] ||= { masuk: 0, keluar: 0 });
    if (t.jenis === 'Masuk') { r.masuk += t.nominal; w.masuk += t.nominal; r.incomeByCat[t.kategori] = (r.incomeByCat[t.kategori] || 0) + t.nominal; }
    else { r.keluar += t.nominal; w.keluar += t.nominal; r.expenseByCat[t.kategori] = (r.expenseByCat[t.kategori] || 0) + t.nominal; }
  });
  r.selisih = r.masuk - r.keluar;
  return r;
}

export function health(sum) {
  if (!sum.masuk && !sum.keluar) return { label: 'Belum ada data', cls: '', tone: '' };
  const ratio = sum.masuk > 0 ? (sum.keluar / sum.masuk) * 100 : 100;
  if (ratio <= 70) return { label: 'Sangat Sehat 😃', cls: 'text-success', tone: 'good', ratio };
  if (ratio <= 90) return { label: 'Waspada ⚠️', cls: 'text-warning', tone: 'warn', ratio };
  return { label: 'Perlu Perhatian 🚨', cls: 'text-danger', tone: 'bad', ratio };
}
