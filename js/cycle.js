/**
 * Siklus bulanan berbasis tanggal gajian.
 * startDay = 25 -> siklus berjalan 25 Okt s.d. 24 Nov, dst. startDay = 1 -> bulan kalender.
 */
import { toISO, fromISO, MONTHS, MONTHS_LONG, fmtRange } from './utils.js';

export function makeCycle(y, m, s) {
  return { start: toISO(new Date(y, m, s)), end: toISO(new Date(y, m + 1, s - 1)) };
}
export function cycleContaining(iso, s) {
  const d = fromISO(iso);
  let m = d.getMonth();
  if (d.getDate() < s) m -= 1;
  return makeCycle(d.getFullYear(), m, s);
}
export function shiftCycle(c, n, s) {
  const d = fromISO(c.start);
  return makeCycle(d.getFullYear(), d.getMonth() + n, s);
}
/** `count` siklus berurutan (terlama -> terbaru) yang berakhir di `anchor`. */
export function cycleList(count, s, anchor) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(shiftCycle(anchor, -i, s));
  return out;
}
export function cycleTitle(c, s) {
  if (s === 1) { const d = fromISO(c.start); return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`; }
  return fmtRange(c.start, c.end);
}
export function cycleShort(c, s) {
  const a = fromISO(c.start), b = fromISO(c.end);
  if (s === 1) return `${MONTHS[a.getMonth()]} ${String(a.getFullYear()).slice(2)}`;
  return `${MONTHS[a.getMonth()]}–${MONTHS[b.getMonth()]}`;
}
