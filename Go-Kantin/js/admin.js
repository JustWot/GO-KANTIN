const session = JSON.parse(localStorage.getItem('gokantin_user') || '{}');
if (session.role !== 'admin' && session.role !== 'master') window.location.href = 'login.html';

if (session.shop_name) {
  document.getElementById('shop-title').textContent = session.shop_name;
  document.getElementById('menu-stall').value = session.shop_name;
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

async function addNewMenu(e) {
  e.preventDefault();
  const btn = document.getElementById('save-menu-btn');
  btn.textContent = 'Mengunggah...';
  btn.disabled = true;

  const name = document.getElementById('menu-name').value.trim();
  const stall = document.getElementById('menu-stall').value.trim();
  const price = parseInt(document.getElementById('menu-price').value, 10);
  const category = document.getElementById('menu-category').value;
  const fileInput = document.getElementById('menu-file');

  let imageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';

  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const fileName = `menu_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { error: uploadErr } = await db.storage.from('menu-images').upload(fileName, file);
    if (uploadErr) {
      alert('Gagal upload foto: ' + uploadErr.message);
      btn.textContent = 'Simpan & Terbitkan Menu';
      btn.disabled = false;
      return;
    }
    const { data: pubUrl } = db.storage.from('menu-images').getPublicUrl(fileName);
    imageUrl = pubUrl.publicUrl;
  }

  const { error } = await db.from('menus').insert([{
    id: 'menu_' + Date.now(),
    name,
    stall,
    price,
    category,
    image: imageUrl
  }]);

  btn.textContent = 'Simpan & Terbitkan Menu';
  btn.disabled = false;

  if (error) return alert('Gagal menyimpan menu: ' + error.message);

  trackEvent('create_menu_item', { stall_name: stall, category, price });
  alert(`Menu "${name}" berhasil ditambahkan!`);
  e.target.reset();
  if (session.shop_name) document.getElementById('menu-stall').value = session.shop_name;
  loadMenus();
}

async function loadMenus() {
  const { data: menus } = await db.from('menus').select('*').order('created_at', { ascending: false });
  const container = document.getElementById('admin-menu-list');
  if (!menus || menus.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 col-span-2 text-center py-4">Belum ada menu.</p>`;
    return;
  }

  const filtered = session.role === 'master' ? menus : menus.filter(m => m.stall === session.shop_name);
  container.innerHTML = filtered.map(m => `
    <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex justify-between items-center">
      <div class="flex items-center gap-3">
        <img src="${m.image}" class="w-12 h-12 rounded-xl object-cover" />
        <div>
          <h4 class="font-black text-xs text-slate-900">${m.name}</h4>
          <p class="text-[11px] text-emerald-600 font-bold">${formatIDR(m.price)}</p>
        </div>
      </div>
      <button onclick="deleteMenu('${m.id}')" class="text-xs text-red-500 hover:bg-red-50 p-2 rounded-xl">🗑️</button>
    </div>
  `).join('');
}

async function deleteMenu(id) {
  if (!confirm('Hapus menu ini?')) return;
  await db.from('menus').delete().eq('id', id);
  loadMenus();
}

async function loadOrders() {
  const { data: orders } = await db.from('orders').select('*').neq('status', 'delivered').order('created_at', { ascending: false });
  const container = document.getElementById('admin-orders-list');
  if (!orders || orders.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">Belum ada pesanan aktif.</p>`;
    return;
  }

  container.innerHTML = orders.map(o => `
    <div class="py-4 text-xs space-y-2">
      <div class="flex justify-between font-black text-sm">
        <span>${o.student_name} (${o.location})</span>
        <span class="text-emerald-600">${formatIDR(o.total_amount)}</span>
      </div>
      <p class="text-slate-500">Slot: ${o.slot} • Status: <strong class="uppercase text-amber-600">${o.status}</strong></p>
      <ul class="pl-4 list-disc text-slate-700">
        ${o.items.map(i => `<li>${i.name} (x${i.quantity})</li>`).join('')}
      </ul>
      <div class="pt-2">
        ${o.status === 'pending'
          ? `<button onclick="setOrderReady('${o.order_id}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl">📦 Siap Diantar Kurir</button>`
          : `<span class="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl font-bold">Menunggu / Diantar Kurir</span>`
        }
      </div>
    </div>
  `).join('');
}

async function setOrderReady(orderId) {
  await db.from('orders').update({ status: 'ready' }).eq('order_id', orderId);
  loadOrders();
}

document.addEventListener('DOMContentLoaded', () => {
  loadMenus();
  loadOrders();
  db.channel('admin-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
      playChime();
      loadOrders();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, loadOrders)
    .subscribe();
});