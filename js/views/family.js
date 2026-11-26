import { $, $$, esc, rupiah } from '../utils.js';
import { call } from '../api.js';
import { state, refreshMe, switchSpace, activeCycle, txInRange, summarize } from '../store.js';
import { cycleTitle } from '../cycle.js';
import { formModal, confirmDialog, toast, busy } from '../ui.js';
import { emptyHTML } from '../components.js';

const ROLE_LABEL = { owner: 'Pemilik', member: 'Anggota', viewer: 'Hanya lihat' };
const ROLE_HELP = 'Anggota: dapat mencatat & mengubah data. Hanya lihat: hanya membaca (cocok untuk anak/pasangan yang cuma memantau).';
let members = { spaceId: '', data: null };

const initial = n => esc((n || '?').trim().charAt(0).toUpperCase());
const avatar = n => `<span class="avatar">${initial(n)}</span>`;

async function act(fn, okMsg) {
  busy(true);
  try { const r = await fn(); await refreshMe(); if (okMsg !== false) toast(okMsg || (r && r.message) || 'Berhasil'); return r; }
  catch (e) { toast(e.message, 'error'); }
  finally { busy(false); }
}

function createSpaceForm() {
  formModal({
    title: 'Buat Ruang Keluarga', submitLabel: 'Buat Ruang',
    html: `<div class="field"><label>Nama ruang</label><input class="input" name="name" maxlength="60" placeholder="mis. Keluarga Budi, Rumah Tangga" required></div>
      <p class="hint">Ruang keluarga punya dompet, transaksi, dan target sendiri yang dibagikan ke anggota. Data pribadi Anda tidak ikut terbagi.</p>`,
    async onSubmit(form, d) {
      const name = form.name.value.trim();
      if (!name) throw new Error('Nama ruang wajib diisi.');
      const r = await call('space.create', { name });
      await refreshMe();
      d.close();
      await switchSpace(r.spaceId);
      toast('Ruang Keluarga dibuat. Sekarang undang anggota.');
    }
  });
}

function inviteForm() {
  formModal({
    title: 'Undang Anggota', submitLabel: 'Buat Undangan',
    html: `<div class="field"><label>Email Google anggota</label><input class="input" type="email" name="email" placeholder="nama@gmail.com" required></div>
      <div class="field"><label>Peran</label><select class="select" name="role"><option value="member">Anggota</option><option value="viewer">Hanya lihat</option></select><span class="hint">${esc(ROLE_HELP)}</span></div>
      <p class="hint">Undangan tidak dikirim lewat email. Beri tahu orangnya, lalu minta ia masuk ke aplikasi dengan <b>akun Google yang sama</b> dan menerima undangan di menu Keluarga.</p>`,
    async onSubmit(form, d) {
      const r = await call('space.invite', { email: form.email.value.trim(), role: form.role.value });
      members.data = null; d.close(); toast(r.message); render(document.getElementById('view'));
    }
  });
}

function renameForm() {
  formModal({
    title: 'Ganti Nama Ruang', submitLabel: 'Simpan',
    html: `<div class="field"><label>Nama ruang</label><input class="input" name="name" maxlength="60" value="${esc(state.space.name)}" required></div>`,
    async onSubmit(form, d) { await call('space.rename', { name: form.name.value.trim() }); await refreshMe(); state.space.name = form.name.value.trim(); d.close(); toast('Nama diperbarui.'); }
  });
}

function memberRows(list, isOwner) {
  return list.map(m => `<div class="member">
    ${avatar(m.name)}
    <div class="grow"><b>${esc(m.name)}${m.me ? ' <span class="muted">(Anda)</span>' : ''}</b><small class="muted">${esc(m.email)}</small></div>
    ${isOwner && m.role !== 'owner'
      ? `<select class="select role-sel" data-uid="${esc(m.uid)}"><option value="member" ${m.role === 'member' ? 'selected' : ''}>Anggota</option><option value="viewer" ${m.role === 'viewer' ? 'selected' : ''}>Hanya lihat</option></select>
         <button class="btn-icon" data-rm="${esc(m.uid)}" aria-label="Keluarkan"><i class="fa-solid fa-user-minus"></i></button>`
      : `<span class="badge ${m.role === 'owner' ? '' : 'warn'}">${ROLE_LABEL[m.role] || m.role}</span>`}
  </div>`).join('');
}

