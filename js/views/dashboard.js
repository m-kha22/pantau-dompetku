import { $, $$, esc, rupiah, mdLite, todayISO, diffDays } from '../utils.js';
import { call } from '../api.js';
import { state, activeCycle, realCycle, walletBalances, txInRange, summarize, health } from '../store.js';
import { cycleList, cycleShort, cycleTitle } from '../cycle.js';
import { cycleChart, categoryChart } from '../charts.js';
import { statHTML, walletCardHTML, txItemHTML, emptyHTML, cycleNavHTML, bindCycleNav } from '../components.js';
import { openTxForm } from './transactions.js';
import { busy, toast } from '../ui.js';

function goalsMini() {
  if (!state.goals.length) return emptyHTML('bullseye', 'Belum ada target tabungan.');
  return state.goals.slice(0, 3).map(g => {
    const pct = g.targetNominal ? Math.min(100, Math.round(g.terkumpul / g.targetNominal * 100)) : 0;
    return `<div style="margin-bottom:14px"><div class="row between"><b>${esc(g.nama)}</b><span class="badge ${pct >= 100 ? 'good' : ''}">${pct}%</span></div>
      <div class="bar ${pct >= 100 ? 'good' : ''}" style="margin:8px 0 4px"><i style="width:${pct}%"></i></div>
      <small class="muted num">${rupiah(g.terkumpul)} / ${rupiah(g.targetNominal)}</small></div>`;
  }).join('');
}

