import { CONFIG } from './config.js';

const SKEY = 'pd_session';
let spaceId = '';

export const getSession = () => localStorage.getItem(SKEY) || '';
export const setSession = t => localStorage.setItem(SKEY, t);
export const clearSession = () => localStorage.removeItem(SKEY);
export const setSpace = id => { spaceId = id || ''; };
export const isConfigured = () => !!CONFIG.API_URL && !!CONFIG.GOOGLE_CLIENT_ID;

function fail(message, code) { const e = new Error(message); e.code = code; return e; }

/**
 * Panggil Apps Script. Content-Type text/plain sengaja dipakai agar request tergolong "simple"
 * (tanpa preflight CORS) — Apps Script tidak mendukung OPTIONS.
 * Kode error: AUTH (sesi tidak valid) · FORBIDDEN · LIMIT · NETWORK · BAD_RESPONSE · SERVER
 */
export async function call(action, payload = {}) {
  if (!CONFIG.API_URL) throw fail('API_URL belum diisi di js/config.js.', 'CONFIG');
  let res;
  try {
    res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, session: getSession(), spaceId, payload }),
      redirect: 'follow'
    });
  } catch (e) {
    throw fail('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', 'NETWORK');
  }
  let json;
  try { json = JSON.parse(await res.text()); }
  catch (e) { throw fail('Respons server tidak valid. Pastikan Web App di-deploy dengan akses "Anyone" dan API_URL berakhiran /exec.', 'BAD_RESPONSE'); }
  if (!json.ok) throw fail(json.error || 'Terjadi kesalahan.', json.code || 'SERVER');
  return json.data;
}
