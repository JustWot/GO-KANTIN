// Canteen panel: add/delete menus, process incoming orders
const session = requireRole(['admin', 'master']);
const isMaster = session && session.role === 'master';
const shopName = session ? (session.shop_name || '') : '';

const sameStall = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

async function addNewMenu(e) {
  e.preventDefault();
  const btn = document.getElementById('save-menu-btn');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  try {
    let image_url = null;
    const file = document.getElementById('menu-file').files[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) throw new Error('Ukuran foto maksimal 3 MB.');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await db.storage.from(STORAGE_BUCKET).upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      image_url = db.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const { error } = await db.from('menus').insert([{
      name: document.getElementById('menu-name').value.trim(),
      stall: document.getElementById('menu-stall').value.trim(),
      price: parseInt(document.getElementById('menu-price').value, 10),
      category: document.getElementById('menu-category').value,
      image_url,
      owner_username: session.username,
    }]);
    if (error) throw error;

    trackEvent('menu_added');
    e.target.reset();
    document.getElementById('menu-stall').value = shopName;
    loadMenus();
  } catch (err) {
    alert('Gagal menyimpan menu: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan & Terbitkan Menu';
  }
}

async function loadMenus() {
  let q = db.from('menus').select('*').order('created_at', { ascending: false });
  if (!isMaster) q = q.eq('owner_username', session.username);
  const { data, error } = await q;
  const box = document.getElementById('admin-menu-list');
  if (error) { box.innerHTML = `<p class="text-xs text-red-500">${esc(error.message)}</p>`; return; }
  box.innerHTML = (data || []).length === 0
    ? `<p class="text-xs text-slate-400 col-span-full text-center py-4">Belum ada menu.</p>`
    : data.map(m => `
      <div class="flex gap-3 p-3 bg-slate-50 rounded-2xl text-xs">
        ${m.image_url
          ? `<img src="${esc(m.image_url)}" class="w-14 h-14 rounded-xl object-cover" alt="" />`
          : `<div class="w-14 h-14 rounded-xl bg-slate-200 flex items-center justify-center text-xl">🍽️</div>`}
        <div class="flex-1 min-w-0">
          <p class="font-black text-sm truncate">${esc(m.name)}</p>
          <p class="text-slate-500">${esc(m.stall)} • ${esc(m.category)}</p>
          <p class="font-bold text-emerald-600">${formatIDR(m.price)}</p>
        </div>
        <button onclick="deleteMenu('${m.id}')" class="text-red-500 font-bold self-start hover:underline">Hapus</button>
      </div>
    `).join('');
}

async function deleteMenu(id) {
  if (!confirm('Hapus menu ini?')) return;
  const { error } = await db.from('menus').delete().eq('id', id);
  if (error) return alert('Gagal menghapus: ' + error.message);
  loadMenus();
}

async function loadOrders() {
  const { data, error } = await db.from('orders').select('*')
    .in('status', ['pending', 'cooking', 'ready'])
    .order('created_at', { ascending: true });
  const box = document.getElementById('admin-orders-list');
  if (error) { box.innerHTML = `<p class="text-xs text-red-500 py-4">${esc(error.message)}</p>`; return; }

  const mine = (data || []).filter(o => isMaster || (o.items || []).some(i => sameStall(i.stall, shopName)));
  if (mine.length === 0) {
    box.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">Belum ada pesanan masuk.</p>`;
    return;
  }

  box.innerHTML = mine.map(o => {
    const items = isMaster ? o.items : (o.items || []).filter(i => sameStall(i.stall, shopName));
    const st = STATUS_LABEL[o.status];
    let action = '';
    if (o.status === 'pending')
      action = `<button onclick="setOrderStatus('${esc(o.order_id)}','cooking')" class="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-2 rounded-xl">👨‍🍳 Mulai Siapkan</button>`;
    else if (o.status === 'cooking')
      action = `<button onclick="setOrderStatus('${esc(o.order_id)}','ready')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl">✓ Siap Diambil Kurir</button>`;
    else
      action = `<span class="text-slate-400 font-semibold">Menunggu kurir...</span>`;

    return `
      <div class="py-4 space-y-2 text-xs">
        <div class="flex justify-between items-center">
          <span class="font-black text-sm">${esc(o.student_name)} <span class="text-slate-500 font-semibold">(${esc(o.location)})</span></span>
          <span class="px-2 py-0.5 rounded-full font-bold ${st.cls}">${st.text}</span>
        </div>
        <p class="text-slate-500">${esc(o.order_id)} • ${esc(o.slot)}</p>
        <ul class="pl-4 list-disc text-slate-700">
          ${items.map(i => `<li>${esc(i.name)} (x${i.quantity})</li>`).join('')}
        </ul>
        <div>${action}</div>
      </div>`;
  }).join('');
}

async function setOrderStatus(orderId, status) {
  const { error } = await db.from('orders').update({ status }).eq('order_id', orderId);
  if (error) return alert('Gagal update status: ' + error.message);
  trackEvent('order_status_update', { order_id: orderId, status });
  loadOrders();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!session) return;
  document.getElementById('shop-title').textContent = shopName ? `Panel ${shopName}` : 'Panel Kelola Kantin';
  const stall = document.getElementById('menu-stall');
  stall.value = shopName;
  if (!isMaster) { stall.readOnly = true; stall.classList.add('bg-slate-100', 'cursor-not-allowed'); }

  loadMenus();
  loadOrders();
  db.channel('admin-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadOrders)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, loadMenus)
    .subscribe();
});
