const user = JSON.parse(localStorage.getItem('gokantin_user') || '{}');
if (user.role !== 'student') window.location.href = 'login.html';

document.getElementById('student-info').textContent = `${user.name} • ${user.class}`;
let allMenus = [];
let selectedCategory = 'Semua';
let cart = [];

async function fetchMenus() {
  const { data: menus, error } = await db.from('menus').select('*').order('created_at', { ascending: false });
  if (error) return console.error(error);
  allMenus = menus || [];
  renderMenuGrid();
}

function filterCategory(cat) {
  selectedCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    const active = btn.textContent.trim().startsWith(cat.split(' ')[0]);
    btn.className = active
      ? 'cat-btn bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl'
      : 'cat-btn bg-white text-slate-600 border border-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl';
  });
  renderMenuGrid();
}

function renderMenuGrid() {
  const grid = document.getElementById('menu-grid');
  const filtered = selectedCategory === 'Semua'
    ? allMenus
    : allMenus.filter(m => m.category === selectedCategory);

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="text-xs text-slate-400 col-span-full py-8 text-center">Belum ada menu pada kategori ini.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(m => `
    <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between">
      <img src="${m.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}" class="w-full h-40 object-cover" />
      <div class="p-4 flex-1 flex flex-col justify-between">
        <div>
          <span class="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">${m.stall}</span>
          <h3 class="font-black text-slate-900 text-base mt-2">${m.name}</h3>
          <p class="text-emerald-600 font-black text-sm mt-0.5">${formatIDR(m.price)}</p>
        </div>
        <button onclick='addToCart(${JSON.stringify(m)})' class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition">
          + Tambah
        </button>
      </div>
    </div>
  `).join('');
}

function addToCart(item) {
  const found = cart.find(c => c.id === item.id);
  if (found) found.quantity++;
  else cart.push({ ...item, quantity: 1 });

  trackEvent('add_to_cart', {
    currency: 'IDR',
    value: item.price,
    items: [{ item_id: item.id, item_name: item.name, item_category: item.category, price: item.price, quantity: 1 }]
  });

  renderCart();
}

function renderCart() {
  const list = document.getElementById('cart-list');
  const totalQty = cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  document.getElementById('cart-badge').textContent = totalQty;
  document.getElementById('cart-total').textContent = formatIDR(totalPrice);

  list.innerHTML = cart.length === 0
    ? `<p class="text-xs text-slate-400 text-center py-4">Keranjang masih kosong</p>`
    : cart.map(i => `
      <div class="flex justify-between items-center text-xs py-2 border-b border-slate-100">
        <div>
          <p class="font-bold text-slate-900">${i.name}</p>
          <p class="text-slate-500">${i.quantity}x • ${formatIDR(i.price * i.quantity)}</p>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="updateQty('${i.id}', -1)" class="w-6 h-6 bg-slate-100 rounded-lg font-bold">-</button>
          <span class="font-bold">${i.quantity}</span>
          <button onclick="updateQty('${i.id}', 1)" class="w-6 h-6 bg-slate-100 rounded-lg font-bold">+</button>
        </div>
      </div>
    `).join('');
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
  renderCart();
}

async function submitOrder() {
  if (cart.length === 0) return alert('Keranjang kamu masih kosong!');
  const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
  const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const slot = document.getElementById('order-slot').value;

  const { error } = await db.from('orders').insert([{
    order_id: orderId,
    student_name: user.name,
    location: user.class,
    slot,
    total_amount: total,
    items: cart,
    status: 'pending'
  }]);

  if (error) return alert('Gagal memesan: ' + error.message);

  trackEvent('purchase', {
    transaction_id: orderId,
    currency: 'IDR',
    value: total,
    delivery_slot: slot
  });

  alert('Pesanan terkirim! Pantau status pesananmu di bawah.');
  cart = [];
  renderCart();
  fetchMyOrders();
}

async function fetchMyOrders() {
  const { data: orders } = await db.from('orders').select('*').eq('student_name', user.name).order('created_at', { ascending: false });
  const container = document.getElementById('my-orders-list');
  if (!orders || orders.length === 0) return;

  const statusLabels = {
    pending: { text: 'Dimasak Kantin', color: 'bg-amber-100 text-amber-800' },
    ready: { text: 'Menunggu Kurir', color: 'bg-purple-100 text-purple-800' },
    delivering: { text: 'Sedang Diantar', color: 'bg-blue-100 text-blue-800' },
    delivered: { text: 'Selesai Diterima', color: 'bg-emerald-100 text-emerald-800' }
  };

  container.innerHTML = orders.map(o => {
    const st = statusLabels[o.status] || statusLabels.pending;
    return `
      <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
        <div class="flex justify-between items-center">
          <span class="font-mono font-bold text-slate-500">${o.order_id}</span>
          <span class="px-2 py-0.5 rounded-lg font-bold text-[10px] ${st.color}">${st.text}</span>
        </div>
        <p class="font-black text-slate-900">${formatIDR(o.total_amount)}</p>
      </div>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  fetchMenus();
  fetchMyOrders();
  db.channel('student-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, fetchMenus)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchMyOrders)
    .subscribe();
});