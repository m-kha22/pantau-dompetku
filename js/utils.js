export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const mdLite = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

/* ---------- tanggal (semua ISO 'yyyy-MM-dd', zona lokal) ---------- */
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const pad = n => String(n).padStart(2, '0');
export const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISO(new Date());
export const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);

export function fmtDate(iso) {
  if (!iso) return '-';
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtShort(iso) { const d = fromISO(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }
export function fmtRange(a, b) {
  return fromISO(a).getFullYear() === fromISO(b).getFullYear()
    ? `${fmtShort(a)} – ${fmtShort(b)} ${fromISO(b).getFullYear()}`
    : `${fmtDate(a)} – ${fmtDate(b)}`;
}
export function dayLabel(iso) {
  const t = todayISO();
  if (iso === t) return 'Hari ini';
  if (iso === addDays(t, -1)) return 'Kemarin';
  const d = fromISO(iso);
  return `${DAYS[d.getDay()]}, ${fmtDate(iso)}`;
}

/* ---------- angka ---------- */
export const rupiah = n => { const v = Math.round(n || 0); return (v < 0 ? '-' : '') + 'Rp ' + Math.abs(v).toLocaleString('id-ID'); };
export const compact = n => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
export const parseMoney = v => Number(String(v || '').replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '')) || 0;

/** Input nominal dengan pemisah ribuan otomatis. data-neg="1" mengizinkan minus. */
export function bindMoney(input) {
  input.addEventListener('input', () => {
    const neg = input.dataset.neg === '1' && input.value.trim().startsWith('-');
    const digits = input.value.replace(/\D/g, '');
    input.value = (neg ? '-' : '') + (digits ? Number(digits).toLocaleString('id-ID') : '');
  });
}
export const setMoney = (input, n) => { input.value = n ? Number(n).toLocaleString('id-ID') : ''; };

/* ---------- warna ---------- */
export const isHex = c => /^#[0-9a-fA-F]{6}$/.test(c || '');
export function readableOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#0f172a' : '#ffffff';
}

/* ---------- lain-lain ---------- */
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export function download(name, text, mime = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const CAT_ICONS = {
  'Makanan': 'utensils', 'Transportasi': 'car', 'Kebutuhan RT': 'house', 'Tagihan': 'file-invoice-dollar',
  'Pendidikan': 'graduation-cap', 'Kesehatan': 'heart-pulse', 'Nafkahi Istri': 'heart', 'Belanja': 'bag-shopping',
  'Tabungan': 'piggy-bank', 'Zakat': 'hand-holding-heart', 'Gaji': 'sack-dollar', 'Bonus': 'gift',
  'Usaha': 'store', 'Hadiah': 'gift', 'Transfer': 'right-left'
};
export const catIcon = (cat, jenis) => CAT_ICONS[cat] || (jenis === 'Masuk' ? 'arrow-down' : jenis === 'Keluar' ? 'arrow-up' : 'ellipsis');
