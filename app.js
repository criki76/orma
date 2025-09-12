// app.js
import { app, auth, db, googleProvider, serverTimestamp } from './firebase.js';

// Elementi DOM
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const addSegnoBtn = document.getElementById('addSegnoBtn');
const segnoDialog = document.getElementById('segnoDialog');
const segnoText = document.getElementById('segnoText');
const useMyLocation = document.getElementById('useMyLocation');
const pickedLocation = document.getElementById('pickedLocation');
const quotaInfo = document.getElementById('quotaInfo');

// Inizializza mappa Leaflet
let map;
let marker = null;

function initMap() {
  map = L.map('map').setView([41.9028, 12.4964], 13); // Roma, come default

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Ascolta clic sulla mappa per aggiungere marker
  map.on('click', (e) => {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    pickedLocation.textContent = `Lat: ${e.latlng.lat.toFixed(6)}, Lng: ${e.latlng.lng.toFixed(6)}`;
    pickedLocation.dataset.lat = e.latlng.lat;
    pickedLocation.dataset.lng = e.latlng.lng;
    addSegnoBtn.disabled = false;
  });
}

// Aggiorna UI in base allo stato dell'utente
function updateUI() {
  if (auth.currentUser) {
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    addSegnoBtn.disabled = false;
    quotaInfo.textContent = '';
  } else {
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    addSegnoBtn.disabled = true;
    quotaInfo.textContent = '(accedi per partecipare)';
  }
}

// Login con Google
async function loginWithGoogle() {
  try {
    await auth.signInWithPopup(googleProvider);
    console.log('Login riuscito!');
  } catch (error) {
    console.error('Errore login:', error.message);
    alert('Errore durante il login: ' + error.message);
  }
}

// Logout
async function logout() {
  try {
    await auth.signOut();
    console.log('Logout effettuato');
  } catch (error) {
    console.error('Errore logout:', error.message);
  }
}

// Salva un "segno" su Firestore
async function saveSegno() {
  if (!auth.currentUser || !segnoText.value.trim()) return;

  const lat = parseFloat(pickedLocation.dataset.lat);
  const lng = parseFloat(pickedLocation.dataset.lng);

  if (isNaN(lat) || isNaN(lng)) {
    alert('Seleziona una posizione sulla mappa!');
    return;
  }

  try {
    await db.collection('segni').add({
      text: segnoText.value.trim(),
      userId: auth.currentUser.uid,
      username: auth.currentUser.displayName || 'Anonimo',
      photoURL: auth.currentUser.photoURL || '',
      location: new firebase.firestore.GeoPoint(lat, lng),
      timestamp: serverTimestamp(), // 👈 Usa la nostra funzione
      createdAt: new Date().toISOString()
    });

    segnoText.value = '';
    pickedLocation.textContent = 'Nessuna posizione selezionata';
    pickedLocation.dataset.lat = '';
    pickedLocation.dataset.lng = '';
    marker && map.removeLayer(marker);
    marker = null;
    addSegnoBtn.disabled = true;

    segnoDialog.close();
    console.log('Segno salvato!');
  } catch (error) {
    console.error('Errore salvataggio:', error.message);
    alert('Impossibile salvare il segno: ' + error.message);
  }
}

// Event Listeners
loginBtn.addEventListener('click', loginWithGoogle);
logoutBtn.addEventListener('click', logout);
addSegnoBtn.addEventListener('click', () => segnoDialog.showModal());
segnoDialog.addEventListener('close', () => {
  if (segnoDialog.returnValue === 'default') {
    saveSegno();
  }
});
useMyLocation.addEventListener('click', async () => {
  if (!navigator.geolocation) {
    alert('La geolocalizzazione non è supportata dal tuo browser.');
    return;
  }

  try {
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject)
    );

    const { latitude, longitude } = position.coords;
    const latLng = L.latLng(latitude, longitude);

    if (marker) map.removeLayer(marker);
    marker = L.marker(latLng).addTo(map);
    map.setView(latLng, 15);

    pickedLocation.textContent = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
    pickedLocation.dataset.lat = latitude;
    pickedLocation.dataset.lng = longitude;
    addSegnoBtn.disabled = false;
  } catch (error) {
    console.error('Errore geolocalizzazione:', error.message);
    alert('Impossibile ottenere la tua posizione: ' + error.message);
  }
});

// Ascolta cambiamenti di autenticazione
auth.onAuthStateChanged((user) => {
  updateUI();
});

// Avvia la mappa quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  updateUI(); // Controlla subito lo stato utente
});
