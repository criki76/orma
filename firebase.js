// Inizializza Firebase (compat)
if (!window.__FIREBASE_CONFIG__) {
  console.warn('⚠️ Config Firebase mancante. Apri firebase-config.js e inserisci le tue chiavi.');
}
const app = firebase.initializeApp(window.__FIREBASE_CONFIG__ || {});
const auth = firebase.auth();
const db = firebase.firestore();

// Abilita timestamp lato server
db.settings({ ignoreUndefinedProperties: true });

// Esporta global per debug da console
window.__orma = { app, auth, db };