function contributionHTML() {
  const c = activeCycle(), s = summarize(txInRange(c.start, c.end));
  const rows = Object.entries(s.byMember).sort((a, b) => b[1].keluar - a[1].keluar);
  if (!rows.length) return emptyHTML('chart-simple', 'Belum ada transaksi di siklus ini.');
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Anggota</th><th class="right">Pemasukan</th><th class="right">Pengeluaran</th><th class="right">Porsi belanja</th></tr></thead><tbody>
    ${rows.map(([n, v]) => `<tr><td><b>${esc(n)}</b></td><td class="right num text-success">${rupiah(v.masuk)}</td><td class="right num text-danger">${rupiah(v.keluar)}</td>
      <td class="right"><span class="badge">${s.keluar ? Math.round(v.keluar / s.keluar * 100) : 0}%</span></td></tr>`).join('')}
    <tr><td class="muted">Gabungan</td><td class="right num"><b>${rupiah(s.masuk)}</b></td><td class="right num"><b>${rupiah(s.keluar)}</b></td><td></td></tr></tbody></table></div>
    <p class="hint" style="margin-top:8px">Siklus: ${esc(cycleTitle(c, state.settings.startDay))}. Berdasarkan siapa yang mencatat transaksi.</p>`;
}

export function render(root) {
  const sp = state.space, isFamily = sp && sp.type === 'family', isOwner = state.role === 'owner';

  root.innerHTML = `
    ${state.invites.length ? `<div class="card" style="margin-bottom:16px;border-color:var(--primary-line)">
      <div class="card-head"><div class="card-title"><i class="fa-solid fa-envelope-open-text"></i>Undangan untuk Anda</div></div>
      ${state.invites.map(i => `<div class="member"><span class="avatar"><i class="fa-solid fa-people-roof"></i></span>
        <div class="grow"><b>${esc(i.spaceName)}</b><small class="muted">dari ${esc(i.from)} · ${ROLE_LABEL[i.role] || i.role}</small></div>
        <button class="btn btn-primary btn-sm" data-accept="${esc(i.id)}">Terima</button>
        <button class="btn btn-sm" data-decline="${esc(i.id)}">Tolak</button></div>`).join('')}</div>` : ''}

    <div class="grid grid-2" style="align-items:start">
      <div class="stack">
        <div class="card">
          <div class="card-head"><div class="card-title"><i class="fa-solid fa-layer-group"></i>Ruang Saya</div>
            <button class="btn btn-primary btn-sm" id="newSpace"><i class="fa-solid fa-plus"></i>Ruang Keluarga</button></div>
          ${state.spaces.map(s => `<div class="member">
            <span class="avatar ${s.type === 'family' ? 'fam' : ''}"><i class="fa-solid fa-${s.type === 'family' ? 'people-roof' : 'user'}"></i></span>
            <div class="grow"><b>${esc(s.type === 'personal' ? 'Pribadi' : s.name)}</b><small class="muted">${s.type === 'personal' ? 'Hanya Anda' : s.members + ' anggota'} · ${ROLE_LABEL[s.role]}</small></div>
            ${s.id === state.spaceId ? '<span class="badge good">Aktif</span>' : `<button class="btn btn-sm" data-open="${esc(s.id)}">Buka</button>`}</div>`).join('')}
          <p class="hint" style="margin-top:12px">Ganti ruang aktif juga bisa dari menu di sidebar. Setiap ruang punya data & enkripsi terpisah.</p>
        </div>

        ${isFamily ? `<div class="card"><div class="card-head"><div class="card-title"><i class="fa-solid fa-scale-balanced"></i>Keuangan Gabungan per Anggota</div></div>${contributionHTML()}</div>` : ''}
      </div>

      <div class="stack">
        ${isFamily ? `<div class="card" id="memberCard">
          <div class="card-head"><div class="card-title"><i class="fa-solid fa-people-group"></i>Anggota — ${esc(sp.name)}</div>
            ${isOwner ? '<button class="btn btn-primary btn-sm" id="invite"><i class="fa-solid fa-user-plus"></i>Undang</button>' : ''}</div>
          <div id="memberList"><div class="empty"><span class="spinner"></span></div></div>
        </div>
        <div class="card"><div class="card-head"><div class="card-title"><i class="fa-solid fa-gear"></i>Kelola Ruang</div></div>
          <div class="row wrap">
            ${isOwner ? '<button class="btn" id="rename"><i class="fa-solid fa-pen"></i>Ganti nama</button><button class="btn btn-danger" id="delSpace"><i class="fa-solid fa-trash"></i>Hapus ruang</button>'
              : '<button class="btn btn-danger" id="leave"><i class="fa-solid fa-right-from-bracket"></i>Keluar dari ruang</button>'}
          </div>
          <p class="hint" style="margin-top:10px">${isOwner ? 'Menghapus ruang menghapus seluruh datanya untuk semua anggota dan tidak bisa dibatalkan.' : 'Data yang pernah Anda catat tetap berada di ruang ini.'}</p>
        </div>`
        : `<div class="card"><div class="empty"><i class="fa-solid fa-people-roof"></i>
            <b style="color:var(--text)">Anda sedang di ruang Pribadi</b>
            <p style="margin:6px 0 14px">Buat Ruang Keluarga untuk mengelola keuangan bersama pasangan atau anggota keluarga lain. Masing-masing masuk dengan akun Google sendiri.</p>
            <p class="hint">${esc(ROLE_HELP)}</p></div></div>`}
      </div>
    </div>`;

  $('#newSpace', root).onclick = createSpaceForm;
  $$('[data-open]', root).forEach(b => b.onclick = async () => { try { await switchSpace(b.dataset.open); } catch (e) { toast(e.message, 'error'); } });
  $$('[data-accept]', root).forEach(b => b.onclick = async () => {
    const r = await act(() => call('invite.accept', { inviteId: b.dataset.accept }), false);
    if (r) { toast(r.message); await switchSpace(r.spaceId); }
  });
  $$('[data-decline]', root).forEach(b => b.onclick = () => act(() => call('invite.decline', { inviteId: b.dataset.decline })));
  if (!isFamily) return;

  if (isOwner) { $('#invite', root).onclick = inviteForm; $('#rename', root).onclick = renameForm; }
  const del = $('#delSpace', root);
  if (del) del.onclick = async () => {
    if (!await confirmDialog({ title: 'Hapus ruang?', message: `Ruang "${sp.name}" beserta seluruh transaksi, dompet, dan targetnya akan dihapus permanen untuk semua anggota.`, okLabel: 'Hapus permanen', danger: true })) return;
    busy(true);
    try { await call('space.delete'); await refreshMe(); await switchSpace(state.spaces.find(s => s.type === 'personal').id); toast('Ruang dihapus.'); }
    catch (e) { toast(e.message, 'error'); } finally { busy(false); }
  };
  const leave = $('#leave', root);
  if (leave) leave.onclick = async () => {
    if (!await confirmDialog({ title: 'Keluar dari ruang?', message: `Anda tidak akan bisa lagi melihat data "${sp.name}" kecuali diundang kembali.`, okLabel: 'Keluar', danger: true })) return;
    busy(true);
    try { await call('space.leave'); await refreshMe(); await switchSpace(state.spaces.find(s => s.type === 'personal').id); toast('Anda keluar dari ruang.'); }
    catch (e) { toast(e.message, 'error'); } finally { busy(false); }
  };

  // daftar anggota (dimuat async)
  const paint = () => {
    const box = $('#memberList', root); if (!box) return;
    const { members: ms, invites } = members.data;
    box.innerHTML = memberRows(ms, isOwner) +
      (invites.length ? `<div class="label" style="margin:14px 0 4px">UNDANGAN TERTUNDA</div>` + invites.map(i => `<div class="member"><span class="avatar"><i class="fa-regular fa-clock"></i></span>
        <div class="grow"><b>${esc(i.email)}</b><small class="muted">${ROLE_LABEL[i.role]} · menunggu</small></div>
        <button class="btn-icon" data-cancel="${esc(i.id)}" aria-label="Batalkan"><i class="fa-solid fa-xmark"></i></button></div>`).join('') : '');
    $$('.role-sel', box).forEach(sel => sel.onchange = async () => {
      try { await call('space.setRole', { uid: sel.dataset.uid, role: sel.value }); toast('Peran diperbarui.'); } catch (e) { toast(e.message, 'error'); paint(); }
    });
    $$('[data-rm]', box).forEach(b => b.onclick = async () => {
      if (!await confirmDialog({ title: 'Keluarkan anggota?', message: 'Ia tidak akan bisa lagi mengakses ruang ini.', okLabel: 'Keluarkan', danger: true })) return;
      try { await call('space.removeMember', { uid: b.dataset.rm }); members.data = null; toast('Anggota dikeluarkan.'); await refreshMe(); } catch (e) { toast(e.message, 'error'); }
    });
    $$('[data-cancel]', box).forEach(b => b.onclick = async () => {
      try { await call('space.invite.cancel', { inviteId: b.dataset.cancel }); members.data = null; await refreshMe(); } catch (e) { toast(e.message, 'error'); }
    });
  };
  // tampilkan cache lebih dulu (cepat), lalu SELALU muat data terbaru agar tidak basi
  if (members.data && members.spaceId === state.spaceId) paint();
  call('space.members').then(d => { members = { spaceId: state.spaceId, data: d }; paint(); })
    .catch(e => { if (!members.data) { const b = $('#memberList', root); if (b) b.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; } });
}
