// Student page: browse menu, cart, place order, track status
const session = requireRole(['student']);
// Delivery location shown to canteen & courier: "Kelas • Ruangan"
let studentLocation = session ? (session.room ? `${session.class} • ${session.room}` : session.class) : '';

let allMenus = [];
let cart = {}; // menuId -> { menu, qty }
let activeCategory = 'Semua';

async function loadMenus() {
  const { data, error } = await db.from('menus').select('*').order('created_at', { ascending: false });
  if (error) {
    document.getElementById('menu-grid').innerHTML =
      `<p class="text-xs text-red-500 col-span-full py-8 text-center">Gagal memuat menu: ${esc(error.message)}</p>`;
    return;
  }
  allMenus = data || [];
  renderMenus();
}

function filterCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    const isActive = btn.getAttribute('onclick').includes(`'${cat}'`);
    btn.className = 'cat-btn text-xs font-bold px-3 py-1.5 rounded-xl ' +
      (isActive ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200');
  });
  renderMenus();
}

function renderMenus() {
  const list = allMenus.filter(m => activeCategory === 'Semua' || m.category === activeCategory);
  const grid = document.getElementById('menu-grid');
  if (list.length === 0) {
    grid.innerHTML = `<p class="text-xs text-slate-400 col-span-full py-8 text-center">Belum ada menu.</p>`;
    return;
  }
  grid.innerHTML = list.map(m => `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      ${m.image_url
        ? `<img src="${esc(m.image_url)}" alt="${esc(m.name)}" class="h-36 w-full object-cover" loading="lazy" />`
        : `<div class="h-36 w-full bg-slate-100 flex items-center justify-center text-4xl">🍽️</div>`}
      <div class="p-4 flex flex-col gap-1 flex-1">
        <span class="text-[10px] font-bold uppercase text-emerald-700">${esc(m.category)}</span>
        <h3 class="font-black text-sm">${esc(m.name)}</h3>
        <p class="text-[11px] text-slate-500">${esc(m.stall)}</p>
        <div class="mt-auto pt-2 flex justify-between items-center">
          <span class="font-black text-emerald-600 text-sm">${formatIDR(m.price)}</span>
          <button onclick="addToCart('${m.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl">+ Tambah</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ---------- Cart ----------
function addToCart(id) {
  const menu = allMenus.find(m => String(m.id) === String(id));
  if (!menu) return;
  cart[id] = cart[id] ? { menu, qty: cart[id].qty + 1 } : { menu, qty: 1 };
  renderCart();
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  renderCart();
}

function renderCart() {
  const entries = Object.entries(cart);
  const totalQty = entries.reduce((s, [, c]) => s + c.qty, 0);
  const subtotal = entries.reduce((s, [, c]) => s + c.qty * c.menu.price, 0);
  const fee = totalQty * DELIVERY_FEE_PER_ITEM;

  document.getElementById('cart-badge').textContent = totalQty;
  document.getElementById('fee-item-count').textContent = totalQty;
  document.getElementById('cart-delivery-fee').textContent = formatIDR(fee);
  document.getElementById('cart-total').textContent = formatIDR(subtotal + fee);

  document.getElementById('cart-list').innerHTML = entries.length === 0
    ? `<p class="text-xs text-slate-400 text-center py-4">Keranjang masih kosong</p>`
    : entries.map(([id, c]) => `
      <div class="flex justify-between items-center text-xs bg-slate-50 rounded-xl p-2.5">
        <div class="min-w-0 pr-2">
          <p class="font-bold truncate">${esc(c.menu.name)}</p>
          <p class="text-slate-500">${formatIDR(c.menu.price)} • ${esc(c.menu.stall)}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="changeQty('${id}', -1)" class="w-6 h-6 rounded-lg bg-white border border-slate-200 font-black">−</button>
          <span class="font-black w-4 text-center">${c.qty}</span>
          <button onclick="changeQty('${id}', 1)" class="w-6 h-6 rounded-lg bg-white border border-slate-200 font-black">+</button>
        </div>
      </div>
    `).join('');
}

async function submitOrder() {
  const entries = Object.values(cart);
  if (entries.length === 0) return alert('Keranjang masih kosong!');

  const totalQty = entries.reduce((s, c) => s + c.qty, 0);
  const subtotal = entries.reduce((s, c) => s + c.qty * c.menu.price, 0);
  const fee = totalQty * DELIVERY_FEE_PER_ITEM;

  const order = {
    order_id: newOrderId(),
    student_name: session.name,
    location: studentLocation,
    items: entries.map(c => ({
      id: c.menu.id, name: c.menu.name, stall: c.menu.stall, price: c.menu.price, quantity: c.qty,
    })),
    delivery_fee: fee,
    total_amount: subtotal + fee,
    slot: document.getElementById('order-slot').value,
    status: 'pending',
  };

  const { error } = await db.from('orders').insert([order]);
  if (error) return alert('Gagal membuat pesanan: ' + error.message);

  trackEvent('purchase', { order_id: order.order_id, value: order.total_amount, currency: 'IDR' });
  cart = {};
  renderCart();
  loadMyOrders();
  alert('Pesanan berhasil dibuat! Siapkan uang tunai (COD).');
}

// ---------- My orders ----------
async function loadMyOrders() {
  const { data, error } = await db.from('orders').select('*')
    .eq('student_name', session.name).like('location', session.class.replace(/[%_]/g, '') + '%')
    .order('created_at', { ascending: false }).limit(10);
  const box = document.getElementById('my-orders-list');
  if (error) { box.innerHTML = `<p class="text-xs text-red-500 text-center py-4">${esc(error.message)}</p>`; return; }
  if (!data || data.length === 0) {
    box.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Belum ada pesanan aktif.</p>`;
    return;
  }
  box.innerHTML = data.map(o => {
    const st = STATUS_LABEL[o.status] || { text: o.status, cls: 'bg-slate-100 text-slate-600' };
    return `
      <div class="p-3 bg-slate-50 rounded-2xl text-xs space-y-1.5">
        <div class="flex justify-between items-center">
          <span class="font-black">${esc(o.order_id)}</span>
          <span class="px-2 py-0.5 rounded-full font-bold ${st.cls}">${st.text}</span>
        </div>
        <ul class="pl-4 list-disc text-slate-600">
          ${(o.items || []).map(i => `<li>${esc(i.name)} (x${i.quantity})</li>`).join('')}
        </ul>
        <div class="flex justify-between text-slate-500">
          <span>${esc(o.slot)}</span>
          <span class="font-bold text-emerald-600">${formatIDR(o.total_amount)}</span>
        </div>
      </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!session) return;
  document.getElementById('student-info').textContent = `${session.name} • ${studentLocation}`;
  loadMenus();
  loadMyOrders();
  renderCart();
  db.channel('student-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadMyOrders)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, loadMenus)
    .subscribe();
});

// Let a student change room without logging out
function changeRoom() {
  const current = session.room || '';
  const room = (prompt('Masukkan ruangan baru:', current) || '').trim();
  if (!room) return;
  session.room = room;
  localStorage.setItem('gokantin_user', JSON.stringify(session));
  studentLocation = `${session.class} • ${room}`;
  document.getElementById('student-info').textContent = `${session.name} • ${studentLocation}`;
  loadMyOrders();
}
