/**
 * Konfigurasi publik (aman ada di GitHub — keduanya bukan rahasia).
 *
 *  API_URL           : URL Web App Apps Script (berakhiran /exec)
 *  GOOGLE_CLIENT_ID  : OAuth Client ID tipe "Web application" dari Google Cloud Console.
 *                      Authorized JavaScript origins harus berisi domain Vercel Anda.
 */
export const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyGw5sdCK6Np91y4C2QTyrcu3jQ1Pnl21XoIToH7DXJeVuZzYzNHaLwoeyDS-5gxL3Zdw/exec',            // contoh: 'https://script.google.com/macros/s/AKfycbyGw5sdCK6Np91y4C2QTyrcu3jQ1Pnl21XoIToH7DXJeVuZzYzNHaLwoeyDS-5gxL3Zdw/exec'
  GOOGLE_CLIENT_ID: '190364355773-1588tb197c9oo85bv10ahiv6af8k2ali.apps.googleusercontent.com',   // contoh: '1234567890-abc.apps.googleusercontent.com'

  WALLET_TYPES: ['Bank', 'E-Wallet', 'Tunai', 'Investasi', 'Lainnya'],
  WALLET_ICONS: ['building-columns', 'mobile-screen', 'money-bill-wave', 'chart-line', 'wallet', 'piggy-bank', 'credit-card', 'coins'],
  WALLET_COLORS: ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#475569'],
  ACCENT_COLORS: ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'],
};
