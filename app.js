// usa Firebase istanziato in index.html
import { signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

// Mappa
let map;
let pickMarker = null;
let markersLayer = null;

function initMap() {
  map = L.map('map').setView([41.9028, 12.4964], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Click per scegliere la posizione
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
    quotaInfo.textContent = `Hai raggiunto il limite di ${QUOTA_MAX} segni nelle ultime 24 ore.`;
    return { allowed: false, left: 0 };
  }
  addSegnoBtn.disabled = false;
  quotaInfo.textContent = `Puoi lasciare ancora ${left}/${QUOTA_MAX} segni (ultime 24h).`;
  return { allowed: true, left };
}

// Salva su Firestore e DISEGNA SUBITO il segno sulla mappa
async function salvaSegno({ text, lat, lng }) {
  if (!auth.currentUser) throw new Error('Non autenticato');

  const docData = {
    text: text.trim(),
    lat: lat,        // ✅ esplicito
    lng: lng,        // ✅ esplicito
    uid: auth.currentUser.uid,
    userName: auth.currentUser.displayName || 'Utente',
    userPhoto: auth.currentUser.photoURL || null,
    createdAt: serverTimestamp(),
    createdAtTs: Date.now()
  };

  const ref = await addDoc(collection(db, SEGNI_COLL), docData);

  // Disegna SUBITO il segno, così lo vedi anche senza ricaricare
  const m = L.circleMarker([lat, lng], { radius: 8, weight: 2, fillOpacity: 0.7 });
  m.bindPopup(
    `<strong>${escapeHtml(docData.userName)}</strong><br>${escapeHtml(docData.text)}<br><small>appena adesso</small>`
  );
  markersLayer.addLayer(m);
  map.setView([lat, lng], Math.max(map.getZoom(), 13));
  m.openPopup();

  return ref;
}

// Carica segni recenti dalla collezione
async function caricaSegniRecenti() {
  markersLayer.clearLayers();

  // Usa SEMPRE createdAtTs — è sempre presente, numerico, affidabile
  const q = query(collection(db, SEGNI_COLL), orderBy('createdAtTs', 'desc'), limit(RECENTI_N));
  try {
    const snap = await getDocs(q);
    snap.forEach(drawDocAsMarker);
  } catch (e) {
    console.error('Errore caricamento segni:', e);
  }
}

function drawDocAsMarker(doc) {
  const d = doc.data();
  let lat, lng;

  // Caso 1: campi espliciti lat/lng
  if (typeof d.lat === 'number' && typeof d.lng === 'number') {
    lat = d.lat;
    lng = d.lng;
  }
  // Caso 2: campo location (GeoPoint)
  else if (d.location && typeof d.location.latitude === 'number' && typeof d.location.longitude === 'number') {
    lat = d.location.latitude;
    lng = d.location.longitude;
  }
  // Caso 3: campo coords
  else if (d.coords && typeof d.coords.lat === 'number' && typeof d.coords.lng === 'number') {
    lat = d.coords.lat;
    lng = d.coords.lng;
  }
  // Caso 4: nessuna posizione valida
  else {
    console.warn('Documento ignorato: posizione non valida', d);
    return;
  }

  const m = L.circleMarker([lat, lng], { radius: 8, weight: 2, fillOpacity: 0.7 });
  const when =
    d.createdAt?.toDate ? d.createdAt.toDate() :
    (typeof d.createdAtTs === 'number' ? new Date(d.createdAtTs) : null);
  const timeStr = when ? when.toLocaleString() : 'appena adesso';

  m.bindPopup(
    `<strong>${escapeHtml(d.userName || 'Utente')}</strong><br>${escapeHtml(d.text || '')}<br><small>${escapeHtml(timeStr)}</small>`
  );
  markersLayer.addLayer(m);
}

// Utils
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function prendiMiaPosizione() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocalizzazione non supportata'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// Eventi UI
function wireEvents() {
  loginBtn.addEventListener('click', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);

  addSegnoBtn.addEventListener('click', async () => {
    try {
      const q = await checkQuotaAndUpdate();
      if (!q.allowed) return;
    } catch { /* se quota non verificabile, apri comunque */ }
    openSegnoDialog();
  });

  useMyLocationBtn.addEventListener('click', async () => {
    try {
      const pos = await prendiMiaPosizione();
      setPickedLocation(pos.lat, pos.lng, true);
    } catch {
      alert('Non sono riuscito a leggere la tua posizione.');
    }
  });

  saveSegnoBtn.addEventListener('click', async () => {
    try {
      const text = segnoText.value.trim();
      if (!text) return alert('Scrivi qualcosa prima di salvare.');

      const lat = parseFloat(pickedLocation.dataset.lat || '');
      const lng = parseFloat(pickedLocation.dataset.lng || '');
      if (!isFinite(lat) || !isFinite(lng)) {
        return alert('Scegli una posizione cliccando sulla mappa o usando la tua posizione.');
      }

      const { allowed } = await checkQuotaAndUpdate();
      if (!allowed) return;

      await salvaSegno({ text, lat, lng });   // ➜ disegna subito
      segnoText.value = '';
      closeSegnoDialog();

      await caricaSegniRecenti();             // ➜ ricarica tutti i segni
      await checkQuotaAndUpdate();
    } catch (e) {
      console.error(e);
      alert('Errore nel salvataggio del segno.');
    }
  });

  cancelAddSegno.addEventListener('click', () => closeSegnoDialog());
}

// Bootstrap
(async function main() {
  initMap();
  wireEvents();
  updateUI();

  onAuthStateChanged(auth, async () => {
    updateUI();
    await checkQuotaAndUpdate();
  });

  await caricaSegniRecenti();
})();
