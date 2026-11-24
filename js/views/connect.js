import { esc } from '../utils.js';
import { getConn, setConn, request } from '../api.js';

/** Layar penghubung ke Apps Script. onDone dipanggil setelah koneksi berhasil. */
let onDoneCb = null;
export const setOnConnected = fn => { onDoneCb = fn; };

export function showConnect(message = '', draft = null) {
  const root = document.getElementById('connectRoot');
  const conn = draft || getConn();
  document.getElementById('app').hidden = true;
  root.hidden = false;
  root.innerHTML = `<div class="connect"><div class="card">
    <div class="brand"><div class="brand-logo"><i class="fa-solid fa-wallet"></i></div><div><b>Pantau Dompetku</b><small>Hubungkan ke backend Apps Script</small></div></div>
    ${message ? `<div class="err-box" style="margin-bottom:14px">${esc(message)}</div>` : ''}
    <form class="form" id="cForm" novalidate>
      <div class="field"><label>URL Web App</label><input class="input" name="url" value="${esc(conn.url)}" placeholder="https://script.google.com/macros/s/…/exec" required autocomplete="off"></div>
      <div class="field"><label>Token API <span class="muted">(kosongkan bila belum diatur)</span></label><input class="input" name="token" type="password" value="${esc(conn.token)}" autocomplete="off"></div>
      <button class="btn btn-primary btn-block" type="submit">Hubungkan</button>
      <p class="hint">Data koneksi hanya disimpan di browser ini (localStorage), tidak ikut ke GitHub.</p>
    </form></div></div>`;
  const form = root.querySelector('#cForm');
  form.onsubmit = async e => {
    e.preventDefault();
    const url = form.url.value.trim(), token = form.token.value.trim();
    const btn = form.querySelector('button'); btn.disabled = true; btn.textContent = 'Menguji…';
    try {
      await request(url, token, 'ping');
      setConn({ url, token });
      root.hidden = true; root.innerHTML = '';
      if (onDoneCb) onDoneCb();
    } catch (err) {
      showConnect(err.message, { url, token });
    }
  };
}
