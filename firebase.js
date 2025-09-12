// firebase.js
// Solo un'interfaccia per accedere alle istanze Firebase già caricate

export const app = window.__FIREBASE_APP__;
export const auth = window.__FIREBASE_AUTH__;
export const db = window.__FIREBASE_DB__;

// Timestamp server (alternativa per il prototipo)
export const serverTimestamp = () => new Date().toISOString();

// Google Provider: lo creiamo qui senza dipendere da firebase-auth.js
export const googleProvider = new firebase.auth.GoogleAuthProvider();
