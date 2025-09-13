// usa Firebase istanziato in index.html
import { signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Shortcuts globali
const auth = window.__FIREBASE_AUTH__;
const db = window.__FIREBASE_DB__;
const googleProvider = window.__FIREBASE_GOOGLE_PROVIDER__;

// Config
const SEGNI_COLL = 'segni';
const QUOTA_MAX = 3;
const RECENTI_N = 200;

// DOM
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const addSegnoBtn = document.getElementById('addSegnoBtn');
const segnoDialog = document.getElementById('segnoDialog');
const segnoText = document.getElementById('segnoText');
const useMyLocationBtn = document.getElementById('useMyLocation');
const pickedLocation = document.getElementById('pickedLocation');
const quotaInfo = document.getElementById('quotaInfo');
const saveSegnoBtn = document.getElementById('saveSegnoBtn');
const cancelAddSegno = document.getElementById('cancelAddSegno');

// 👉 riferimenti per posizione manuale (se presenti in HTML)
const manualLat = document.getElementById('manualLat');
const manualLng = document.getElementById('manualLng');
const setManualLocationBtn = document.getElementById('setManualLocation');

// Mappa
let map;
let pickMarker = null;
let markersLayer = null;

function initMap() {
  map = L.map('map').setView([41.9028, 12.4964], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // click per scegliere la posizione
  map.on('click', (e) => setPickedLocation(e.latlng.lat, e.latlng.lng, true));
}

function setPickedLocation(lat, lng, move = false) {
  if (pickMarker) map.removeLayer(pickMarker);
  pickMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
  if (move) map.setView([lat, lng], Math.max(map.getZoom(), 13));
  pickedLocation.textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
  pickedLocation.dataset.lat = String(lat);
  pickedLocation.dataset.lng = String(lng);

  pickMarker.on('dragend', () => {
    const p = pickMarker.getLatLng();
    setPickedLocation(p.lat, p.lng, false);
  });
}

function openSegnoDialog() {
  segnoText.value = '';
  pickedLocation.textContent = 'Nessuna posizione selezionata';
  delete pickedLocation.dataset.lat;
  delete pickedLocation.dataset.lng;

  if (manualLat) manualLat.value = '';
  if (manualLng) manualLng.value = '';

  if (typeof segnoDialog.showModal === 'function') segnoDialog.showModal();
  else segnoDialog.style.display = 'block';
}

function closeSegnoDialog() {
  if (typeof segnoDialog.close === 'function') segnoDialog.close();
  else segnoDialog.style.display = 'none';
}

function updateUI() {
  const logged = !!auth.currentUser;
  loginBtn.style.display = logged ? 'none' : 'inline-block';
  logoutBtn.style.display = logged ? 'inline-block' : 'none';
  addSegnoBtn.disabled = !logged;
  quotaInfo.textContent = logged ? '' : '(accedi per partecipare)';
}

async function handleLogin() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    console.error(e);
    alert('Accesso non riuscito.');
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error(e);
  }
}

// Quota: max QUOTA_MAX segni nelle ultime 24h
async function checkQuotaAndUpdate() {
  if (!auth.currentUser) {
    addSegnoBtn.disabled = true;
    quotaInfo.textContent = '(accedi per partecipare)';
    return { allowed: false, left: 0 };
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const q = query(
    collection(db, SEGNI_COLL),
    where('uid', '==', auth.currentUser.uid),
    where('createdAt', '>', since),
    orderBy('createdAt', 'desc'),
    limit(QUOTA_MAX)
  );
  const snap = await getDocs(q);
  const left = Math.max(0, QUOTA_MAX - snap.size);
  if (left <= 0) {
    addSegnoBtn.disabled = true;
    quotaInfo.textContent = `Hai raggiunt
