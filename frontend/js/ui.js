import { esc } from './utils.js';

/* ---------- progress bar ---------- */
let busyCount = 0;
export function busy(on) {
  busyCount = Math.max(0, busyCount + (on ? 1 : -1));
  const bar = document.getElementById('progress');
  if (busyCount > 0) bar.classList.add('on');
  else { bar.style.transition = 'width .2s'; bar.style.width = '100%'; setTimeout(() => { bar.classList.remove('on'); bar.removeAttribute('style'); }, 220); }
}

/* ---------- toast ---------- */
export function toast(msg, type = 'success') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, type === 'error' ? 5000 : 2800);
}

/* ---------- modal ---------- */
export function openModal({ title, html, size = '', onMount, onClose }) {
  const d = document.getElementById('modal');
  d.className = 'modal ' + size;
  d.innerHTML = `<div class="modal-head"><h3>${esc(title)}</h3>
    <button class="btn-icon" data-close aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body">${html}</div>`;
  d.querySelector('[data-close]').onclick = () => d.close();
  d.onclick = e => { if (e.target === d) d.close(); };
  d.onclose = () => { if (onClose) onClose(); };
  if (!d.open) d.showModal();
  if (onMount) onMount(d);
  return d;
}
export function closeModal() { const d = document.getElementById('modal'); if (d.open) d.close(); }

/** Modal berisi <form>. onSubmit(form) boleh async; error ditampilkan sebagai toast dan modal tetap terbuka. */
export function formModal({ title, html, submitLabel = 'Simpan', onSubmit, onMount, extraFooter = '' }) {
  return openModal({
    title,
    html: `<form class="form" novalidate>${html}
      <div class="modal-foot">${extraFooter}<button type="submit" class="btn btn-primary">${esc(submitLabel)}</button></div></form>`,
    onMount(d) {
      const form = d.querySelector('form');
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const label = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Menyimpan…';
        try { await onSubmit(form, d); }
        catch (err) { toast(err.message || 'Gagal menyimpan.', 'error'); }
        finally { btn.disabled = false; btn.innerHTML = label; }
      });
      if (onMount) onMount(d, form);
    }
  });
}

/** Konfirmasi (dialog terpisah agar bisa tampil di atas modal form). */
export function confirmDialog({ title = 'Konfirmasi', message, okLabel = 'Ya, lanjutkan', danger = false }) {
  return new Promise(resolve => {
    const d = document.getElementById('confirmDlg');
    let result = false;
    d.innerHTML = `<div class="modal-head"><h3>${esc(title)}</h3></div>
      <div class="modal-body"><p style="margin-bottom:18px">${esc(message)}</p>
      <div class="modal-foot"><button class="btn btn-ghost" data-no>Batal</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(okLabel)}</button></div></div>`;
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-yes]').onclick = () => { result = true; d.close(); };
    d.onclose = () => resolve(result);
    d.showModal();
  });
}
