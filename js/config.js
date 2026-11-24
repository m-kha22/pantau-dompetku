/**
 * Konfigurasi bawaan. URL & token biasanya diisi lewat layar "Hubungkan"
 * saat pertama kali membuka aplikasi (disimpan di localStorage browser),
 * sehingga repo GitHub tidak berisi rahasia apa pun.
 *
 * Boleh isi API_URL di sini bila ingin URL terpasang otomatis untuk semua perangkat.
 */
export const CONFIG = {
  API_URL: '',   // contoh: 'https://script.google.com/macros/s/XXXXXXXX/exec'
  WALLET_TYPES: ['Bank', 'E-Wallet', 'Tunai', 'Investasi', 'Lainnya'],
  WALLET_ICONS: ['building-columns', 'mobile-screen', 'money-bill-wave', 'chart-line', 'wallet', 'piggy-bank', 'credit-card', 'coins'],
  WALLET_COLORS: ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#475569'],
  ACCENT_COLORS: ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'],
};
