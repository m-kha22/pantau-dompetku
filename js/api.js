import { CONFIG } from './config.js';

const KEY = 'pd_conn';

export function getConn() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && c.url) return c;
  } catch (e) { /* abaikan */ }
  return { url: CONFIG.API_URL || '', token: '' };
}
export const setConn = c => localStorage.setItem(KEY, JSON.stringify(c));
export const clearConn = () => localStorage.removeItem(KEY);

function fail(message, code) { const e = new Error(message); e.code = code; return e; }

/**
 * Panggil Apps Script. Content-Type text/plain sengaja dipakai agar request
 * tergolong "simple" (tanpa preflight CORS) — Apps Script tidak mendukung OPTIONS.
 */
export async function request(url, token, action, payload = {}) {
  if (!url) throw fail('URL API belum diatur.', 'NO_URL');
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, payload }),
      redirect: 'follow'
    });
  } catch (e) {
    throw fail('Tidak dapat terhubung ke server. Periksa koneksi internet dan URL Web App.', 'NETWORK');
  }
  let json;
  try { json = JSON.parse(await res.text()); }
  catch (e) { throw fail('Respons server tidak valid. Pastikan Web App di-deploy dengan akses "Anyone" dan URL berakhiran /exec.', 'BAD_RESPONSE'); }
  if (!json.ok) throw fail(json.error || 'Terjadi kesalahan.', /token/i.test(json.error || '') ? 'AUTH' : 'SERVER');
  return json.data;
}

export function call(action, payload) {
  const { url, token } = getConn();
  return request(url, token, action, payload);
}
