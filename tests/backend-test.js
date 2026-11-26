// Uji end-to-end backend dengan tiruan layanan Google. Jalankan: node tests/backend-test.js
const vm = require('vm');
const GM = require('./gas-mock');
const { files, CLIENT_ID } = GM, freshEnv = GM.freshEnv;
const master = new Proxy({}, { get: (_, k) => { const m = GM.master(); const v = m[k]; return typeof v === 'function' ? v.bind(m) : v; } });
const nodeCrypto = require('crypto');

/* ---------- harness ---------- */
let env = freshEnv(), fails = 0, passed = 0;
const ok = (c, m) => { if (c) passed++; else { fails++; console.log('FAIL:', m); } };
const call = (action, payload = {}, { session = '', spaceId = '' } = {}) => {
  const out = env.doPost({ postData: { contents: JSON.stringify({ action, payload, session, spaceId }) } });
  return JSON.parse(out.getContent());
};
const tok = (sub, email, name, extra = '') => `TOKEN|${sub}|${email}|${name}${extra}`;
const login = (sub, email, name) => { const r = call('auth.login', { idToken: tok(sub, email, name) }); if (!r.ok) throw new Error('login gagal: ' + r.error); return r.data; };
const expectErr = (r, code, m) => { ok(r.ok === false && (!code || r.code === code), `${m} (dapat: ${JSON.stringify(r).slice(0, 120)})`); };

/* ---------- skenario ---------- */
vm.runInContext('ensureMasterKey_(); ensureMaster_(true);', env);
env.__props.GOOGLE_CLIENT_ID = CLIENT_ID;

// 1. login
expectErr(call('auth.login', { idToken: 'sampah' }), 'AUTH', 'token acak ditolak');
expectErr(call('auth.login', { idToken: tok('1', 'x@y.com', 'X', '|badaud') }), 'AUTH', 'aud salah ditolak');
expectErr(call('auth.login', { idToken: tok('1', 'x@y.com', 'X', '|unverified') }), 'AUTH', 'email belum verifikasi ditolak');
const alice = login('1001', 'Alice@Gmail.com', 'Alice');
ok(alice.user.email === 'alice@gmail.com', 'email dinormalisasi lowercase');
ok(alice.spaces.length === 1 && alice.spaces[0].type === 'personal' && alice.spaces[0].role === 'owner', 'ruang pribadi dibuat otomatis');
ok(alice.session && alice.session.length === 64, 'sesi dibuat');
const A = { session: alice.session, spaceId: alice.spaces[0].id };
const alice2 = login('1001', 'alice@gmail.com', 'Alice');
ok(alice2.spaces[0].id === A.spaceId && Object.keys(files).length === 1, 'login ulang tidak membuat ruang baru');
// hash sesi saja yang tersimpan
ok(!JSON.stringify(master.sheets.map(s => s.d)).includes(alice.session), 'token sesi tidak tersimpan polos');
expectErr(call('bootstrap', {}, { session: 'salah', spaceId: A.spaceId }), 'AUTH', 'sesi salah ditolak');
expectErr(call('bootstrap', {}, { spaceId: A.spaceId }), 'AUTH', 'tanpa sesi ditolak');

