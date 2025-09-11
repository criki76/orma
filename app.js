import { auth } from "./firebase.js";

// Leaflet Map
let map, clickLatLng = null, markersLayer;

function initMap() {
  map = L.map('map', { zoomControl: true }).setView([41.9, 12.5], 5); // Italia by default
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Pick position by clicking
  map.on('click', (e) => {
    clickLatLng = e.latlng;
    updatePickedLocation();
  });
}

function markerFor(doc) {
  const d = doc.data();
  const marker = L.circleMarker([d.lat, d.lng], {
    radius: 7,
    color: '#b86a2b',
    weight: 2,
    fillColor: '#b86a2b',
    fillOpacity: 0.9
  });
  const content = `<b>${escapeHtml(d.authorName || 'Utente')}</b><br/><small>${new Date(d.createdAt?.toDate?.() || d.createdAt).toLocaleString()}</small><br/><p style="margin-top:6px">${escapeHtml(d.text)}</p>`;
  marker.bindPopup(content);
  // add glow via custom class
  const el = marker._path;
  marker.on('add', () => {
    const svg = marker._renderer?._container || marker._path?.ownerSVGElement;
    // circleMarker renders as SVG path; we approximate glow via popup focus
  });
  return marker;
}

function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// Firestore live fetch
let unsub = null;
async function startLiveQuery(){
  if (unsub) unsub();
  unsub = db.collection('segni')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .onSnapshot((snap) => {
      markersLayer.clearLayers();
      snap.forEach(doc => {
        const m = markerFor(doc);
        m.addTo(markersLayer).getElement?.()?.classList?.add('glow');
      });
    }, (err) => console.error(err));
}

// Auth UI
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const addSegnoBtn = document.getElementById('addSegnoBtn');
const segnoDialog = document.getElementById('segnoDialog');
const segnoText = document.getElementById('segnoText');
const useMyLocationBtn = document.getElementById('useMyLocation');
const pickedLocationEl = document.getElementById('pickedLocation');
const quotaInfo = document.getElementById('quotaInfo');
const saveSegnoBtn = document.getElementById('saveSegnoBtn');

loginBtn.addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    console.error(e);
    alert('Accesso non riuscito.');
  }
});

logoutBtn.addEventListener('click', async () => {
  await auth.signOut();
});

addSegnoBtn.addEventListener('click', () => {
  segnoText.value = '';
  clickLatLng = null;
  updatePickedLocation();
  segnoDialog.showModal();
});

useMyLocationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocalizzazione non supportata.');
  navigator.geolocation.getCurrentPosition((pos) => {
    clickLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    updatePickedLocation();
  }, (err) => {
    console.warn(err);
    alert('Non è stato possibile ottenere la posizione.');
  }, { enableHighAccuracy: true, timeout: 8000 });
});

saveSegnoBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert('Accedi per lasciare un segno.');
  const text = (segnoText.value || '').trim();
  if (!text) return alert('Scrivi qualcosa!');
  if (!clickLatLng) return alert('Scegli una posizione (clicca sulla mappa o usa la tua posizione).');

  // soft quota: max 2 segni / giorno / utente (client-side)
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);

  const nToday = await db.collection('segni')
    .where('uid','==',user.uid)
    .where('createdAt','>=',today)
    .where('createdAt','<',tomorrow)
    .get()
    .then(s => s.size);

  if (nToday >= 2) {
    alert('Hai raggiunto il limite di 2 segni per oggi. Riprova domani!');
    return;
  }

  const payload = {
    uid: user.uid,
    authorName: user.displayName || 'Utente',
    text,
    lat: clickLatLng.lat,
    lng: clickLatLng.lng,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('segni').add(payload);
    segnoDialog.close();
  } catch (e) {
    console.error(e);
    alert('Errore durante il salvataggio.');
  }
});

function updatePickedLocation(){
  if (!clickLatLng) pickedLocationEl.textContent = 'Nessuna posizione selezionata';
  else pickedLocationEl.textContent = `Lat ${clickLatLng.lat.toFixed(4)}, Lng ${clickLatLng.lng.toFixed(4)}`;
}

// Auth state changes
auth.onAuthStateChanged((user) => {
  const isIn = !!user;
  loginBtn.style.display = isIn ? 'none' : 'inline-flex';
  logoutBtn.style.display = isIn ? 'inline-flex' : 'none';
  addSegnoBtn.disabled = !isIn;
  quotaInfo.textContent = isIn ? 'Massimo 2 segni al giorno' : '(accedi per partecipare)';
});

// Boot
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  startLiveQuery();
});
