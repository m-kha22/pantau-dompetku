import { esc, rupiah, catIcon, dayLabel } from './utils.js';
import { CONFIG } from './config.js';
import { state, activeCycle, setCycleOffset, walletByName } from './store.js';
import { cycleTitle } from './cycle.js';
import { diffDays, todayISO, fmtRange } from './utils.js';

export function walletIcon(w) {
  if (w.ikon) return w.ikon;
  return { Tunai: 'money-bill-wave', 'E-Wallet': 'mobile-screen', Investasi: 'chart-line', Bank: 'building-columns' }[w.tipe] || 'wallet';
}

export function walletCardHTML(w, balance, { actions = false } = {}) {
  return `<div class="wallet-card" style="--wc:${esc(w.warna)}" data-wallet="${esc(w.id)}">
    <div class="w-top"><span class="w-ico"><i class="fa-solid fa-${walletIcon(w)}"></i></span>
      <div><div class="w-name">${esc(w.nama)}</div><div class="w-type">${esc(w.tipe)}</div></div></div>
    <div class="w-bal num">${rupiah(balance)}</div>
    ${actions ? `<div class="w-actions write-only"><button data-edit="${esc(w.id)}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
      <button data-del="${esc(w.id)}" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button></div>` : ''}
  </div>`;
}

export function txItemHTML(t) {
  const trf = t.jenis.startsWith('Transfer');
  const cls = trf ? 'trf' : t.jenis === 'Masuk' ? 'in' : 'out';
  const sign = trf ? (t.jenis === 'Transfer Masuk' ? '+' : '−') : t.jenis === 'Masuk' ? '+' : '−';
  const w = walletByName(t.dompet);
  return `<button class="tx" data-tx="${esc(t.id)}">
    <span class="tx-ico ${cls}"><i class="fa-solid fa-${catIcon(t.kategori, trf ? 'Transfer' : t.jenis)}"></i></span>
    <span class="tx-main"><b>${esc(t.kategori)}${trf ? ' · ' + esc(t.jenis.replace('Transfer ', '')) : ''}</b>
      <small><i class="dot" style="background:${esc(w ? w.warna : 'var(--muted)')}"></i>${esc(t.dompet)}${t.keterangan ? ' · ' + esc(t.keterangan) : ''}${state.space && state.space.type === 'family' && t.oleh ? ' · 👤 ' + esc(t.oleh) : ''}</small></span>
    <span class="tx-amt ${cls} num">${sign}${rupiah(t.nominal).replace('Rp ', 'Rp ')}</span>
  </button>`;
}

/** Daftar transaksi dikelompokkan per tanggal. */
export function txGroupsHTML(txs) {
  let html = '', last = '';
  txs.forEach(t => {
    if (t.tanggal !== last) { last = t.tanggal; html += `<div class="tx-group-head"><span>${esc(dayLabel(t.tanggal))}</span></div>`; }
    html += txItemHTML(t);
  });
  return html;
}

export function emptyHTML(icon, text) {
  return `<div class="empty"><i class="fa-solid fa-${icon}"></i>${esc(text)}</div>`;
}

export function statHTML({ icon, tone = '', label, value, sub = '', hero = false }) {
  return `<div class="card stat ${hero ? 'hero' : ''}">
    <div class="label"><span class="stat-ico ${tone}"><i class="fa-solid fa-${icon}"></i></span>${esc(label)}</div>
    <div class="value num">${value}</div><div class="sub">${sub}</div></div>`;
}

/* ---------- navigator siklus (dipakai Dashboard, Transaksi, Laporan) ---------- */
export function cycleNavHTML() {
  const c = activeCycle(), s = state.settings.startDay, off = state.cycleOffset;
  const today = todayISO();
  let sub = s === 1 ? fmtRange(c.start, c.end) : `Siklus gajian tgl ${s}`;
  if (off === 0) sub += ` · hari ke-${diffDays(c.start, today) + 1}/${diffDays(c.start, c.end) + 1}`;
  return `<div class="cycle-nav">
    <button class="btn-icon" data-cyc="-1" aria-label="Siklus sebelumnya"><i class="fa-solid fa-chevron-left"></i></button>
    <div class="cycle-label"><b>${esc(cycleTitle(c, s))}</b><small>${esc(sub)}</small></div>
    <button class="btn-icon" data-cyc="1" aria-label="Siklus berikutnya" ${off >= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
    ${off !== 0 ? '<button class="btn btn-sm btn-ghost" data-cyc="0">Sekarang</button>' : ''}
  </div>`;
}
export function bindCycleNav(root) {
  root.querySelectorAll('[data-cyc]').forEach(b => {
    b.onclick = () => { const v = Number(b.dataset.cyc); setCycleOffset(v === 0 ? 0 : state.cycleOffset + v); };
  });
}

export function swatchesHTML(colors, selected, attr = 'data-color') {
  return colors.map(c => `<button type="button" class="swatch ${c.toLowerCase() === (selected || '').toLowerCase() ? 'on' : ''}" ${attr}="${c}" style="background:${c}" aria-label="Warna ${c}"></button>`).join('');
}

export { CONFIG };
