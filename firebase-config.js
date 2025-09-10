// Inserisci qui la tua configurazione Firebase e rendila disponibile in window.__FIREBASE_CONFIG__
// 1) Vai su https://console.firebase.google.com -> Crea progetto -> App Web
// 2) Copia l'oggetto firebaseConfig generato da Firebase e incollalo qui:
//
// Esempio:
// window.__FIREBASE_CONFIG__ = {
//   apiKey: "AIza...",
//   authDomain: "orma-demo.firebaseapp.com",
//   projectId: "orma-demo",
//   storageBucket: "orma-demo.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abcdef123456"
// };
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDEYxuxC_snlko4T3E-WQlD7VkYoLlOIOw",
    authDomain: "o-r-m-a.firebaseapp.com",
    projectId: "o-r-m-a",
    storageBucket: "o-r-m-a.firebasestorage.app",
    messagingSenderId: "832487381320",
    appId: "1:832487381320:web:1237a1a488fb44dfd9bb7d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);