// 2. data pribadi
let b = call('bootstrap', {}, A).data;
ok(b.wallets.length === 1 && b.wallets[0].nama === 'Cash', 'dompet bawaan');
ok(b.settings.startDay === 1 && b.meta.role === 'owner' && b.meta.space.type === 'personal', 'settings & meta');
ok(call('wallet.create', { nama: 'Rek. BSI', tipe: 'Bank', saldoAwal: 1000000, warna: '#00897b', ikon: 'wallet' }, A).ok, 'buat dompet');
expectErr(call('wallet.create', { nama: 'rek. bsi' }, A), '', 'nama dompet duplikat ditolak');
expectErr(call('wallet.create', { nama: '' }, A), '', 'nama kosong ditolak');
ok(call('tx.create', { jenis: 'Keluar', tanggal: '2026-11-25', dompet: 'Cash', nominal: 25000, kategori: 'Makanan', keterangan: '=HYPERLINK("x")' }, A).ok, 'tx dengan teks berawalan = aman (terenkripsi)');
ok(call('tx.create', { jenis: 'Masuk', tanggal: '2026-11-25', dompet: 'Rek. BSI', nominal: 6500000, kategori: 'Gaji' }, A).ok, 'tx masuk');
ok(call('tx.create', { jenis: 'Transfer', tanggal: '2026-11-25', dompet: 'Rek. BSI', dompetTujuan: 'Cash', nominal: 500000 }, A).ok, 'transfer');
expectErr(call('tx.create', { jenis: 'Keluar', tanggal: 'x', dompet: 'Cash', nominal: 1 }, A), '', 'tanggal buruk ditolak');
expectErr(call('tx.create', { jenis: 'Keluar', tanggal: '2026-11-25', dompet: 'Ghaib', nominal: 1 }, A), '', 'dompet tak dikenal ditolak');
expectErr(call('tx.create', { jenis: 'Keluar', tanggal: '2026-11-25', dompet: 'Cash', nominal: -5 }, A), '', 'nominal negatif ditolak');
b = call('bootstrap', {}, A).data;
ok(b.transactions.length === 4, '4 baris transaksi (transfer = 2)');
ok(b.transactions.find(t => t.kategori === 'Makanan').keterangan === '=HYPERLINK("x")', 'keterangan kembali utuh');
ok(b.transactions.every(t => t.oleh === 'Alice'), 'oleh tercatat');

// 3. enkripsi di sheet
const dump = JSON.stringify(Object.values(files)[0].sheets.map(s => s.d));
['Cash', 'Rek. BSI', 'Makanan', '25000', '6500000', 'Gaji', 'HYPERLINK', '2026-11-25', 'Alice'].forEach(s => ok(!dump.includes(s), `plaintext "${s}" TIDAK ada di sheet data`));
Object.values(files)[0].sheets.forEach(s => s.d.slice(1).forEach(r => { if (r[0] && r[1] !== undefined) ok(String(r[1]).startsWith('v1.'), `payload ${s.name}/${r[0]} terenkripsi`); }));
const spacesDump = JSON.stringify(master.getSheetByName('_Spaces').d);
ok(spacesDump.includes('v1.') && !spacesDump.includes(Buffer.from(vm.runInContext('Array.from(getKek_())', env)).toString('base64')), 'kunci data terbungkus, master key tidak ikut tersimpan');

// 4. target tabungan + update + delete
call('goal.create', { nama: 'Laptop', targetNominal: 12000000, deadline: '2027-03-10' }, A);
const goalId = call('bootstrap', {}, A).data.goals[0].id;
const fund = call('tx.create', { jenis: 'Keluar', tanggal: '2026-11-25', dompet: 'Rek. BSI', nominal: 1000000, kategori: 'Tabungan', goalId }, A).data.id;
ok(call('bootstrap', {}, A).data.goals[0].terkumpul === 1000000, 'dana masuk ke target');
call('tx.update', { id: fund, jenis: 'Keluar', tanggal: '2026-11-25', dompet: 'Rek. BSI', nominal: 1500000, kategori: 'Tabungan', goalId }, A);
ok(call('bootstrap', {}, A).data.goals[0].terkumpul === 1500000, 'update tx menyesuaikan target');
call('tx.delete', { id: fund }, A);
ok(call('bootstrap', {}, A).data.goals[0].terkumpul === 0, 'hapus tx mengurangi target');

// 5. transfer delete (pasangan), rename dompet, hapus dompet
const trf = call('bootstrap', {}, A).data.transactions.find(t => t.id.endsWith('-OUT'));
expectErr(call('tx.update', { id: trf.id, jenis: 'Keluar', tanggal: '2026-11-25', dompet: 'Cash', nominal: 1 }, A), '', 'transfer tidak bisa diedit');
call('tx.delete', { id: trf.id.replace('-OUT', '-IN') }, A);
ok(call('bootstrap', {}, A).data.transactions.length === 2, 'hapus satu sisi transfer menghapus pasangannya');
const wid = call('bootstrap', {}, A).data.wallets.find(w => w.nama === 'Rek. BSI').id;
call('wallet.update', { id: wid, nama: 'BSI Utama', tipe: 'Bank', saldoAwal: 1000000, warna: '#00897b' }, A);
ok(call('bootstrap', {}, A).data.transactions.some(t => t.dompet === 'BSI Utama'), 'rename dompet memperbarui transaksi');
expectErr(call('wallet.delete', { id: wid }, A), '', 'dompet bertransaksi tidak bisa dihapus');
call('settings.save', { startDay: 25, expenseCategories: ['Makanan', 'Zakat'] }, A);
const st = call('bootstrap', {}, A).data.settings;
ok(st.startDay === 25 && st.expenseCategories.includes('Tabungan') && st.expenseCategories.includes('Lainnya'), 'settings: startDay + kategori wajib dipertahankan');
expectErr(call('settings.save', { startDay: 31 }, A), '', 'startDay > 28 ditolak');

