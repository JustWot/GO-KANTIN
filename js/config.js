const SUPABASE_URL = 'https://ndotagcjnxxocclmmjly.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PgpkUt_5Juh0zLQ8U8RC5A_GhqeZB2l'; // Starts with eyJhbGci...
const GA_MEASUREMENT_ID = 'G-JZBCNXZZQ8'; // Replace with your GA4 Measurement ID

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auto-initialize Google Analytics 4
(function initGA4() {
  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID);
})();

function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

function logout() {
  localStorage.removeItem('gokantin_user');
  window.location.href = 'login.html';
}
