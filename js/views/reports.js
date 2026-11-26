import { $, $$, esc, rupiah, fmtDate } from '../utils.js';
import { state, saveSettings, txInRange, summarize, activeCycle, realCycle } from '../store.js';
import { cycleList, cycleShort, cycleTitle, shiftCycle } from '../cycle.js';
import { cycleChart, categoryChart, dailyChart, PALETTE } from '../charts.js';
import { toast } from '../ui.js';
import { emptyHTML } from '../components.js';
import { openPrintDialog } from './print.js';

let COUNT = Number(localStorage.getItem('pd_report_count')) || 6;
let sel = -1; // indeks siklus terpilih (-1 = terbaru)
let ANCHOR = 0; // geseran jendela grafik (khusus halaman Laporan)

export function render(root) {
  const s = state.settings.startDay;
  const anchor = shiftCycle(realCycle(), ANCHOR, s);
  const cycles = cycleList(COUNT, s, anchor);
  const rows = cycles.map(c => {
    const txs = txInRange(c.start, c.end), r = summarize(txs);
    return { c, txs, r, short: cycleShort(c, s), full: cycleTitle(c, s), masuk: r.masuk, keluar: r.keluar };
  });
  if (sel < 0 || sel >= rows.length) sel = rows.length - 1;
  const cur = rows[sel];
  const avgOut = rows.reduce((a, x) => a + x.keluar, 0) / rows.length;
  const avgIn = rows.reduce((a, x) => a + x.masuk, 0) / rows.length;

  const catEntries = Object.entries(cur.r.expenseByCat).sort((a, b) => b[1] - a[1]);
  const top = cur.txs.filter(t => t.jenis === 'Keluar').sort((a, b) => b.nominal - a.nominal).slice(0, 5);

  root.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="row between wrap">
        <div class="row wrap">
          <div class="field" style="flex-direction:row;align-items:center;gap:10px">
            <label for="startDay" style="white-space:nowrap">Tanggal gajian / awal siklus</label>
            <input class="input" type="number" id="startDay" min="1" max="28" value="${s}" style="width:76px">
            <button class="btn btn-primary btn-sm write-only" id="saveDay">Terapkan</button>
          </div>
        </div>
        <button class="btn" id="btnPrint"><i class="fa-solid fa-print"></i>Cetak Laporan</button>
        <div class="row">
          <span class="label">Tampilkan</span>
          <div class="seg seg-sm">${[3, 6, 12].map(n => `<label><input type="radio" name="cnt" value="${n}" ${COUNT === n ? 'checked' : ''}><span>${n} siklus</span></label>`).join('')}</div>
          <div class="row"><button class="btn-icon" id="prevAnchor" aria-label="Geser ke belakang"><i class="fa-solid fa-chevron-left"></i></button>
          <button class="btn-icon" id="nextAnchor" aria-label="Geser ke depan" ${ANCHOR >= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button></div>
        </div>
      </div>
      <p class="hint" style="margin-top:8px">${s === 1 ? 'Siklus = bulan kalender.' : `Siklus berjalan dari tanggal ${s} sampai tanggal ${s - 1} bulan berikutnya.`} Klik batang pada grafik untuk melihat detail siklus.</p>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-chart-column"></i>Grafik Bulanan (Siklus Gajian)</div>
        <span class="muted">Rata-rata keluar <b class="num">${rupiah(avgOut)}</b></span></div>
      <div class="chart-box"><canvas id="chRep"></canvas></div>
    </div>

    <div class="card section">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-table"></i>Ringkasan per Siklus</div></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Siklus</th><th class="right">Pemasukan</th><th class="right">Pengeluaran</th><th class="right">Selisih</th><th class="right">Rasio</th></tr></thead>
        <tbody>${rows.slice().reverse().map(x => {
          const i = rows.indexOf(x), ratio = x.masuk ? Math.round(x.keluar / x.masuk * 100) : (x.keluar ? 100 : 0);
          return `<tr data-i="${i}" class="${i === sel ? 'sel' : ''}"><td><b>${esc(x.full)}</b></td>
            <td class="right num text-success">${rupiah(x.masuk)}</td><td class="right num text-danger">${rupiah(x.keluar)}</td>
            <td class="right num ${x.masuk - x.keluar < 0 ? 'text-danger' : ''}"><b>${rupiah(x.masuk - x.keluar)}</b></td>
            <td class="right"><span class="badge ${ratio <= 70 ? 'good' : ratio <= 90 ? 'warn' : 'bad'}">${ratio}%</span></td></tr>`;
        }).join('')}
          <tr><td class="muted">Rata-rata</td><td class="right num muted">${rupiah(avgIn)}</td><td class="right num muted">${rupiah(avgOut)}</td><td class="right num muted">${rupiah(avgIn - avgOut)}</td><td></td></tr>
        </tbody></table></div>
    </div>

    <div class="page-head section" style="margin-bottom:10px"><h2>Detail: ${esc(cur.full)}</h2><span class="muted">${fmtDate(cur.c.start)} – ${fmtDate(cur.c.end)}</span></div>
    <div class="grid grid-2">
      <div class="card"><div class="card-head"><div class="card-title"><i class="fa-solid fa-chart-pie"></i>Kategori Pengeluaran</div></div>
        ${catEntries.length ? '<div class="chart-box sm"><canvas id="chCat"></canvas></div>' : emptyHTML('chart-pie', 'Tidak ada pengeluaran.')}</div>
      <div class="card"><div class="card-head"><div class="card-title"><i class="fa-solid fa-calendar-day"></i>Pengeluaran Harian</div></div>
        <div class="chart-box sm"><canvas id="chDay"></canvas></div></div>
    </div>
    <div class="grid grid-2 section">
      <div class="card"><div class="card-head"><div class="card-title"><i class="fa-solid fa-list-ol"></i>Rincian Kategori</div></div>
        ${catEntries.length ? catEntries.map(([k, v], i) => `<div class="kv"><span><i class="fa-solid fa-circle" style="color:${PALETTE[i % PALETTE.length]};font-size:9px;margin-right:8px"></i>${esc(k)}</span>
          <b class="num">${rupiah(v)} <small class="muted">${Math.round(v / cur.r.keluar * 100)}%</small></b></div>`).join('') : emptyHTML('list', 'Belum ada data.')}</div>
      <div class="card"><div class="card-head"><div class="card-title"><i class="fa-solid fa-wallet"></i>Per Dompet & Pengeluaran Terbesar</div></div>
        ${Object.entries(cur.r.byWallet).map(([n, v]) => `<div class="kv"><span>${esc(n)}</span><span class="num"><span class="text-success">+${rupiah(v.masuk)}</span> · <span class="text-danger">−${rupiah(v.keluar)}</span></span></div>`).join('') || '<p class="muted">Tidak ada transaksi.</p>'}
        ${top.length ? `<div class="label" style="margin:14px 0 4px">5 PENGELUARAN TERBESAR</div>` + top.map(t => `<div class="kv"><span>${esc(t.keterangan || t.kategori)} <small class="muted">· ${fmtDate(t.tanggal)}</small></span><b class="num">${rupiah(t.nominal)}</b></div>`).join('') : ''}</div>
    </div>
    ${state.space && state.space.type === 'family' ? `<div class="card section"><div class="card-head"><div class="card-title"><i class="fa-solid fa-people-group"></i>Keuangan Gabungan per Anggota</div></div>
      ${Object.keys(cur.r.byMember).length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Anggota</th><th class="right">Pemasukan</th><th class="right">Pengeluaran</th><th class="right">Porsi belanja</th></tr></thead><tbody>
      ${Object.entries(cur.r.byMember).sort((a, b) => b[1].keluar - a[1].keluar).map(([n, v]) => `<tr><td><b>${esc(n)}</b></td><td class="right num text-success">${rupiah(v.masuk)}</td><td class="right num text-danger">${rupiah(v.keluar)}</td><td class="right"><span class="badge">${cur.r.keluar ? Math.round(v.keluar / cur.r.keluar * 100) : 0}%</span></td></tr>`).join('')}</tbody></table></div>` : emptyHTML('people-group', 'Belum ada transaksi.')}</div>` : ''}`;

  cycleChart('chRep', rows, { selected: sel, onSelect: i => { sel = i; render(root); } });
  if (catEntries.length) categoryChart('chCat', cur.r.expenseByCat);
  dailyChart('chDay', cur.c, cur.txs);

  $$('tr[data-i]', root).forEach(tr => tr.onclick = () => { sel = Number(tr.dataset.i); render(root); });
  $$('input[name="cnt"]', root).forEach(r => r.onchange = () => { COUNT = Number(r.value); localStorage.setItem('pd_report_count', COUNT); sel = -1; render(root); });
  $('#prevAnchor', root).onclick = () => { ANCHOR -= COUNT; sel = -1; render(root); };
  $('#nextAnchor', root).onclick = () => { ANCHOR = Math.min(1, ANCHOR + COUNT); sel = -1; render(root); };
  $('#btnPrint', root).onclick = () => openPrintDialog(cur.c.start);
  $('#saveDay', root).onclick = async () => {
    const v = parseInt($('#startDay', root).value, 10);
    if (!(v >= 1 && v <= 28)) return toast('Tanggal harus antara 1 dan 28.', 'error');
    try { sel = -1; ANCHOR = 0; await saveSettings({ startDay: v }); toast(`Siklus dimulai setiap tanggal ${v}.`); }
    catch (e) { toast(e.message, 'error'); }
  };
}
