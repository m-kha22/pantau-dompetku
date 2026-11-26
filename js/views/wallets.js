import { $, $$, esc, rupiah, parseMoney, bindMoney, setMoney, isHex, readableOn } from '../utils.js';
import { CONFIG } from '../config.js';
import { state, mutate, walletBalances } from '../store.js';
import { formModal, confirmDialog, toast } from '../ui.js';
import { walletCardHTML, walletIcon, emptyHTML, swatchesHTML } from '../components.js';

export function openWalletForm(w = null) {
  const isEdit = !!w;
  const cur = { nama: '', tipe: 'Bank', warna: CONFIG.WALLET_COLORS[0], ikon: '', saldoAwal: 0, ...(w || {}) };

  return formModal({
    title: isEdit ? 'Edit Dompet' : 'Dompet Baru',
    submitLabel: isEdit ? 'Simpan Perubahan' : 'Tambah Dompet',
    html: `
      <div id="wPreview"></div>
      <div class="field"><label>Nama dompet</label><input class="input" name="nama" maxlength="40" placeholder="mis. Rek. BCA, GoPay, Dompet Harian" value="${esc(cur.nama)}" required></div>
      <div class="field-row keep">
        <div class="field"><label>Tipe</label><select class="select" name="tipe">${CONFIG.WALLET_TYPES.map(t => `<option ${t === cur.tipe ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Saldo awal</label><input class="input" name="saldoAwal" inputmode="numeric" data-neg="1" placeholder="0"></div>
      </div>
      <div class="field"><label>Warna kartu</label>
        <div class="swatches" id="wSw">${swatchesHTML(CONFIG.WALLET_COLORS, cur.warna)}
          <input type="color" class="swatch" id="wColor" value="${esc(cur.warna)}" title="Warna kustom" style="padding:0;border-radius:50%;overflow:hidden"></div></div>
      <div class="field"><label>Ikon</label>
        <div class="icon-pick" id="wIc">${CONFIG.WALLET_ICONS.map(i => `<button type="button" data-icon="${i}"><i class="fa-solid fa-${i}"></i></button>`).join('')}</div></div>`,
    onMount(d, form) {
      bindMoney(form.saldoAwal); setMoney(form.saldoAwal, cur.saldoAwal);
      if (cur.saldoAwal < 0) form.saldoAwal.value = '-' + Math.abs(cur.saldoAwal).toLocaleString('id-ID');
      const preview = $('#wPreview', d);
      const draw = () => {
        const w2 = { ...cur, nama: form.nama.value || 'Nama Dompet', tipe: form.tipe.value };
        preview.innerHTML = walletCardHTML({ ...w2, ikon: cur.ikon }, parseMoney(form.saldoAwal.value));
        $$('#wSw .swatch', d).forEach(s => s.classList.toggle('on', s.dataset.color?.toLowerCase() === cur.warna.toLowerCase()));
        $$('#wIc button', d).forEach(b => b.classList.toggle('on', b.dataset.icon === (cur.ikon || walletIcon(w2))));
      };
      $$('#wSw [data-color]', d).forEach(s => s.onclick = () => { cur.warna = s.dataset.color; $('#wColor', d).value = cur.warna; draw(); });
      $('#wColor', d).oninput = e => { cur.warna = e.target.value; draw(); };
      $$('#wIc button', d).forEach(b => b.onclick = () => { cur.ikon = b.dataset.icon; draw(); });
      ['nama', 'tipe', 'saldoAwal'].forEach(n => form[n].addEventListener('input', draw));
      draw();
    },
    async onSubmit(form, d) {
      if (!form.nama.value.trim()) throw new Error('Nama dompet wajib diisi.');
      const payload = { nama: form.nama.value.trim(), tipe: form.tipe.value, saldoAwal: parseMoney(form.saldoAwal.value), warna: isHex(cur.warna) ? cur.warna : CONFIG.WALLET_COLORS[0], ikon: cur.ikon };
      await mutate(isEdit ? 'wallet.update' : 'wallet.create', isEdit ? { ...payload, id: w.id } : payload);
      d.close();
    }
  });
}

export function render(root) {
  const bal = walletBalances();
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Dompet Saya</h2><p class="muted">${state.wallets.length} dompet · total saldo <b class="num">${rupiah(bal.total)}</b></p></div>
      <button class="btn btn-primary write-only" id="addWallet"><i class="fa-solid fa-plus"></i>Tambah Dompet</button>
    </div>
    ${state.wallets.length
      ? `<div class="wallet-grid">${state.wallets.map(w => walletCardHTML(w, bal.byName[w.nama], { actions: true })).join('')}</div>`
      : `<div class="card">${emptyHTML('wallet', 'Belum ada dompet. Tambahkan dompet pertama Anda.')}</div>`}
    <p class="hint" style="margin-top:14px">Saldo = saldo awal + pemasukan − pengeluaran ± transfer. Mengganti nama dompet otomatis memperbarui seluruh transaksinya.</p>`;

  $('#addWallet', root).onclick = () => openWalletForm();
  $$('[data-edit]', root).forEach(b => b.onclick = () => openWalletForm(state.wallets.find(w => w.id === b.dataset.edit)));
  $$('[data-del]', root).forEach(b => b.onclick = async () => {
    const w = state.wallets.find(x => x.id === b.dataset.del);
    const ok = await confirmDialog({ title: 'Hapus dompet?', message: `Dompet "${w.nama}" akan dihapus. Dompet yang masih punya transaksi tidak bisa dihapus.`, okLabel: 'Hapus', danger: true });
    if (!ok) return;
    try { await mutate('wallet.delete', { id: w.id }); } catch (e) { toast(e.message, 'error'); }
  });
}
