import './style.css';

const map = L.map('map').setView([42.5, 12.5], 5);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const planesLayer = L.layerGroup().addTo(map);

// bounding box di default (Italia small)
const lamin = 36.0;
const lamax = 48.0;
const lomin = 6.0;
const lomax = 18.0;

const btn = document.createElement('button');
btn.textContent = 'AGGIORNA';
btn.style.position = 'absolute';
btn.style.top = '10px';
btn.style.right = '10px';
btn.style.zIndex = '1000';
btn.style.padding = '8px 12px';
btn.style.borderRadius = '4px';
btn.style.border = 'none';
btn.style.background = '#1976d2';
btn.style.color = 'white';
btn.style.cursor = 'pointer';
btn.style.fontFamily = 'sans-serif';
btn.style.fontSize = '14px';
document.body.appendChild(btn);

// select per scegliere paese / regione: lo mettiamo a sinistra del bottone
const select = document.createElement('select');
select.style.position = 'absolute';
select.style.top = '10px';
select.style.right = '120px';
select.style.zIndex = '1000';
select.style.padding = '6px';
select.style.borderRadius = '4px';
select.style.border = '1px solid rgba(0,0,0,0.2)';
select.style.fontFamily = 'sans-serif';
select.style.fontSize = '13px';
document.body.appendChild(select);

// label per la select (opzionale)
const selectLabel = document.createElement('label');
selectLabel.textContent = 'Regione:';
selectLabel.style.position = 'absolute';
selectLabel.style.top = '13px';
selectLabel.style.right = '200px';
selectLabel.style.zIndex = '1000';
selectLabel.style.color = 'white';
selectLabel.style.fontFamily = 'sans-serif';
selectLabel.style.fontSize = '13px';
document.body.appendChild(selectLabel);

// info ultimo aggiornamento
const info = document.createElement('div');
info.style.position = 'absolute';
info.style.top = '10px';
info.style.left = '10px';
info.style.zIndex = '1000';
info.style.padding = '6px 10px';
info.style.borderRadius = '4px';
info.style.background = 'rgba(0,0,0,0.6)';
info.style.color = 'white';
info.style.fontFamily = 'sans-serif';
info.style.fontSize = '12px';
info.textContent = 'Ultimo aggiornamento: mai';
document.body.appendChild(info);

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 60_000;

let last429Time = 0;
const COOLDOWN_MS = 5 * 60_000;

function formatTime(date) {
  return date.toLocaleTimeString('it-IT', { hour12: false });
}

const planeMarkers = {};

