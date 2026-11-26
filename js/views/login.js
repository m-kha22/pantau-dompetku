import { esc } from '../utils.js';
import { CONFIG } from '../config.js';
import { call, setSession, isConfigured } from '../api.js';
import { applyMe } from '../store.js';

let onLoggedIn = null;
export const setOnLoggedIn = fn => { onLoggedIn = fn; };

function waitForGoogle(cb, tries = 0) {
  if (window.google && window.google.accounts && window.google.accounts.id) return cb(true);
  if (tries > 80) return cb(false);
  setTimeout(() => waitForGoogle(cb, tries + 1), 100);
}

export function showLogin(message = '') {
  const root = document.getElementById('authRoot');
  document.getElementById('app').hidden = true;
  root.hidden = false;

  const feature = (icon, t, d) => `<li><i class="fa-solid fa-${icon}"></i><div><b>${t}</b><span>${d}</span></div></li>`;
  root.innerHTML = `<div class="auth"><div class="card auth-card">
    <div class="brand"><div class="brand-logo"><i class="fa-solid fa-wallet"></i></div><div><b>Pantau Dompetku</b><small>Keuangan pribadi & keluarga</small></div></div>
    <h1>Kelola uang dengan tenang.</h1>
    <ul class="features">
      ${feature('lock', 'Data terenkripsi', 'Setiap akun punya penyimpanan terpisah, dienkripsi AES-256.')}
      ${feature('people-group', 'Gabung dengan keluarga', 'Undang anggota keluarga ke ruang keuangan bersama.')}
      ${feature('print', 'Laporan siap cetak', 'Laporan bulanan sesuai siklus gajian, simpan sebagai PDF.')}
    </ul>
    ${message ? `<div class="err-box" style="margin:14px 0">${esc(message)}</div>` : ''}
    ${isConfigured() ? `<div id="gBtn" class="g-btn"><span class="spinner"></span></div>
      <p class="hint" style="text-align:center">Masuk dengan akun Google. Kami tidak pernah melihat kata sandi Anda.</p>`
      : `<div class="err-box"><b>Konfigurasi belum lengkap.</b><br>Isi <code>API_URL</code> dan <code>GOOGLE_CLIENT_ID</code> di <code>js/config.js</code>, lalu deploy ulang.</div>`}
  </div></div>`;

  if (!isConfigured()) return;
  waitForGoogle(ok => {
    const box = document.getElementById('gBtn');
    if (!box) return;
    if (!ok) { box.innerHTML = '<div class="err-box">Tidak dapat memuat Google Sign-In. Periksa koneksi, nonaktifkan pemblokir iklan, atau buka di Chrome/Safari (bukan browser dalam aplikasi).</div>'; return; }
    window.google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: handleCredential, ux_mode: 'popup', auto_select: false });
    box.innerHTML = '';
    window.google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'id', width: Math.max(220, Math.min(320, window.innerWidth - 80)) });
  });
}

async function handleCredential(resp) {
  const box = document.getElementById('gBtn');
  if (box) box.innerHTML = '<span class="spinner"></span> Memverifikasi…';
  try {
    const d = await call('auth.login', { idToken: resp.credential });
    setSession(d.session);
    applyMe(d);
    document.getElementById('authRoot').hidden = true;
    if (onLoggedIn) onLoggedIn();
  } catch (e) {
    showLogin(e.message);
  }
}

export function googleSignOut() {
  try { window.google.accounts.id.disableAutoSelect(); } catch (e) { /* abaikan */ }
}
