# Orma — MVP (Vercel/Netlify ready)

Questa è una **versione MVP** di Orma: mappa interattiva (Leaflet) + autenticazione (Firebase Auth) + database (Firestore).

## ✨ Funzioni incluse
- Mappa OpenStreetMap (Leaflet) con puntini luminosi
- Login con Google (Firebase Auth)
- Aggiunta di un “segno” (testo + posizione) con limite **2 al giorno** per utente (controllo lato client)
- Segni mostrati in tempo reale (snapshot Firestore)

## ⚙️ Setup rapido (15 minuti)
1. **Crea progetto Firebase**
   - https://console.firebase.google.com → *Aggiungi progetto* → *Crea app Web*
   - Abilita **Authentication → Sign-in method → Google** (o Email/Password)
   - Abilita **Firestore Database → modalità di produzione**
2. **Copia la config**
   - Dalla pagina di setup della web app, copia l’oggetto `firebaseConfig` e incollalo in `firebase-config.js` sostituendo il placeholder.
3. **Regole Firestore (minime per MVP)**
   - In Firestore → *Rules* incolla queste regole **semplici**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /segni/{doc} {
         allow read: if true;
         allow create: if request.auth != null;
         allow update, delete: if false;
       }
     }
   }
   ```
   > Nota: la limitazione “2 al giorno” è lato client per l’MVP. Per renderla vincolante lato server, aggiungere una Cloud Function o una regola avanzata con contatore (step successivo).
4. **Avvio locale (facoltativo)**
   - Servi la cartella con un server statico (es. VS Code Live Server) e apri `index.html`.
5. **Deploy su Vercel (consigliato)**
   - Crea un repository Git (GitHub)
   - Carica tutti i file della cartella
   - Vai su https://vercel.com → *New Project* → Importa repository → Deploy
   - (Opzionale) Collega un dominio (es. `orma.world`)
6. **Deploy su Netlify (alternativa)**
   - https://app.netlify.com → *Add new site* → *Deploy manually* → trascina la cartella oppure collega GitHub

## 🧩 Struttura
```
/ (root)
├── index.html
├── style.css
├── app.js
├── firebase.js
├── firebase-config.js   ← Inserisci qui la tua config Firebase
└── README.md
```

## 🗺️ Uso
- Clicca sulla mappa per scegliere la posizione **oppure** usa “Usa la mia posizione” nel dialog.
- Scrivi il testo (max 240 caratteri) e salva. Il segno appare subito sulla mappa.

## 🔐 Note sicurezza
- Questo è un MVP. Le regole attuali **consentono la lettura pubblica** dei segni e la **creazione** agli utenti autenticati.
- Per evitare spam/abusi in produzione, aggiungi:
  - Verifica reCAPTCHA Enterprise o App Check
  - Cloud Function per imporre quota (2/die) lato server
  - Moderazione (campo `approved: true` e regole/CF per approvazione)

## 🧪 Tester
Condividi l’URL del deploy ai primi 10–30 tester. Chiedi:
- Quanto è stato facile lasciare un segno?
- La mappa era chiara?
- Cosa manca per sentirsi coinvolti a tornare domani?

Buon viaggio con Orma! 🌍
