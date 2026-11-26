// E2E UI: browser headless + frontend asli + backend Apps Script asli (tiruan layanan Google).
// Jalankan: PLAYWRIGHT_PATH=/path/ke/playwright node tests/e2e-ui.js
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const GM = require('./gas-mock');
const ROOT = path.join(__dirname, '../frontend'), OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const env = GM.freshEnv();
vm.runInContext('ensureMasterKey_(); ensureMaster_(true);', env);
env.__props.GOOGLE_CLIENT_ID = GM.CLIENT_ID;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p === '/js/config.js') {   // timpa config: arahkan ke API tiruan
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(fs.readFileSync(path.join(ROOT, p), 'utf8').replace("API_URL: ''", "API_URL: 'https://fake.test/exec'").replace("GOOGLE_CLIENT_ID: ''", `GOOGLE_CLIENT_ID: '${GM.CLIENT_ID}'`));
  }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

const errors = [], checks = []; let pass = 0;
const ok = (c, m) => { if (c) pass++; else { errors.push('GAGAL: ' + m); } };

async function newUser(browser, label, sub, email, name, vp, mobile) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile });
  await ctx.addInitScript(([token]) => {
    window.__printed = 0; window.print = () => { window.__printed++; };
    window.google = { accounts: { id: {
      initialize(cfg) { window.__gcb = cfg.callback; },
      renderButton(el) { el.innerHTML = '<button id="fakeGoogle" class="btn">Lanjutkan dengan Google</button>'; el.firstChild.onclick = () => window.__gcb({ credential: token }); },
      disableAutoSelect() {} } } };
  }, [`TOKEN|${sub}|${email}|${name}`]);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errors.push(`[${label}] console: ${m.text()}`); });
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('https://fake.test/')) {
      const out = env.doPost({ postData: { contents: route.request().postData() } }).getContent();
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: out });
    }
    return u.startsWith('http://localhost') ? route.continue() : route.abort();
  });
  return { ctx, page, label };
}
const closed = p => p.waitForSelector('dialog#modal:not([open])', { state: 'attached', timeout: 8000 });
const submit = p => p.click('dialog#modal button[type="submit"]');
const noOverflow = async (u, where) => ok(!(await u.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${u.label}: overflow horizontal di ${where}`);
async function login(u, base) {
  await u.page.goto(base + '/#/dashboard');
  await u.page.waitForSelector('#fakeGoogle', { timeout: 8000 });
  await u.page.click('#fakeGoogle');
  await u.page.waitForSelector('#view .page-head', { timeout: 10000 });
}
async function addTx(u, { nominal, kategori, ket }) {
  await u.page.click(u.label === 'alice' ? '#addTxTop' : '#fabAdd');
  await u.page.waitForSelector('dialog#modal[open] input[name="nominal"]');
  await u.page.fill('dialog#modal input[name="nominal"]', String(nominal));
  if (kategori) await u.page.selectOption('dialog#modal select[name="kategori"]', kategori);
  await u.page.fill('dialog#modal input[name="keterangan"]', ket);
  await submit(u.page); await closed(u.page);
}

(async () => {
  await new Promise(r => server.listen(8123, r));
  const base = 'http://localhost:8123';
  const browser = await chromium.launch();
  const alice = await newUser(browser, 'alice', '1001', 'alice@gmail.com', 'Alice', { width: 1366, height: 860 }, false);
  const bob = await newUser(browser, 'bob', '1002', 'bob@gmail.com', 'Bob', { width: 390, height: 844 }, true);
  const carol = await newUser(browser, 'carol', '1003', 'carol@gmail.com', 'Carol', { width: 390, height: 844 }, true);
  const A = alice.page, B = bob.page, C = carol.page;

  /* 1. login Alice */
  await A.goto(base + '/#/dashboard'); await A.waitForSelector('#fakeGoogle');
  await A.screenshot({ path: `${OUT}/e2e-login-desktop.png` });
  await A.click('#fakeGoogle'); await A.waitForSelector('#view .page-head');
  ok((await A.textContent('#userCard')).includes('Alice'), 'sidebar menampilkan nama Alice');
  ok((await A.$$eval('#spaceSel option', o => o.map(x => x.textContent))).join().includes('Pribadi'), 'pemilih ruang berisi Pribadi');

  /* 2. transaksi pribadi lewat UI */
  await addTx(alice, { nominal: 45000, kategori: 'Makanan', ket: 'Sarapan pribadi' });
  await A.goto(base + '/#/transactions'); await A.waitForSelector('#txList .tx');
  ok((await A.textContent('#txList')).includes('Sarapan pribadi'), 'transaksi pribadi tampil di daftar');

  /* 3. buat ruang keluarga + undang */
  await A.goto(base + '/#/family'); await A.waitForSelector('#newSpace');
  await A.click('#newSpace'); await A.fill('dialog#modal input[name="name"]', 'Keluarga Test'); await submit(A); await closed(A);
  await A.waitForSelector('#invite', { timeout: 8000 });
  ok((await A.inputValue('#spaceSel')) !== '' && (await A.$eval('#spaceSel', s => s.selectedOptions[0].textContent)).includes('Keluarga Test'), 'otomatis pindah ke ruang keluarga baru');
  ok(!(await A.textContent('#view')).includes('Sarapan pribadi'), 'data pribadi tidak bocor ke ruang keluarga');
  for (const [mail, role] of [['bob@gmail.com', 'member'], ['carol@gmail.com', 'viewer']]) {
    await A.click('#invite'); await A.fill('dialog#modal input[name="email"]', mail); await A.selectOption('dialog#modal select[name="role"]', role);
    await submit(A); await closed(A); await A.waitForTimeout(200);
  }
  await A.waitForSelector('#memberList .member');
  ok((await A.textContent('#memberList')).includes('bob@gmail.com') && (await A.textContent('#memberList')).includes('menunggu'), 'undangan tertunda tampil');
  await addTx(alice, { nominal: 250000, kategori: 'Belanja', ket: 'Belanja mingguan' });

  /* 4. Bob menerima undangan (mobile) */
  await login(bob, base);
  await B.waitForSelector('#famBadge:not([hidden])');
  ok((await B.textContent('#famBadge')) === '1', 'badge undangan di menu');
  await B.goto(base + '/#/family'); await B.waitForSelector('[data-accept]');
  await B.screenshot({ path: `${OUT}/e2e-family-invite-mobile.png` });
  await B.click('[data-accept]');
  await B.waitForFunction(() => document.querySelector('#spaceSel').selectedOptions[0].textContent.includes('Keluarga Test'), null, { timeout: 10000 });
  await B.waitForSelector('#memberList .member');
  await B.goto(base + '/#/transactions'); await B.waitForSelector('#txList .tx');
  ok((await B.textContent('#txList')).includes('Belanja mingguan') && (await B.textContent('#txList')).includes('👤 Alice'), 'Bob melihat transaksi Alice + nama pencatat');
  ok(!(await B.textContent('#txList')).includes('Sarapan pribadi'), 'Bob tidak melihat data pribadi Alice');
  await addTx(bob, { nominal: 60000, kategori: 'Transportasi', ket: 'Bensin motor' });
  await B.waitForSelector('#txList .tx');
  ok((await B.textContent('#txList')).includes('👤 Bob'), 'transaksi Bob tercatat atas nama Bob');
  await B.screenshot({ path: `${OUT}/e2e-transactions-family-mobile.png` });
  await B.goto(base + '/#/family'); await B.waitForSelector('#memberCard');
  await noOverflow(bob, 'halaman Keluarga'); await B.screenshot({ path: `${OUT}/e2e-family-mobile.png`, fullPage: true });
  ok(await B.isVisible('#leave'), 'anggota melihat tombol Keluar ruang'); ok(!(await B.isVisible('#invite')), 'anggota tidak melihat tombol Undang');

  /* 5. Carol viewer */
  await login(carol, base);
  await C.goto(base + '/#/family'); await C.waitForSelector('[data-accept]'); await C.click('[data-accept]');
  await C.waitForFunction(() => document.querySelector('#spaceSel').selectedOptions[0].textContent.includes('Keluarga Test'), null, { timeout: 10000 });
  await C.goto(base + '/#/dashboard'); await C.waitForSelector('#view .stat');
  ok(await C.evaluate(() => document.body.classList.contains('readonly')), 'viewer: mode hanya-lihat aktif');
  ok(!(await C.isVisible('#fabAdd')), 'viewer: tombol tambah tersembunyi');
  await C.goto(base + '/#/wallets'); await C.waitForSelector('.wallet-card');
  ok(!(await C.isVisible('#addWallet')), 'viewer: tombol tambah dompet tersembunyi');
  await C.screenshot({ path: `${OUT}/e2e-viewer-mobile.png` });

  /* 6. Alice: lihat kontribusi gabungan + ganti peran */
  await A.click('#refreshBtn'); await A.waitForTimeout(500);
  await A.goto(base + '/#/family'); await A.waitForSelector('#memberList .member');
  await A.waitForFunction(() => document.querySelectorAll('#memberList .member').length >= 3, null, { timeout: 8000 });
  const fam = await A.textContent('#view');
  ok(fam.includes('Bob') && fam.includes('Carol') && fam.includes('Keuangan Gabungan per Anggota'), 'Alice melihat 3 anggota + kontribusi gabungan');
  await A.screenshot({ path: `${OUT}/e2e-family-desktop.png`, fullPage: true });

  /* 7. cetak laporan */
  await A.goto(base + '/#/reports'); await A.waitForSelector('#btnPrint'); await A.click('#btnPrint');
  await A.waitForSelector('dialog#modal[open] select[name="cycle"]');
  ok(await A.isVisible('dialog#modal input[name="members"]'), 'opsi kontribusi anggota muncul di ruang keluarga');
  await submit(A);
  await A.waitForFunction(() => document.body.classList.contains('printing') && document.querySelector('#printRoot .pr'), null, { timeout: 5000 });
  await A.waitForFunction(() => window.__printed >= 1, null, { timeout: 3000 });
  const rep = await A.textContent('#printRoot');
  ['Laporan Keuangan', 'Keluarga Test', 'Belanja mingguan', 'Bensin motor', 'Kontribusi per Anggota', 'Bob', 'Alice', 'Rp 310.000', 'Saldo Dompet'].forEach(t => ok(rep.includes(t), `laporan memuat "${t}"`));
  await A.emulateMedia({ media: 'print' });
  ok(!(await A.isVisible('.sidebar')) && !(await A.isVisible('#view')), 'saat cetak, sidebar & UI aplikasi disembunyikan');
  await A.pdf({ path: `${OUT}/laporan-contoh.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
  ok(fs.statSync(`${OUT}/laporan-contoh.pdf`).size > 5000, 'PDF laporan terbentuk');
  await A.emulateMedia({ media: 'screen' });
  await A.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  ok(await A.evaluate(() => !document.body.classList.contains('printing') && document.getElementById('printRoot').innerHTML === ''), 'state cetak dibersihkan setelah selesai');

  /* 8. Pengaturan (akun) & logout */
  await A.goto(base + '/#/settings'); await A.waitForSelector('#logout');
  ok((await A.textContent('#view')).includes('alice@gmail.com') && (await A.textContent('#view')).includes('AES-256'), 'pengaturan menampilkan akun & info keamanan');
  await B.goto(base + '/#/settings'); await B.waitForSelector('#logout'); await noOverflow(bob, 'Pengaturan');
  await A.click('#logoutBtn'); await A.waitForSelector('#fakeGoogle');
  ok(await A.evaluate(() => !localStorage.getItem('pd_session')), 'logout menghapus sesi lokal');
  await A.reload(); await A.waitForSelector('#fakeGoogle');
  ok(true, 'setelah logout & reload tetap di layar login');
  await B.goto(base + '/#/dashboard'); await B.waitForSelector('#view .stat');
  await noOverflow(bob, 'Dashboard'); await B.screenshot({ path: `${OUT}/e2e-dashboard-mobile.png` });

  await browser.close(); server.close();
  console.log(errors.length ? errors.join('\n') + `\n\n${errors.length} MASALAH, ${pass} lulus` : `SEMUA ${pass} PENGECEKAN UI E2E LULUS`);
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('E2E CRASH:', e.message); process.exit(2); });
