// Tiruan layanan Google Apps Script (Spreadsheet, Cache, Lock, Drive, UrlFetch, dst.) untuk pengujian di Node.
const fs = require('fs'), path = require('path'), vm = require('vm'), nodeCrypto = require('crypto');
const CLIENT_ID = 'test-client.apps.googleusercontent.com';

/* ---------- tiruan layanan Google ---------- */
class Sheet {
  constructor(name) { this.name = name; this.d = []; }
  getName() { return this.name; } setName(n) { this.name = n; return this; }
  setFrozenRows() {} 
  getLastRow() { let l = 0; this.d.forEach((r, i) => { if (r && r.some(c => c !== '' && c !== undefined)) l = i + 1; }); return l; }
  getLastColumn() { return this.d.reduce((m, r) => Math.max(m, (r || []).length), 0); }
  getRange(r, c, nr = 1, nc = 1) {
    const sh = this;
    const rng = {
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.d[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } o.push(row); } return o; },
      setValues(vals) { vals.forEach((row, i) => row.forEach((v, j) => rng._set(r + i, c + j, v))); return rng; },
      setValue(v) { rng._set(r, c, v); return rng; },
      _set(rr, cc, v) {
        if (typeof v === 'string') {
          if (v.startsWith('=')) throw new Error('RUMUS TERDETEKSI: ' + v);
          if (v.length > 50000) throw new Error('Sel > 50000 karakter');
          if (/^-?\d+(\.\d+)?$/.test(v.trim()) && v.trim() !== '') v = Number(v);   // Sheets mengubah teks-angka jadi angka
        }
        (sh.d[rr - 1] = sh.d[rr - 1] || [])[cc - 1] = v;
      },
      setFontWeight() { return rng; }, setNumberFormat() { return rng; }
    };
    return rng;
  }
  deleteRow(r) { this.d.splice(r - 1, 1); }
}
class Spreadsheet {
  constructor(id, withDefault) { this.id = id; this.sheets = withDefault ? [new Sheet('Sheet1')] : []; }
  getId() { return this.id; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  getSheets() { return this.sheets; }
  insertSheet(n) { if (this.getSheetByName(n)) throw new Error('Sheet sudah ada'); const s = new Sheet(n); this.sheets.push(s); return s; }
}
const files = {}; let master;
function freshEnv() {
  master = new Spreadsheet('MASTER', false);
  for (const k in files) delete files[k];
  const props = {}, cacheMap = new Map(), trashed = new Set();
  const env = {
    console, Logger: { log: m => env.__logs.push(String(m)) }, __logs: [], __files: files, __trashed: trashed, __props: props,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (cacheMap.has(k) ? cacheMap.get(k) : null), put: (k, v) => { cacheMap.set(k, String(v)); }, remove: k => cacheMap.delete(k) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
    Utilities: {
      getUuid: () => nodeCrypto.randomUUID(),
      formatDate: (d, tz, f) => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
    },
    UrlFetchApp: { fetch: url => {
      const t = decodeURIComponent(url.split('id_token=')[1] || '');
      const m = t.match(/^TOKEN\|(.+?)\|(.+?)\|(.+?)(\|.*)?$/);
      if (!m) return { getResponseCode: () => 400, getContentText: () => '{}' };
      const extra = m[4] || '';
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({
        aud: extra.includes('badaud') ? 'other' : CLIENT_ID, iss: 'https://accounts.google.com', sub: m[1], email: m[2], name: m[3],
        email_verified: extra.includes('unverified') ? 'false' : 'true', exp: String(Math.floor(Date.now() / 1000) + 3600), picture: '' }) };
    } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => master,
      create: name => { const id = 'SS' + Object.keys(files).length + '_' + nodeCrypto.randomBytes(3).toString('hex'); files[id] = new Spreadsheet(id, true); return files[id]; },
      openById: id => (id === 'MASTER' ? master : files[id] || (() => { throw new Error('File tidak ada: ' + id); })())
    },
    DriveApp: {
      getFileById: id => ({ moveTo() {}, setTrashed: v => { if (v) { trashed.add(id); delete files[id]; } } }),
      createFolder: () => ({ getId: () => 'FOLDER1' }), getFolderById: () => ({})
    }
  };
  vm.createContext(env);
  for (const f of ['Config', 'Util', 'Crypto', 'Master', 'Auth', 'Spaces', 'Store', 'Wallets', 'Transactions', 'Goals', 'Settings', 'Ai', 'Migrate', 'Code'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, `../appscript/${f}.gs`), 'utf8'), env, { filename: f + '.gs' });
  return env;
}


module.exports = { freshEnv, files, master: () => master, CLIENT_ID };