// 6. keluarga
const fam = call('space.create', { name: 'Keluarga Budi' }, A);
ok(fam.ok, 'buat ruang keluarga');
const F = { session: alice.session, spaceId: fam.data.spaceId };
ok(call('space.invite', { email: 'bob@gmail.com', role: 'member' }, F).ok, 'undang bob');
ok(call('space.invite', { email: 'carol@gmail.com', role: 'viewer' }, F).ok, 'undang carol');
expectErr(call('space.invite', { email: 'bob@gmail.com' }, F), '', 'undangan ganda ditolak');
expectErr(call('space.invite', { email: 'bukan-email' }, F), '', 'email invalid ditolak');
expectErr(call('space.invite', { email: 'x@y.com' }, A), '', 'ruang pribadi tidak bisa mengundang');
const bob = login('1002', 'bob@gmail.com', 'Bob'), carol = login('1003', 'carol@gmail.com', 'Carol'), dave = login('1004', 'dave@gmail.com', 'Dave');
ok(bob.invites.length === 1 && bob.spaces.length === 1, 'bob melihat undangan, belum jadi anggota');
expectErr(call('bootstrap', {}, { session: bob.session, spaceId: fam.data.spaceId }), 'FORBIDDEN', 'sebelum menerima: tidak ada akses');
expectErr(call('invite.accept', { inviteId: bob.invites[0].id }, { session: dave.session }), '', 'dave tidak bisa menerima undangan bob');
ok(call('invite.accept', { inviteId: bob.invites[0].id }, { session: bob.session }).ok, 'bob menerima');
ok(call('invite.accept', { inviteId: carol.invites[0].id }, { session: carol.session }).ok, 'carol menerima');
const BF = { session: bob.session, spaceId: fam.data.spaceId }, CF = { session: carol.session, spaceId: fam.data.spaceId }, DF = { session: dave.session, spaceId: fam.data.spaceId };
const fb = call('bootstrap', {}, BF);
ok(fb.ok && fb.data.meta.role === 'member' && fb.data.meta.space.type === 'family', 'bob akses ruang keluarga');
ok(fb.data.wallets.length === 1, 'ruang keluarga punya data terpisah dari pribadi alice');
ok(call('tx.create', { jenis: 'Keluar', tanggal: '2026-11-25', dompet: 'Cash', nominal: 90000, kategori: 'Belanja' }, BF).ok, 'bob menambah transaksi keluarga');
ok(call('tx.create', { jenis: 'Masuk', tanggal: '2026-11-25', dompet: 'Cash', nominal: 5000000, kategori: 'Gaji' }, F).ok, 'alice menambah transaksi keluarga');
const ftx = call('bootstrap', {}, CF).data.transactions;
ok(ftx.length === 2 && ftx.some(t => t.oleh === 'Bob') && ftx.some(t => t.oleh === 'Alice'), 'carol (viewer) membaca & melihat siapa pembuat');
expectErr(call('tx.create', { jenis: 'Keluar', tanggal: '2026-11-25', dompet: 'Cash', nominal: 1 }, CF), 'FORBIDDEN', 'viewer tidak bisa menulis');
expectErr(call('settings.save', { startDay: 5 }, CF), 'FORBIDDEN', 'viewer tidak bisa ubah pengaturan');
expectErr(call('space.invite', { email: 'z@z.com' }, BF), 'FORBIDDEN', 'member tidak bisa mengundang');
expectErr(call('space.delete', {}, BF), 'FORBIDDEN', 'member tidak bisa menghapus ruang');
expectErr(call('space.removeMember', { uid: 'g_1003' }, BF), 'FORBIDDEN', 'member tidak bisa mengeluarkan');
expectErr(call('bootstrap', {}, DF), 'FORBIDDEN', 'orang luar tidak punya akses');
expectErr(call('bootstrap', {}, { session: bob.session, spaceId: A.spaceId }), 'FORBIDDEN', 'bob tidak bisa membuka ruang pribadi alice');
expectErr(call('tx.create', { jenis: 'Keluar', tanggal: '2026-11-25', dompet: 'Cash', nominal: 1 }, { session: bob.session, spaceId: A.spaceId }), 'FORBIDDEN', 'bob tidak bisa menulis ke ruang pribadi alice');
const mem = call('space.members', {}, F).data;
ok(mem.members.length === 3 && mem.members.find(m => m.me).role === 'owner', 'daftar anggota');
ok(call('space.members', {}, BF).data.invites.length === 0, 'non-owner tidak melihat undangan');
ok(call('space.setRole', { uid: 'g_1003', role: 'member' }, F).ok, 'ubah peran carol');
ok(call('tx.create', { jenis: 'Keluar', tanggal: '2026-11-25', dompet: 'Cash', nominal: 1000, kategori: 'Makanan' }, CF).ok, 'carol kini bisa menulis (cache peran diperbarui)');
ok(call('space.removeMember', { uid: 'g_1002' }, F).ok, 'alice mengeluarkan bob');
expectErr(call('bootstrap', {}, BF), 'FORBIDDEN', 'bob kehilangan akses seketika');
expectErr(call('space.removeMember', { uid: 'g_1001' }, F), '', 'pemilik tidak bisa dikeluarkan');
ok(call('space.leave', {}, CF).ok, 'carol keluar sendiri');
expectErr(call('space.leave', {}, F), '', 'pemilik tidak bisa keluar');

