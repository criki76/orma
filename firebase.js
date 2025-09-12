// firebase.js
export const app = window.__FIREBASE_APP__;
export const auth = window.__FIREBASE_AUTH__;
export const db = window.__FIREBASE_DB__;
export const googleProvider = window.__FIREBASE_GOOGLE_PROVIDER__; // ✅ Ora è definito!

// Timestamp server (alternativa per il prototipo)
export const serverTimestamp = () => new Date().toISOString();
