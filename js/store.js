import { call, setSpace } from './api.js';
import { busy, toast } from './ui.js';
import { cycleContaining, shiftCycle } from './cycle.js';
import { todayISO } from './utils.js';

export const state = {
  me: null, spaces: [], invites: [],
  spaceId: '', space: null, role: 'viewer',
  wallets: [], transactions: [], goals: [],
  settings: { startDay: 1, expenseCategories: [], incomeCategories: [] },
  meta: {}, loaded: false,
  cycleOffset: 0          // 0 = siklus berjalan, -1 = sebelumnya, dst.
};

const subs = new Set();
export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
export const emit = () => subs.forEach(fn => fn());
export const canWrite = () => state.role === 'owner' || state.role === 'member';

/* ---------- akun & ruang ---------- */
export function applyMe(d) {
  state.me = d.user; state.spaces = d.spaces; state.invites = d.invites;
  const saved = localStorage.getItem('pd_space');
  const pick = state.spaces.find(s => s.id === state.spaceId) || state.spaces.find(s => s.id === saved)
    || state.spaces.find(s => s.type === 'personal') || state.spaces[0];
  state.spaceId = pick ? pick.id : '';
  setSpace(state.spaceId);
  localStorage.setItem('pd_space', state.spaceId);
}
export async function loadMe() { applyMe(await call('auth.me')); }
/** Muat ulang daftar ruang/undangan (setelah buat/terima/keluar/hapus ruang). */
export async function refreshMe() { await loadMe(); emit(); }

export async function switchSpace(id) {
  state.spaceId = id; setSpace(id);
  localStorage.setItem('pd_space', id);
  state.cycleOffset = 0; state.loaded = false;
  window.dispatchEvent(new CustomEvent('spacechange'));
  emit();
  await load();
}

/* ---------- data ruang aktif ---------- */
export async function load() {
  busy(true);
  try {
    const d = await call('bootstrap');
    state.wallets = d.wallets;
    // terbaru dulu: tanggal desc, lalu urutan input desc
    state.transactions = d.transactions
      .map((t, i) => ({ ...t, _i: i }))
      .sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : b._i - a._i));
    state.goals = d.goals;
    state.settings = d.settings;
    state.meta = d.meta || {};
    state.role = state.meta.role || 'viewer';
    state.space = state.meta.space || null;
    state.loaded = true;
    emit();
  } finally { busy(false); }
}

/** Kirim perubahan data lalu muat ulang. Error dilempar ke pemanggil. */
export async function mutate(action, payload, successMsg) {
  if (!canWrite()) throw new Error('Akses Anda di ruang ini hanya-lihat.');
  busy(true);
  try {
    const r = await call(action, payload);
    await load();
    toast(successMsg || (r && r.message) || 'Berhasil');
    return r;
  } finally { busy(false); }
}

export async function saveSettings(patch) {
  if (!canWrite()) throw new Error('Akses Anda di ruang ini hanya-lihat.');
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
export function walletBalances(upTo = '') {
  const byName = {};
  state.wallets.forEach(w => { byName[w.nama] = w.saldoAwal || 0; });
  state.transactions.forEach(t => {
    if (!(t.dompet in byName) || (upTo && t.tanggal > upTo)) return;
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
  const r = { masuk: 0, keluar: 0, selisih: 0, expenseByCat: {}, incomeByCat: {}, byWallet: {}, byMember: {}, count: 0 };
  txs.forEach(t => {
    if (t.jenis !== 'Masuk' && t.jenis !== 'Keluar') return;
    r.count++;
    const w = (r.byWallet[t.dompet] ||= { masuk: 0, keluar: 0 });
    const m = (r.byMember[t.oleh || '—'] ||= { masuk: 0, keluar: 0 });
    if (t.jenis === 'Masuk') { r.masuk += t.nominal; w.masuk += t.nominal; m.masuk += t.nominal; r.incomeByCat[t.kategori] = (r.incomeByCat[t.kategori] || 0) + t.nominal; }
    else { r.keluar += t.nominal; w.keluar += t.nominal; m.keluar += t.nominal; r.expenseByCat[t.kategori] = (r.expenseByCat[t.kategori] || 0) + t.nominal; }
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
