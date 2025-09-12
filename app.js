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
    quota
