// app.js
import { app, auth, db, googleProvider, serverTimestamp } from './firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ------ Config app ------
const SEGNI_COLL = 'segni';
const QUOTA_MAX = 3;          // max segni ogni 24h
const RECENTI_N = 200;        // quanti segni caricare sulla mappa

// ------ Elementi DOM ------
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const addSegnoBtn = document.getElementById('addSegnoBtn');
const segnoDialog = document.getElementById('segnoDialog'); // <dialog>
const segnoText = document.getElementById('segnoText');     // <textarea>
const useMyLocation = document.getElementById('useMyLocation'); // <input type="checkbox">
const pickedLocation = document.getElementById('pickedLocation'); // <span>
const quotaInfo = document.getElementById('quotaInfo');

// ------ Mappa Leaflet ------
let map;
let pickMarker = null;    // marker usato per nuova posizione
let markersLayer = null;  // layer per i segni già salvati

function initMap() {
  map = L.map('map').setView([41.9028, 12.4964], 6); // Italia centrale
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Pick posizione con click
  map.on('click', (e) => {
    setPickedLocation(e.latlng.lat, e.latlng.lng, true);
  });
}

function setPickedLocation(lat, lng, moveMap = false) {
  if (pickMarker) map.removeLayer(pickMarker);
  pickMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
  if (moveMap) map.setView([lat, lng], Math.max(map.getZoom(), 13));
  pickedLocation.textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
  pickedLocation.dataset.lat = String(lat);
  pickedLocation.dataset.lng = String(lng);
  addSegnoBtn.disabled = false;

  pickMarker.on('dragend', () => {
    const p = pickMarker.getLatLng();
    setPickedLocation(p.lat, p.lng, false);
  });
}

// ------ UI auth/quota ------
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
    quotaInfo.textContent = 'Devi accedere per lasciare un segno.';
  }
}

// Calcola quota residua (ultime 24h)
async function checkQuotaAndUpdate() {
  if (!auth.currentUser) {
    addSegnoBtn.disabled = true;
    quotaInfo.textContent = 'Devi accedere per lasciare un segno.';
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
  const count = snap.size;
  const left = Math.max(0, QUOTA_MAX - count);

  if (left <= 0) {
    addSegnoBtn.disabled = true;
    quotaInfo.textContent = `Hai raggiunto il limite di ${QUOTA_MAX} segni nelle ultime 24 ore.`;
    return { allowed: false, left: 0 };
  } else {
    addSegnoBtn.disabled = false;
    quotaInfo.textContent = `Puoi lasciare ancora ${left}/${QUOTA_MAX} segni (ultime 24h).`;
    return { allowed: true, left };
  }
}

// ------ Auth handlers ------
async function handleLogin() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error('Login error:', err);
    alert('Accesso non riuscito.');
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// ------ Firestore: salva & carica segni ------
async function salvaSegno({ text, lat, lng }) {
  if (!auth.currentUser) throw new Error('Utente non autenticato');
  const docData = {
    text: text.trim(),
    lat,
    lng,
    uid: auth.currentUser.uid,
    userName: auth.currentUser.displayName || 'Utente',
    userPhoto: auth.currentUser.photoURL || null,
    createdAt: serverTimestamp()
  };
  await addDoc(collection(db, SEGNI_COLL), docData);
}

async function caricaSegniRecenti() {
  markersLayer.clearLayers();

  const q = query(
    collection(db, SEGNI_COLL),
    orderBy('createdAt', 'desc'),
    limit(RECENTI_N)
  );

  const snap = await getDocs(q);
  snap.forEach((doc) => {
    const d = doc.data();
    if (typeof d.lat === 'number' && typeof d.lng === 'number') {
      const m = L.circleMarker([d.lat, d.lng], {
        radius: 6
      });
      const when = d.createdAt?.toDate ? d.createdAt.toDate() : null;
      const timeStr = when ? when.toLocaleString() : 'data…';
      m.bindPopup(
        `<strong>${escapeHtml(d.userName || 'Utente')}</strong><br>${escapeHtml(
          d.text || ''
        )}<br><small>${timeStr}</small>`
      );
      markersLayer.addLayer(m);
    }
  });
}

// ------ Dialog gestione ------
function openSegnoDialog() {
  segnoText.value = '';
  segnoText.focus();
  if (typeof segnoDialog.showModal === 'function') {
    segnoDialog.showModal();
  } else {
    // fallback povero
    segnoDialog.style.display = 'block';
  }
}

function closeSegnoDialog() {
  if (typeof segnoDialog.close === 'function') {
    segnoDialog.close();
  } else {
    segnoDialog.style.display = 'none';
  }
}

// ------ Geolocalizzazione ------
function prendiMiaPosizione() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalizzazione non supportata'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        resolve({ lat: latitude, lng: longitude });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// ------ Utils ------
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ------ Event wiring ------
function wireEvents() {
  loginBtn?.addEventListener('click', handleLogin);
  logoutBtn?.addEventListener('click', handleLogout);

  // Apri dialog per scrivere un segno
  document.getElementById('openSegnoDialog')?.addEventListener('click', async () => {
    const quota = await checkQuotaAndUpdate();
    if (!quota.allowed) return;
    openSegnoDialog();
  });

  // Conferma invio segno
  document.getElementById('confirmAddSegno')?.addEventListener('click', async () => {
    try {
      const text = segnoText.value.trim();
      if (!text) {
        alert('Scrivi qualcosa prima di salvare.');
        return;
      }

      let lat = null;
      let lng = null;

      if (useMyLocation?.checked) {
        const pos = await prendiMiaPosizione();
        lat = pos.lat;
        lng = pos.lng;
        setPickedLocation(lat, lng, true);
      } else {
        const dlat = pickedLocation.dataset.lat;
        const dlng = pickedLocation.dataset.lng;
        if (!dlat || !dlng) {
          alert('Scegli una posizione cliccando sulla mappa, oppure spunta "Usa la mia posizione".');
          return;
        }
        lat = parseFloat(dlat);
        lng = parseFloat(dlng);
      }

      // ricontrollo quota subito prima del salvataggio
      const { allowed } = await checkQuotaAndUpdate();
      if (!allowed) return;

      await salvaSegno({ text, lat, lng });
      closeSegnoDialog();
      segnoText.value = '';
      // aggiorna mappa e quota
      await caricaSegniRecenti();
      await checkQuotaAndUpdate();
    } catch (err) {
      console.error(err);
      alert('Non sono riuscito a salvare il segno.');
    }
  });

  // Chiudi dialog
  document.getElementById('cancelAddSegno')?.addEventListener('click', () => {
    closeSegnoDialog();
  });

  // Toggle "usa la mia posizione": se attivo, prova subito a centrare il marker
  useMyLocation?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      try {
        const pos = await prendiMiaPosizione();
        setPickedLocation(pos.lat, pos.lng, true);
      } catch {
        alert('Non sono riuscito a leggere la tua posizione.');
        useMyLocation.checked = false;
      }
    }
  });
}

// ------ Bootstrap ------
(async function main() {
  initMap();
  wireEvents();
  updateUI();

  onAuthStateChanged(auth, async () => {
    updateUI();
    await checkQuotaAndUpdate();
  });

  // carica i segni iniziali
  await caricaSegniRecenti();
})();
