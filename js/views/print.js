import { esc, rupiah, fmtDate, fmtRange, todayISO, MONTHS } from '../utils.js';
import { state, txInRange, summarize, health, walletBalances, realCycle } from '../store.js';
import { cycleList, cycleTitle, cycleShort, shiftCycle } from '../cycle.js';
import { formModal, closeModal } from '../ui.js';

const pct = (v, t) => (t ? Math.round(v / t * 100) : 0);

function catTable(title, byCat, total, tone) {
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '';
  return `<section class="pr-sec"><h3>${title}</h3><table class="pr-tbl"><thead><tr><th>Kategori</th><th class="r">Nominal</th><th class="r">%</th><th style="width:34%"></th></tr></thead><tbody>
    ${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${rupiah(v)}</td><td class="r">${pct(v, total)}%</td>
      <td><span class="pr-bar ${tone}"><i style="width:${pct(v, total)}%"></i></span></td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td class="r">${rupiah(total)}</td><td></td><td></td></tr></tbody></table></section>`;
}

export function buildReportHTML(cycle, opt) {
  const s = state.settings.startDay;
  const txs = txInRange(cycle.start, cycle.end);
  const sum = summarize(txs), h = health(sum);
  const isFamily = state.space && state.space.type === 'family';
  const spaceName = state.space ? (state.space.type === 'personal' ? 'Pribadi' : state.space.name) : '';
  const ratio = sum.masuk ? Math.round(sum.keluar / sum.masuk * 100) : (sum.keluar ? 100 : 0);
  const bal = walletBalances(cycle.end);

  const trend = cycleList(6, s, cycle).map(c => ({ c, r: summarize(txInRange(c.start, c.end)) }));
  const top = txs.filter(t => t.jenis === 'Keluar').sort((a, b) => b.nominal - a.nominal).slice(0, 10);
  const asc = txs.slice().reverse();

  const members = isFamily && opt.members ? Object.entries(sum.byMember).sort((a, b) => b[1].keluar - a[1].keluar) : [];

  return `
  <div class="pr">
    <header class="pr-head">
      <div><div class="pr-brand">Pantau Dompetku</div><h1>Laporan Keuangan</h1>
        <div class="pr-sub">${esc(spaceName)}${isFamily ? ' · Ruang Keluarga' : ''}</div></div>
      <div class="pr-meta"><b>${esc(cycleTitle(cycle, s))}</b><div>Periode ${esc(fmtRange(cycle.start, cycle.end))}</div>
        <div>Dicetak ${esc(fmtDate(todayISO()))} oleh ${esc(state.me ? state.me.name : '')}</div></div>
    </header>

    <section class="pr-cards">
      <div><span>Pemasukan</span><b class="g">${rupiah(sum.masuk)}</b></div>
      <div><span>Pengeluaran</span><b class="r">${rupiah(sum.keluar)}</b></div>
      <div><span>Selisih</span><b class="${sum.selisih < 0 ? 'r' : ''}">${rupiah(sum.selisih)}</b></div>
      <div><span>Rasio pengeluaran</span><b>${ratio}%</b><em>${esc(h.label.replace(/[^\p{L}\p{N} ]/gu, '').trim())}</em></div>
    </section>

    ${opt.wallets ? `<section class="pr-sec"><h3>Saldo Dompet per ${esc(fmtDate(cycle.end))}</h3><table class="pr-tbl"><thead><tr><th>Dompet</th><th>Tipe</th><th class="r">Saldo</th><th class="r">Pemasukan</th><th class="r">Pengeluaran</th></tr></thead><tbody>
      ${state.wallets.map(w => { const v = sum.byWallet[w.nama] || { masuk: 0, keluar: 0 }; return `<tr><td>${esc(w.nama)}</td><td>${esc(w.tipe)}</td><td class="r">${rupiah(bal.byName[w.nama])}</td><td class="r">${rupiah(v.masuk)}</td><td class="r">${rupiah(v.keluar)}</td></tr>`; }).join('')}
      <tr class="tot"><td colspan="2">Total</td><td class="r">${rupiah(bal.total)}</td><td></td><td></td></tr></tbody></table></section>` : ''}

    ${catTable('Pengeluaran per Kategori', sum.expenseByCat, sum.keluar, 'out')}
    ${catTable('Pemasukan per Kategori', sum.incomeByCat, sum.masuk, 'in')}

    ${members.length ? `<section class="pr-sec"><h3>Kontribusi per Anggota</h3><table class="pr-tbl"><thead><tr><th>Anggota</th><th class="r">Pemasukan</th><th class="r">Pengeluaran</th><th class="r">Porsi belanja</th></tr></thead><tbody>
      ${members.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="r">${rupiah(v.masuk)}</td><td class="r">${rupiah(v.keluar)}</td><td class="r">${pct(v.keluar, sum.keluar)}%</td></tr>`).join('')}</tbody></table></section>` : ''}

    <section class="pr-sec"><h3>Perbandingan 6 Siklus Terakhir</h3><table class="pr-tbl"><thead><tr><th>Siklus</th><th class="r">Pemasukan</th><th class="r">Pengeluaran</th><th class="r">Selisih</th></tr></thead><tbody>
      ${trend.map(({ c, r }) => `<tr class="${c.start === cycle.start ? 'hl' : ''}"><td>${esc(cycleTitle(c, s))}</td><td class="r">${rupiah(r.masuk)}</td><td class="r">${rupiah(r.keluar)}</td><td class="r">${rupiah(r.selisih)}</td></tr>`).join('')}</tbody></table></section>

    ${top.length ? `<section class="pr-sec"><h3>10 Pengeluaran Terbesar</h3><table class="pr-tbl"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="r">Nominal</th></tr></thead><tbody>
      ${top.map(t => `<tr><td>${esc(fmtDate(t.tanggal))}</td><td>${esc(t.kategori)}</td><td>${esc(t.keterangan || '-')}</td><td class="r">${rupiah(t.nominal)}</td></tr>`).join('')}</tbody></table></section>` : ''}

    ${opt.list ? `<section class="pr-sec pr-break"><h3>Daftar Transaksi (${asc.length})</h3>${asc.length ? `<table class="pr-tbl pr-list"><thead><tr><th>Tanggal</th><th>Dompet</th><th>Kategori</th><th>Keterangan</th>${isFamily ? '<th>Oleh</th>' : ''}<th class="r">Masuk</th><th class="r">Keluar</th></tr></thead><tbody>
      ${asc.map(t => { const trf = t.jenis.startsWith('Transfer'), inn = t.jenis === 'Masuk' || t.jenis === 'Transfer Masuk';
        return `<tr class="${trf ? 'trf' : ''}"><td>${esc(fmtDate(t.tanggal))}</td><td>${esc(t.dompet)}</td><td>${esc(t.kategori)}</td><td>${esc(t.keterangan || '')}</td>${isFamily ? `<td>${esc(t.oleh || '')}</td>` : ''}
        <td class="r">${inn ? rupiah(t.nominal) : ''}</td><td class="r">${inn ? '' : rupiah(t.nominal)}</td></tr>`; }).join('')}
      <tr class="tot"><td colspan="${isFamily ? 5 : 4}">Total (tidak termasuk transfer)</td><td class="r">${rupiah(sum.masuk)}</td><td class="r">${rupiah(sum.keluar)}</td></tr></tbody></table>` : '<p class="pr-empty">Tidak ada transaksi pada periode ini.</p>'}</section>` : ''}

    <footer class="pr-foot">Dibuat otomatis oleh Pantau Dompetku · ${esc(fmtDate(todayISO()))}</footer>
  </div>`;
}

export function printReport(cycle, opt) {
  const root = document.getElementById('printRoot');
  root.innerHTML = buildReportHTML(cycle, opt);
  const oldTitle = document.title;
  document.title = `Laporan Keuangan - ${cycleTitle(cycle, state.settings.startDay)}`;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; document.title = oldTitle; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 200);
}

/** Dialog opsi cetak. selectedStart = awal siklus yang dipilih di halaman Laporan. */
export function openPrintDialog(selectedStart) {
  const s = state.settings.startDay;
  const cycles = cycleList(24, s, shiftCycle(realCycle(), 0, s)).reverse();
  const isFamily = state.space && state.space.type === 'family';
  formModal({
    title: 'Cetak Laporan Bulanan', submitLabel: 'Cetak / Simpan PDF',
    html: `<div class="field"><label>Siklus</label><select class="select" name="cycle">
        ${cycles.map(c => `<option value="${c.start}" ${c.start === selectedStart ? 'selected' : ''}>${esc(cycleTitle(c, s))}</option>`).join('')}</select></div>
      <div class="field"><label>Isi laporan</label>
        <label class="check"><input type="checkbox" name="wallets" checked> Saldo per dompet</label>
        <label class="check"><input type="checkbox" name="list" checked> Daftar lengkap transaksi</label>
        ${isFamily ? '<label class="check"><input type="checkbox" name="members" checked> Kontribusi per anggota</label>' : ''}</div>
      <p class="hint">Di jendela cetak, pilih printer atau <b>“Simpan sebagai PDF”</b>. Ukuran A4 portrait.</p>`,
    onSubmit(form, d) {
      const c = cycles.find(x => x.start === form.cycle.value);
      closeModal();
      printReport(c, { wallets: form.wallets.checked, list: form.list.checked, members: isFamily && form.members ? form.members.checked : false });
    }
  });
}
