import { $, $$, esc } from './utils.js';
import { call, getSession, clearSession, isConfigured } from './api.js';
import { applyTheme, toggleDark } from './theme.js';
import { state, load, loadMe, subscribe, switchSpace, canWrite } from './store.js';
import { destroyCharts } from './charts.js';
import { toast, closeModal } from './ui.js';
import { openTxForm, render as renderTransactions } from './views/transactions.js';
import { render as renderDashboard } from './views/dashboard.js';
import { render as renderReports } from './views/reports.js';
import { render as renderWallets } from './views/wallets.js';
import { render as renderGoals } from './views/goals.js';
import { render as renderSettings } from './views/settings.js';
import { render as renderFamily } from './views/family.js';
import { showLogin, setOnLoggedIn, googleSignOut } from './views/login.js';

const ROUTES = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  transactions: { title: 'Transaksi', render: renderTransactions },
  reports: { title: 'Laporan Bulanan', render: renderReports },
  family: { title: 'Keluarga', render: renderFamily },
  wallets: { title: 'Dompet', render: renderWallets },
  goals: { title: 'Target Tabungan', render: renderGoals },
  settings: { title: 'Pengaturan', render: renderSettings }
};
const view = $('#view');
const currentRoute = () => { const h = location.hash.replace(/^#\/?/, ''); return ROUTES[h] ? h : 'dashboard'; };

/* ---------- shell: ruang aktif, akun, badge ---------- */
function renderShell() {
  const sel = $('#spaceSel');
  sel.innerHTML = state.spaces.map(s =>
    `<option value="${esc(s.id)}" ${s.id === state.spaceId ? 'selected' : ''}>${s.type === 'personal' ? '👤 Pribadi' : '👨‍👩‍👧 ' + esc(s.name)}</option>`).join('');
  const me = state.me;
  $('#userCard').innerHTML = me ? `${me.picture
      ? `<img class="avatar" src="${esc(me.picture)}" alt="" referrerpolicy="no-referrer">`
      : `<span class="avatar">${esc(me.name.charAt(0).toUpperCase())}</span>`}
    <div><div class="u-name">${esc(me.name)}</div><div class="u-mail">${esc(me.email)}</div></div>` : '';
  const badge = $('#famBadge');
  badge.hidden = !state.invites.length;
  badge.textContent = state.invites.length;
  document.body.classList.toggle('readonly', !!state.me && !canWrite());
}

function showLoading() {
  view.innerHTML = '<div class="empty" style="padding:80px 0"><span class="spinner" style="width:28px;height:28px"></span><p style="margin-top:12px">Memuat data…</p></div>';
}

function renderRoute() {
  if (!state.me) return;
  renderShell();
  const name = currentRoute();
  $('#pageTitle').textContent = ROUTES[name].title;
  document.title = `${ROUTES[name].title} · Pantau Dompetku`;
  $$('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === name));
  if (!state.loaded) { destroyCharts(); showLoading(); return; }
  const y = window.scrollY;
  destroyCharts();
  try { ROUTES[name].render(view); }
  catch (e) { console.error(e); view.innerHTML = `<div class="card"><div class="err-box">Terjadi kesalahan menampilkan halaman: ${esc(e.message)}</div></div>`; }
  window.scrollTo(0, y);
}

function setConnStatus(ok) {
  const el = $('#connStatus');
  el.classList.toggle('off', !ok);
  el.lastElementChild.textContent = ok ? 'Terhubung' : 'Terputus';
}

function showError(e) {
  setConnStatus(false);
  view.innerHTML = `<div class="card" style="max-width:520px;margin:40px auto;text-align:center">
    <div class="empty"><i class="fa-solid fa-cloud-bolt"></i><b style="color:var(--text)">Gagal memuat data</b><p style="margin-top:6px">${esc(e.message)}</p></div>
    <div class="row" style="justify-content:center"><button class="btn btn-primary" id="retry">Coba lagi</button></div></div>`;
  $('#retry').onclick = boot;
}

function goLogin(msg) {
  clearSession(); state.me = null; state.loaded = false;
  showLogin(msg);
}

async function boot() {
  $('#authRoot').hidden = true;
  $('#app').hidden = false;
  state.loaded = false;
  showLoading();
  try {
    if (!state.me) await loadMe();
    renderShell();
    await load();
    setConnStatus(true);
    if (state.invites.length) toast(`Anda punya ${state.invites.length} undangan keluarga. Buka menu Keluarga.`);
  } catch (e) {
    if (e.code === 'AUTH') goLogin(e.message);
    else showError(e);
  }
}

/* ---------- tombol & navigasi ---------- */
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
$('#logoutBtn').onclick = async () => {
  try { await call('auth.logout'); } catch (e) { /* abaikan */ }
  googleSignOut(); goLogin();
};
$('#spaceSel').onchange = async e => {
  closeMenu();
  try { await switchSpace(e.target.value); }
  catch (err) { if (err.code === 'AUTH') goLogin(err.message); else { toast(err.message, 'error'); renderShell(); } }
};
$('#refreshBtn').onclick = async () => {
  const ic = $('#refreshBtn i'); ic.classList.add('fa-spin');
  try { await loadMe(); await load(); setConnStatus(true); toast('Data diperbarui'); }
  catch (e) { if (e.code === 'AUTH') goLogin(e.message); else { toast(e.message, 'error'); setConnStatus(false); } }
  finally { ic.classList.remove('fa-spin'); }
};

window.addEventListener('hashchange', () => { closeModal(); renderRoute(); });
window.addEventListener('themechange', renderRoute);
subscribe(renderRoute);
setOnLoggedIn(boot);

/* ---------- mulai ---------- */
applyTheme();
if (!isConfigured() || !getSession()) showLogin(); else boot();
