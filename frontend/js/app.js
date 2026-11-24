import { $, $$, esc } from './utils.js';
import { getConn } from './api.js';
import { applyTheme, toggleDark } from './theme.js';
import { state, load, subscribe } from './store.js';
import { destroyCharts } from './charts.js';
import { toast, closeModal } from './ui.js';
import { openTxForm, render as renderTransactions } from './views/transactions.js';
import { render as renderDashboard } from './views/dashboard.js';
import { render as renderReports } from './views/reports.js';
import { render as renderWallets } from './views/wallets.js';
import { render as renderGoals } from './views/goals.js';
import { render as renderSettings } from './views/settings.js';
import { showConnect, setOnConnected } from './views/connect.js';

const ROUTES = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  transactions: { title: 'Transaksi', render: renderTransactions },
  reports: { title: 'Laporan Bulanan', render: renderReports },
  wallets: { title: 'Dompet', render: renderWallets },
  goals: { title: 'Target Tabungan', render: renderGoals },
  settings: { title: 'Pengaturan', render: renderSettings }
};
const view = $('#view');

const currentRoute = () => { const h = location.hash.replace(/^#\/?/, ''); return ROUTES[h] ? h : 'dashboard'; };

function renderRoute() {
  if (!state.loaded) return;
  const name = currentRoute();
  const y = window.scrollY;
  destroyCharts();
  $('#pageTitle').textContent = ROUTES[name].title;
  document.title = `${ROUTES[name].title} · Pantau Dompetku`;
  $$('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === name));
  try { ROUTES[name].render(view); }
  catch (e) { console.error(e); view.innerHTML = `<div class="card"><div class="err-box">Terjadi kesalahan menampilkan halaman: ${esc(e.message)}</div></div>`; }
  window.scrollTo(0, y);
}

function showLoading() {
  view.innerHTML = '<div class="empty" style="padding:80px 0"><span class="spinner" style="width:28px;height:28px"></span><p style="margin-top:12px">Memuat data…</p></div>';
}

function showError(e) {
  setConnStatus(false);
  view.innerHTML = `<div class="card" style="max-width:520px;margin:40px auto;text-align:center">
    <div class="empty"><i class="fa-solid fa-cloud-bolt"></i><b style="color:var(--text)">Gagal memuat data</b><p style="margin-top:6px">${esc(e.message)}</p></div>
    <div class="row" style="justify-content:center"><button class="btn btn-primary" id="retry">Coba lagi</button><button class="btn" id="toConnect">Pengaturan koneksi</button></div></div>`;
  $('#retry').onclick = boot;
  $('#toConnect').onclick = () => showConnect(e.message);
}

function setConnStatus(ok) {
  const el = $('#connStatus');
  el.classList.toggle('off', !ok);
  el.lastElementChild.textContent = ok ? 'Terhubung' : 'Terputus';
}

async function boot() {
  $('#connectRoot').hidden = true;
  $('#app').hidden = false;
  showLoading();
  try {
    await load();           // memicu emit -> renderRoute
    setConnStatus(true);
  } catch (e) {
    if (e.code === 'AUTH' || e.code === 'NO_URL') showConnect(e.message);
    else showError(e);
  }
}

/* ---------- shell: sidebar, tombol, tema ---------- */
const sidebar = $('#sidebar'), scrim = $('#scrim');
const openMenu = () => { sidebar.classList.add('open'); scrim.classList.add('on'); };
const closeMenu = () => { sidebar.classList.remove('open'); scrim.classList.remove('on'); };

$('#menuBtn').onclick = openMenu;
$('#bnMenu').onclick = openMenu;
scrim.onclick = closeMenu;
$$('#nav a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

$('#themeToggle').onclick = toggleDark;
$('#addTxTop').onclick = () => openTxForm();
$('#fabAdd').onclick = () => openTxForm();
$('#refreshBtn').onclick = async () => {
  const ic = $('#refreshBtn i'); ic.classList.add('fa-spin');
  try { await load(); setConnStatus(true); toast('Data diperbarui'); }
  catch (e) { toast(e.message, 'error'); setConnStatus(false); }
  finally { ic.classList.remove('fa-spin'); }
};

window.addEventListener('hashchange', () => { closeModal(); renderRoute(); });
window.addEventListener('themechange', renderRoute);
subscribe(renderRoute);
setOnConnected(boot);

/* ---------- start ---------- */
applyTheme();
if (!getConn().url) showConnect(); else boot();
