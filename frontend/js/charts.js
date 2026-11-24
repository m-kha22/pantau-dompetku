import { rupiah, compact, fromISO, addDays, pad } from './utils.js';

const registry = {};
export const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#a855f7'];

export function destroyCharts() {
  Object.keys(registry).forEach(k => { registry[k].destroy(); delete registry[k]; });
}

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function make(id, cfg) {
  const el = document.getElementById(id);
  if (!el || !window.Chart) return null;
  const Chart = window.Chart;
  Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
  Chart.defaults.color = css('--muted');
  Chart.defaults.borderColor = css('--border');
  if (registry[id]) registry[id].destroy();
  registry[id] = new Chart(el, cfg);
  return registry[id];
}

const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

/** Batang pemasukan/pengeluaran per siklus + garis selisih. rows: [{short, full, masuk, keluar}] */
export function cycleChart(id, rows, { selected = -1, onSelect } = {}) {
  const ok = css('--success'), bad = css('--danger'), pri = css('--primary');
  const dim = i => selected < 0 || i === selected;
  return make(id, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.short),
      datasets: [
        { type: 'line', label: 'Selisih', data: rows.map(r => r.masuk - r.keluar), borderColor: pri, backgroundColor: pri, tension: .35, pointRadius: 4, borderWidth: 2.5, order: 0 },
        { label: 'Pemasukan', data: rows.map(r => r.masuk), backgroundColor: rows.map((_, i) => dim(i) ? ok : alpha(ok, .35)), borderRadius: 6, order: 1 },
        { label: 'Pengeluaran', data: rows.map(r => r.keluar), backgroundColor: rows.map((_, i) => dim(i) ? bad : alpha(bad, .35)), borderRadius: 6, order: 1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onClick: (_, els) => { if (els.length && onSelect) onSelect(els[0].index); },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => compact(v) } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            title: items => rows[items[0].dataIndex].full,
            label: c => ` ${c.dataset.label}: ${rupiah(c.parsed.y)}`
          }
        }
      }
    }
  });
}

/** Donat kategori. byCat: {kategori: nominal} */
export function categoryChart(id, byCat) {
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  let top = entries.slice(0, 8);
  const rest = entries.slice(8).reduce((s, e) => s + e[1], 0);
  if (rest > 0) top.push(['Lain-lain', rest]);
  const total = top.reduce((s, e) => s + e[1], 0);
  return make(id, {
    type: 'doughnut',
    data: { labels: top.map(e => e[0]), datasets: [{ data: top.map(e => e[1]), backgroundColor: top.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 2, borderColor: css('--surface') }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '64%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${rupiah(c.parsed)} (${total ? Math.round(c.parsed / total * 100) : 0}%)` } }
      }
    }
  });
}

/** Pengeluaran harian dalam satu siklus. */
export function dailyChart(id, cycle, txs) {
  const labels = [], data = [];
  const map = {};
  txs.forEach(t => { if (t.jenis === 'Keluar') map[t.tanggal] = (map[t.tanggal] || 0) + t.nominal; });
  let d = cycle.start, guard = 0;
  while (d <= cycle.end && guard++ < 40) {
    labels.push(String(fromISO(d).getDate()));
    data.push(map[d] || 0);
    d = addDays(d, 1);
  }
  return make(id, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Pengeluaran', data, backgroundColor: css('--primary'), borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => compact(v) } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => `Tanggal ${i[0].label}`, label: c => ` ${rupiah(c.parsed.y)}` } } }
    }
  });
}
