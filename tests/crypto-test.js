// Verifikasi Crypto.gs terhadap OpenSSL (modul crypto Node). Jalankan: node tests/crypto-test.js
const fs = require('fs'), path = require('path'), nodeCrypto = require('crypto'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '../appscript/Crypto.gs'), 'utf8');
const ctx = { Utilities: { getUuid: () => nodeCrypto.randomUUID() }, PropertiesService: {}, console };
vm.createContext(ctx); vm.runInContext(src + '\nthis.__x={sha256_,hmac_,aesExpandKey_,aesEncryptBlock_,aesCtr_,seal_,open_,utf8Bytes_,utf8Str_,b64enc_,b64dec_,randomBytes_}', ctx);
const C = ctx.__x; let fails = 0;
const eq = (a, b, m) => { if (String(a) !== String(b)) { fails++; console.log('FAIL', m, '\n  got ', a, '\n  want', b); } };
const buf = u => Buffer.from(u);
const rnd = n => nodeCrypto.randomBytes(n);

// SHA-256 & HMAC
for (const len of [0, 1, 3, 55, 56, 63, 64, 65, 119, 120, 1000, 10000]) {
  const m = rnd(len);
  eq(buf(C.sha256_(new Uint8Array(m))).toString('hex'), nodeCrypto.createHash('sha256').update(m).digest('hex'), 'sha256 len ' + len);
}
for (const kl of [5, 32, 64, 100]) {
  const k = rnd(kl), m = rnd(200);
  eq(buf(C.hmac_(new Uint8Array(k), new Uint8Array(m))).toString('hex'), nodeCrypto.createHmac('sha256', k).update(m).digest('hex'), 'hmac keylen ' + kl);
}
// AES-256 FIPS-197 C.3
const fk = Buffer.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', 'hex');
const pt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const out = new Uint8Array(16); C.aesEncryptBlock_(C.aesExpandKey_(new Uint8Array(fk)), new Uint8Array(pt), out);
eq(buf(out).toString('hex'), '8ea2b7ca516745bfeafc49904b496089', 'FIPS-197 AES-256');
// AES-CTR vs OpenSSL
for (const len of [0, 1, 15, 16, 17, 100, 4096, 5000]) {
  const key = rnd(32), nonce = rnd(12), data = rnd(len);
  const c = nodeCrypto.createCipheriv('aes-256-ctr', key, Buffer.concat([nonce, Buffer.alloc(4)]));
  const want = Buffer.concat([c.update(data), c.final()]).toString('hex');
  eq(buf(C.aesCtr_(C.aesExpandKey_(new Uint8Array(key)), new Uint8Array(nonce), new Uint8Array(data))).toString('hex'), want, 'ctr len ' + len);
}
// base64 + utf8
for (const len of [0, 1, 2, 3, 4, 100]) { const d = rnd(len); eq(C.b64enc_(new Uint8Array(d)), d.toString('base64'), 'b64 ' + len); eq(buf(C.b64dec_(d.toString('base64'))).toString('hex'), d.toString('hex'), 'b64dec ' + len); }
const txt = 'Rp 25.000 — makan siang 🍜 “enak” ñ 日本語';
eq(C.utf8Str_(C.utf8Bytes_(txt)), txt, 'utf8 roundtrip');
eq(buf(C.utf8Bytes_(txt)).toString('hex'), Buffer.from(txt).toString('hex'), 'utf8 bytes');
// seal/open + tamper + wrong key
const key = new Uint8Array(rnd(32)), s = C.seal_(txt, key);
eq(C.open_(s, key), txt, 'seal/open');
eq(C.seal_(txt, key) === s, false, 'nonce acak -> ciphertext beda');
let threw = false; try { C.open_(s.slice(0, 20) + (s[20] === 'A' ? 'B' : 'A') + s.slice(21), key); } catch (e) { threw = true; } eq(threw, true, 'tamper terdeteksi');
threw = false; try { C.open_(s, new Uint8Array(rnd(32))); } catch (e) { threw = true; } eq(threw, true, 'kunci salah ditolak');
// kompatibilitas: dekripsi manual dengan OpenSSL
{
  const raw = Buffer.from(s.slice(3), 'base64'), nonce = raw.subarray(0, 12), ct = raw.subarray(12, raw.length - 16), tag = raw.subarray(raw.length - 16);
  const encK = nodeCrypto.createHmac('sha256', Buffer.from(key)).update('enc').digest(), macK = nodeCrypto.createHmac('sha256', Buffer.from(key)).update('mac').digest();
  eq(nodeCrypto.createHmac('sha256', macK).update(Buffer.concat([nonce, ct])).digest().subarray(0, 16).toString('hex'), tag.toString('hex'), 'tag cocok OpenSSL');
  const d = nodeCrypto.createDecipheriv('aes-256-ctr', encK, Buffer.concat([nonce, Buffer.alloc(4)]));
  eq(Buffer.concat([d.update(ct), d.final()]).toString('utf8'), txt, 'OpenSSL bisa mendekripsi hasil seal_');
}
// performa
const big = JSON.stringify({ tanggal: '2026-11-25', dompet: 'Rek. BSI', jenis: 'Keluar', nominal: 25000, kategori: 'Makanan', keterangan: 'Nasi padang dan es teh manis', goalId: '', oleh: 'Budi' });
let t0 = Date.now(); const sealed = []; for (let i = 0; i < 5000; i++) sealed.push(C.seal_(big, key)); const te = Date.now() - t0;
t0 = Date.now(); for (const x of sealed) C.open_(x, key); const td = Date.now() - t0;
console.log(`5000 record: enkripsi ${te}ms, dekripsi ${td}ms`);
console.log(fails ? `${fails} GAGAL` : 'SEMUA TES KRIPTO LULUS');
process.exit(fails ? 1 : 0);
