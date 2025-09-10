// firebase.js (usa i moduli ufficiali Firebase da CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Inizializza
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Se usi Google
export const googleProvider = new GoogleAuthProvider();

// Riesporto le funzioni di auth così le puoi importare da app.js
export { signInWithPopup, onAuthStateChanged, signOut };