// 7. tamper: satu baris rusak tidak merusak seluruh data
const ssA = files[Object.keys(files)[0]], txSheet = ssA.getSheetByName('Transactions');
const before = call('bootstrap', {}, A).data.transactions.length;
txSheet.d[1][1] = 'v1.' + 'A'.repeat(60);
ok(call('bootstrap', {}, A).data.transactions.length === before - 1, 'baris rusak dilewati, sisanya tetap terbaca');

// 8. AI rule-based
ok(call('ai.parse', { text: 'beli bensin 30rb', today: '2026-11-25' }, A).data.kategori === 'Lainnya', 'kategori yang sudah dihapus tidak dipakai parser');
call('settings.save', { expenseCategories: ['Makanan', 'Transportasi', 'Zakat'] }, A);
const pr = call('ai.parse', { text: 'beli bensin 30rb pakai cash kemarin', today: '2026-11-25' }, A);
ok(pr.ok && pr.data.nominal === 30000 && pr.data.kategori === 'Transportasi' && pr.data.dompet === 'Cash' && pr.data.tanggal === '2026-11-24', 'parse kalimat: ' + JSON.stringify(pr.data));
ok(call('ai.analyze', { start: '2026-11-01', end: '2026-11-30' }, A).ok, 'analisis');

// 9. hapus akun
ok(call('space.invite', { email: 'carol@gmail.com' }, F).ok, 'undang lagi untuk uji hapus akun');
expectErr(call('account.delete', { confirm: 'HAPUS' }, { session: alice.session }), '', 'tidak bisa hapus akun selagi punya ruang keluarga');
ok(call('space.delete', {}, F).ok, 'hapus ruang keluarga');
ok(env.__trashed.size === 1, 'spreadsheet ruang keluarga dibuang');
expectErr(call('account.delete', { confirm: 'salah' }, { session: bob.session }), '', 'konfirmasi salah ditolak');
ok(call('account.delete', { confirm: 'HAPUS' }, { session: bob.session }).ok, 'bob hapus akun');
expectErr(call('auth.me', {}, { session: bob.session }), 'AUTH', 'sesi bob mati setelah hapus akun');
ok(call('account.delete', { confirm: 'HAPUS' }, { session: alice.session }).ok, 'alice hapus akun');
ok(env.__trashed.size === 3 || env.__trashed.size === 2, 'file data ikut dibuang (' + env.__trashed.size + ')');
ok(master.getSheetByName('_Users').d.filter((r, i) => i > 0 && r.length && r[0] && r[0] !== 'g_1003' && r[0] !== 'g_1004').length === 0, 'baris user terhapus');
expectErr(call('bootstrap', {}, A), 'AUTH', 'sesi alice mati');

