// ============================================================
// GO-KANTIN shared config + helpers (loaded by every page)
// ============================================================

// 1) Fill these from Supabase → Project Settings → API
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

// 2) Business rules
const DELIVERY_FEE_PER_ITEM = 1000; // Rp per item
const STORAGE_BUCKET = 'menu-images';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUS_LABEL = {
  pending:    { text: 'Menunggu Kantin',   cls: 'bg-slate-100 text-slate-600' },
  cooking:    { text: 'Sedang Disiapkan',  cls: 'bg-amber-100 text-amber-700' },
  ready:      { text: 'Siap Diambil Kurir', cls: 'bg-orange-100 text-orange-700' },
  delivering: { text: 'Sedang Diantar',    cls: 'bg-blue-100 text-blue-700' },
  delivered:  { text: 'Selesai',           cls: 'bg-emerald-100 text-emerald-700' },
};

function formatIDR(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

// Escape user-provided text before putting it into innerHTML (prevents XSS)
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('gokantin_user') || 'null'); }
  catch { return null; }
}

// Returns the session if its role is allowed, otherwise redirects to login.
function requireRole(allowedRoles) {
  const s = getSession();
  if (!s || !allowedRoles.includes(s.role)) {
    window.location.replace('login.html');
    return null;
  }
  return s;
}

function logout() {
  localStorage.removeItem('gokantin_user');
  window.location.href = 'login.html';
}

async function hashPassword(password) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Analytics hook – works with Google Analytics if present, otherwise a no-op
function trackEvent(name, params = {}) {
  try { if (typeof gtag === 'function') gtag('event', name, params); } catch (_) {}
}

function newOrderId() {
  return 'GK-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}