export function render(root) {
  const s = state.settings.startDay;
  const cyc = activeCycle();
  const txs = txInRange(cyc.start, cyc.end);
  const sum = summarize(txs);
  const bal = walletBalances();
  const h = health(sum);

  // proyeksi (hanya untuk siklus berjalan)
  const today = todayISO();
  let proj = '';
  if (state.cycleOffset === 0 && sum.keluar > 0) {
    const elapsed = Math.max(1, diffDays(cyc.start, today) + 1), total = diffDays(cyc.start, cyc.end) + 1;
    proj = `Rata-rata <b class="num">${rupiah(sum.keluar / elapsed)}</b>/hari · proyeksi akhir siklus <b class="num">${rupiah(sum.keluar / elapsed * total)}</b>`;
  }

  root.innerHTML = `
    <div class="page-head"><h2>Ringkasan</h2>${cycleNavHTML()}</div>

    <div class="grid grid-4">
      ${statHTML({ hero: true, icon: 'vault', label: 'Total Saldo', value: rupiah(bal.total), sub: `${state.wallets.length} dompet` })}
      ${statHTML({ icon: 'arrow-down', tone: 'in', label: 'Pemasukan', value: rupiah(sum.masuk), sub: 'siklus ini' })}
      ${statHTML({ icon: 'arrow-up', tone: 'out', label: 'Pengeluaran', value: rupiah(sum.keluar), sub: 'siklus ini' })}
      ${statHTML({ icon: 'scale-balanced', label: 'Sisa Siklus', value: `<span class="${sum.selisih < 0 ? 'text-danger' : ''}">${rupiah(sum.selisih)}</span>`, sub: 'pemasukan − pengeluaran' })}
    </div>

    <div class="section">
      <div class="page-head" style="margin-bottom:10px"><h2>Dompet</h2><a href="#/wallets" class="btn btn-sm btn-ghost">Kelola <i class="fa-solid fa-chevron-right"></i></a></div>
      ${state.wallets.length ? `<div class="wallet-strip">${state.wallets.map(w => walletCardHTML(w, bal.byName[w.nama])).join('')}</div>`
        : `<div class="card">${emptyHTML('wallet', 'Belum ada dompet.')}</div>`}
    </div>

    <div class="grid grid-2-1 section">
      <div class="card"><div class="card-head"><div class="card-title"><i class="fa-solid fa-chart-column"></i>Arus Kas per Siklus</div><a href="#/reports" class="btn btn-sm btn-ghost">Detail</a></div>
        <div class="chart-box"><canvas id="chCycle"></canvas></div></div>
      <div class="card"><div class="card-head"><div class="card-title"><i class="fa-solid fa-chart-pie"></i>Pengeluaran per Kategori</div></div>
        ${Object.keys(sum.expenseByCat).length ? '<div class="chart-box"><canvas id="chCat"></canvas></div>' : emptyHTML('chart-pie', 'Belum ada pengeluaran di siklus ini.')}</div>
    </div>

    <div class="grid grid-2 section">
      <div class="card">
        <div class="card-head"><div class="card-title"><i class="fa-solid fa-heart-pulse"></i>Kesehatan Keuangan</div></div>
        <div class="row between" style="margin-bottom:8px"><b class="${h.cls}" style="font-size:20px">${h.label}</b>
          ${h.ratio !== undefined ? `<span class="muted num">${Math.round(h.ratio)}% terpakai</span>` : ''}</div>
        <div class="bar ${h.tone}"><i style="width:${Math.min(100, h.ratio || 0)}%"></i></div>
        <p class="hint" style="margin-top:8px">Ideal: pengeluaran ≤ 70% pemasukan.</p>
        ${proj ? `<p style="margin-top:10px;font-size:14px">${proj}</p>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title"><i class="fa-solid fa-robot"></i>Asisten AI</div>
          <button class="btn btn-sm" id="btnAnalyze"><i class="fa-solid fa-wand-magic-sparkles"></i>Analisis</button></div>
        <div class="row" style="margin-bottom:10px">
          <input class="input" id="smartIn" placeholder="Catat cepat: “makan siang 25rb pakai cash”" maxlength="300">
          <button class="btn btn-primary btn-icon" id="btnSmart" aria-label="Catat dengan AI"><i class="fa-solid fa-bolt"></i></button>
        </div>
        <div class="ai-box" id="aiBox">Ketik kalimat transaksi lalu tekan ⚡, atau klik “Analisis” untuk evaluasi siklus ini.</div>
      </div>
    </div>

    <div class="grid grid-2 section">
      <div class="card"><div class="card-head"><div class="card-title"><i class="fa-solid fa-clock-rotate-left"></i>Transaksi Terbaru</div><a href="#/transactions" class="btn btn-sm btn-ghost">Semua</a></div>
        ${state.transactions.length ? state.transactions.slice(0, 6).map(txItemHTML).join('') : emptyHTML('receipt', 'Belum ada transaksi.')}</div>
      <div class="card"><div class="card-head"><div class="card-title"><i class="fa-solid fa-bullseye"></i>Target Tabungan</div><a href="#/goals" class="btn btn-sm btn-ghost">Kelola</a></div>${goalsMini()}</div>
    </div>`;

  bindCycleNav(root);
  $$('[data-tx]', root).forEach(b => b.onclick = () => openTxForm({ tx: state.transactions.find(t => t.id === b.dataset.tx) }));

  // grafik siklus (6 siklus berakhir di siklus aktif)
  const rows = cycleList(6, s, cyc).map(c => {
    const r = summarize(txInRange(c.start, c.end));
    return { short: cycleShort(c, s), full: cycleTitle(c, s), masuk: r.masuk, keluar: r.keluar };
  });
  cycleChart('chCycle', rows, { selected: rows.length - 1 });
  if ($('#chCat', root)) categoryChart('chCat', sum.expenseByCat);

  // AI
  const box = $('#aiBox', root);
  $('#btnAnalyze', root).onclick = async () => {
    box.innerHTML = '<span class="spinner"></span> Menganalisis…';
    busy(true);
    try { const r = await call('ai.analyze', { start: cyc.start, end: cyc.end }); box.innerHTML = mdLite(r.text) + (r.source === 'rule' ? '<p class="hint" style="margin-top:8px">Analisis otomatis berbasis aturan (isi GEMINI_API_KEY untuk AI sungguhan).</p>' : ''); }
    catch (e) { box.textContent = e.message; }
    finally { busy(false); }
  };
  const smart = async () => {
    const text = $('#smartIn', root).value.trim();
    if (!text) return;
    busy(true);
    try {
      const p = await call('ai.parse', { text, today: todayISO() });
      if (!p.nominal) toast('Nominal tidak terdeteksi, silakan isi manual.', 'error');
      $('#smartIn', root).value = '';
      openTxForm({ preset: p });
    } catch (e) { toast(e.message, 'error'); }
    finally { busy(false); }
  };
  $('#btnSmart', root).onclick = smart;
  $('#smartIn', root).addEventListener('keydown', e => { if (e.key === 'Enter') smart(); });
}