// 10. logout
const eve = login('1005', 'eve@gmail.com', 'Eve');
ok(call('auth.logout', {}, { session: eve.session }).ok, 'logout');
expectErr(call('auth.me', {}, { session: eve.session }), 'AUTH', 'sesi tidak berlaku setelah logout');

// 11. allowlist
env.__props.ALLOWED_EMAILS = 'boleh@gmail.com, @kantor.com';
expectErr(call('auth.login', { idToken: tok('2001', 'asing@gmail.com', 'Asing') }), 'FORBIDDEN', 'allowlist menolak');
ok(call('auth.login', { idToken: tok('2002', 'boleh@gmail.com', 'Boleh') }).ok, 'allowlist email persis');
ok(call('auth.login', { idToken: tok('2003', 'staf@kantor.com', 'Staf') }).ok, 'allowlist domain');
delete env.__props.ALLOWED_EMAILS;

// 12. nama berbahaya (rumus) di sheet master
const evil = call('auth.login', { idToken: tok('3001', 'evil@gmail.com', '=IMPORTXML("http://x")') });
ok(evil.ok && evil.data.user.name === '=IMPORTXML("http://x")', 'nama berawalan = aman & kembali utuh');

// 13. migrasi data lama
env = freshEnv(); vm.runInContext('ensureMasterKey_(); ensureMaster_(true);', env); env.__props.GOOGLE_CLIENT_ID = CLIENT_ID;
const mk = (n, rows) => { const s = master.insertSheet(n); rows.forEach((r, i) => r.forEach((v, j) => { (s.d[i] = s.d[i] || [])[j] = v; })); };
mk('Wallets', [['ID', 'Nama', 'Tipe', 'Saldo', 'Warna', 'Ikon'], ['W1', 'Rek. BSI', 'Bank', 100000, '#00897b', ''], ['W2', 'Cash', 'Tunai', 0, '#2e7d32', '']]);
mk('Transactions', [['ID', 'Tanggal', 'Dompet', 'Jenis', 'Nominal', 'Kategori', 'Ket', 'Goal'], ['T1', '15-01-2026', 'Cash', 'Keluar', 20000, 'Makanan', 'Makan', ''], ['T2', new Date(2026, 1, 3), 'Rek. BSI', 'Masuk', 5000000, 'Gaji', '', 'G1']]);
mk('Savings_Goals', [['ID', 'Nama', 'Target', 'Terkumpul', 'Deadline', 'Catatan'], ['G1', 'Laptop', 10000000, 2000000, '2027-03-10', 'x']]);
mk('Settings', [['Key', 'Value'], ['START_DAY_OF_MONTH', '25']]);
try { vm.runInContext('migrateLegacy("ghost@x.com")', env); ok(false, 'migrasi akun tak dikenal harus gagal'); } catch (e) { ok(true, 'migrasi menolak akun yang belum login'); }
const mg = login('4001', 'owner@gmail.com', 'Owner'); const M = { session: mg.session, spaceId: mg.spaces[0].id };
vm.runInContext('migrateLegacy("owner@gmail.com")', env);
const mb = call('bootstrap', {}, M).data;
ok(mb.wallets.length === 2 && mb.wallets.some(w => w.nama === 'Rek. BSI' && w.saldoAwal === 100000), 'migrasi: dompet');
ok(mb.transactions.length === 2 && mb.transactions.some(t => t.tanggal === '2026-01-15') && mb.transactions.some(t => t.tanggal === '2026-02-03'), 'migrasi: tanggal dd-MM-yyyy & Date ter-normalisasi');
ok(mb.goals[0].terkumpul === 2000000 && mb.transactions.find(t => t.kategori === 'Gaji').goalId === mb.goals[0].id, 'migrasi: target & relasi goalId');
ok(mb.settings.startDay === 25, 'migrasi: startDay');
try { vm.runInContext('migrateLegacy("owner@gmail.com")', env); ok(false, 'migrasi ganda harus ditolak'); } catch (e) { ok(true, 'migrasi ganda ditolak'); }

console.log(fails ? `\n${fails} GAGAL, ${passed} lulus` : `\nSEMUA ${passed} PENGECEKAN BACKEND LULUS`);
process.exit(fails ? 1 : 0);
