const SUPABASE_URL = 'https://ndotagcjnxxocclmmjly.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PgpkUt_5Juh0zLQ8U8RC5A_GhqeZB2l'; // Starts with eyJhbGci...
const GA_MEASUREMENT_ID = 'G-JZBCNXZZQ8'; // Replace with your GA4 Measurement ID

cconst DELIVERY_FEE_PER_ITEM = 2000;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatIDR(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

function logout() {
  localStorage.removeItem('gokantin_user');
  window.location.href = 'login.html';
}

function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === 'function' && GA_MEASUREMENT_ID && !GA_MEASUREMENT_ID.includes('XXXX')) {
    window.gtag('event', eventName, params);
  }
}