// calcola bearing tra due punti (gradi)
function computeBearing(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

function createPlaneIcon(deg, size = 28) {
  const style = `
    transform: rotate(${deg}deg);
    width: ${size}px;
    height: ${size}px;
    display: block;
    margin: 0;
    padding: 0;
    -webkit-backface-visibility: hidden;
  `;
  const html = `<img src="/plane.png" style="${style}" alt="plane" />`;
  return L.divIcon({
    className: 'plane-divicon',
    html,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
}

function updateOrCreatePlane(state, destinationLatLon = null) {
  const icao24 = state[0];
  const callsign = state[1] ? state[1].trim() : "N/A";
  const originCountry = state[2];
  const lon = state[5];
  const lat = state[6];
  const baroAltitude = state[7];
  const velocity = state[9];
  const heading = state[10];

  if (lat == null || lon == null) return;

  let bearing;
  if (destinationLatLon && destinationLatLon.lat != null) {
    bearing = computeBearing(lat, lon, destinationLatLon.lat, destinationLatLon.lon);
  } else if (heading != null && !Number.isNaN(heading)) {
    bearing = heading;
  } else {
    bearing = 0;
  }

  if (planeMarkers[icao24]) {
    const m = planeMarkers[icao24];
    m.setLatLng([lat, lon]);
    m.setIcon(createPlaneIcon(bearing, 34));
    const popup = m.getPopup();
    if (popup) {
      popup.setContent(`
        <b>${callsign}</b><br/>
        ICAO24: ${icao24}<br/>
        Paese: ${originCountry}<br/>
        Altitudine (baro): ${baroAltitude ? baroAltitude.toFixed(0) + " m" : "N/D"}<br/>
        Velocità: ${velocity ? (velocity * 3.6).toFixed(0) + " km/h" : "N/D"}<br/>
        Direzione (°): ${bearing ? bearing.toFixed(0) : 'N/D'}
      `);
    }
  } else {
    const icon = createPlaneIcon(bearing, 34);
    const marker = L.marker([lat, lon], { icon }).addTo(planesLayer);
    marker.bindPopup(`
      <b>${callsign}</b><br/>
      ICAO24: ${icao24}<br/>
      Paese: ${originCountry}<br/>
      Altitudine (baro): ${baroAltitude ? baroAltitude.toFixed(0) + " m" : "N/D"}<br/>
      Velocità: ${velocity ? (velocity * 3.6).toFixed(0) + " km/h" : "N/D"}<br/>
      Direzione (°): ${bearing ? bearing.toFixed(0) : 'N/D'}
    `);
    planeMarkers[icao24] = marker;
  }
}

// MAPPA di regioni -> URL (bbox)
const REGION_URLS = {
  'all': `https://opensky-network.org/api/states/all`,
  'europe': `https://opensky-network.org/api/states/all?lamin=34.0&lomin=-25.0&lamax=72.0&lomax=45.0`,
  'italy': `https://opensky-network.org/api/states/all?lamin=35.0&lomin=6.0&lamax=47.5&lomax=19.0`,
  'france': `https://opensky-network.org/api/states/all?lamin=41.0&lomin=-5.5&lamax=51.5&lomax=9.6`,
  'uk': `https://opensky-network.org/api/states/all?lamin=49.9&lomin=-6.5&lamax=55.8&lomax=2.0`,
  'germany': `https://opensky-network.org/api/states/all?lamin=47.2&lomin=5.8&lamax=55.1&lomax=15.0`,
  'spain': `https://opensky-network.org/api/states/all?lamin=35.9&lomin=-9.5&lamax=44.0&lomax=4.5`,
  'japan': `https://opensky-network.org/api/states/all?lamin=30.0&lomin=129.0&lamax=46.0&lomax=146.0`,
  'china': `https://opensky-network.org/api/states/all?lamin=18.0&lomin=73.0&lamax=53.5&lomax=135.0`,
  'usa': `https://opensky-network.org/api/states/all?lamin=18.0&lomin=-170.0&lamax=72.0&lomax=-30.0`
};

// popolare la select con le opzioni
function populateSelect() {
  const entries = [
    { key: 'all', label: 'Tutto (global)' },
    { key: 'europe', label: 'Europa' },
    { key: 'italy', label: 'Italia' },
    { key: 'france', label: 'Francia' },
    { key: 'uk', label: 'Regno Unito' },
    { key: 'germany', label: 'Germania' },
    { key: 'spain', label: 'Spagna' },
    { key: 'japan', label: 'Giappone' },
    { key: 'china', label: 'Cina' },
    { key: 'usa', label: 'America (tutte)' }
  ];

  for (const e of entries) {
    const option = document.createElement('option');
    option.value = e.key;
    option.textContent = e.label;
    select.appendChild(option);
  }

  // valore iniziale: Italia
  select.value = 'italy';
}
populateSelect();

// variabile che contiene l'URL attuale da usare per fetch
let currentFetchUrl = REGION_URLS[select.value] || REGION_URLS['italy'];

// quando cambio la select, aggiorno l'URL corrente (non faccio fetch automatico, ma puoi volerlo)
select.addEventListener('change', () => {
  const key = select.value;
  if (REGION_URLS[key]) {
    currentFetchUrl = REGION_URLS[key];
    console.log('Selezionato:', key, '->', currentFetchUrl);
    // opzionale: cambiare centro/zoom della mappa in base alla regione selezionata
    switch (key) {
      case 'italy':
        map.setView([42.5, 12.5], 5);
        break;
      case 'europe':
        map.setView([54.0, 10.0], 4);
        break;
      case 'france':
        map.setView([46.5, 2.5], 5);
        break;
      case 'uk':
        map.setView([54.0, -2.0], 5);
        break;
      case 'germany':
        map.setView([51.0, 10.0], 5);
        break;
      case 'spain':
        map.setView([40.0, -3.5], 5);
        break;
      case 'japan':
        map.setView([36.0, 138.0], 5);
        break;
      case 'china':
        map.setView([35.0, 103.0], 4);
        break;
      case 'usa':
        map.setView([39.0, -98.0], 4);
        break;
      default:
        map.setView([42.5, 12.5], 5);
    }
  } else {
    console.warn('Regione non trovata:', key);
  }
});

// Funzione che carica gli aerei usando currentFetchUrl
async function loadPlanes() {
  const now = Date.now();

  if (last429Time && now - last429Time < COOLDOWN_MS) {
    const remaining = COOLDOWN_MS - (now - last429Time);
    const sec = Math.ceil(remaining / 1000);
    alert(`OpenSky ti ha limitato. Riprova tra circa ${sec} secondi.`);
    return;
  }

  const diff = now - lastRequestTime;
  if (diff < MIN_INTERVAL_MS) {
    const sec = Math.ceil((MIN_INTERVAL_MS - diff) / 1000);
    console.log(`Aspetta ancora ${sec}s prima di aggiornare di nuovo`);
    return;
  }

  lastRequestTime = now;

  // URL da usare
  const url = currentFetchUrl || REGION_URLS['italy'];

  try {
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error('Errore HTTP OpenSky:', res.status, res.statusText, text);

      if (res.status === 429) {
        last429Time = Date.now();
        alert("OpenSky dice: 'Too Many Requests'. Ti ha messo in rate limit.\nAspetta qualche minuto e poi riprova.");
      }
      return;
    }

    const body = await res.json();
    const states = body.states;
    if (!states) {
      console.warn('Nessun aereo ricevuto da OpenSky');
      return;
    }

    const seen = new Set();

    for (const state of states) {
      const icao24 = state[0];
      seen.add(icao24);

      // al momento non abbiamo la destinazione reale; lasciamo null
      const destinationLatLon = null;
      updateOrCreatePlane(state, destinationLatLon);
    }

    // rimuovo marker non più presenti
    for (const key of Object.keys(planeMarkers)) {
      if (!seen.has(key)) {
        planesLayer.removeLayer(planeMarkers[key]);
        delete planeMarkers[key];
      }
    }

    console.log(`Aggiornamento riuscito, aerei: ${states.length}`);
    info.textContent = `Ultimo aggiornamento: ${formatTime(new Date())}`;
  } catch (err) {
    console.error('Errore fetch OpenSky:', err);
  }
}

// caricamento iniziale
loadPlanes();

// click sul bottone aggiorna con l'URL selezionato
btn.addEventListener('click', loadPlanes);

select.addEventListener('change', () => {
  loadPlanes();
});
