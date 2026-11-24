import { readableOn, isHex } from './utils.js';

const KEY = 'pd_theme';

export function getTheme() {
  let t = {};
  try { t = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { /* abaikan */ }
  return { mode: 'auto', accent: '#4f46e5', ...t };
}

export function isDark(t = getTheme()) {
  return t.mode === 'dark' || (t.mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}

export function applyTheme(t = getTheme()) {
  const root = document.documentElement;
  root.dataset.theme = isDark(t) ? 'dark' : 'light';
  const accent = isHex(t.accent) ? t.accent : '#4f46e5';
  root.style.setProperty('--primary', accent);
  root.style.setProperty('--on-primary', readableOn(accent));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', accent);
  const ic = document.querySelector('#themeToggle i');
  if (ic) ic.className = 'fa-solid ' + (isDark(t) ? 'fa-sun' : 'fa-moon');
}

export function saveTheme(patch) {
  const t = { ...getTheme(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(t));
  applyTheme(t);
  window.dispatchEvent(new CustomEvent('themechange'));
}

export function toggleDark() {
  saveTheme({ mode: isDark() ? 'light' : 'dark' });
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getTheme().mode === 'auto') { applyTheme(); window.dispatchEvent(new CustomEvent('themechange')); }
});
