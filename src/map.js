// map.js
import './style.css';
import pb from './pocketbase.js'; 
import { createCollection } from './dati_carica.js'; // Import per la sincronizzazione iniziale

// --- Configurazione PocketBase e Mappa ---
const map = L.map('map').setView([42.5, 12.5], 5);
const collectionName = 'opensky_states'; 
const planeMarkers = {};
let currentRegionKey = 'italy'; 

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const planesLayer = L.layerGroup().addTo(map);

// Mappa regioni -> Coordinate Bounding Box (Latitudine Min, Max, Longitudine Min, Max)
const REGION_BOUNDS = {
    // [lat_min, lat_max, lon_min, lon_max]
    'all': [18.0, 72.0, -170.0, 180.0], 
    'europe': [34.0, 72.0, -25.0, 45.0],
    'italy': [35.0, 47.5, 6.0, 19.0],
    'france': [41.0, 51.5, -5.5, 9.6],
    'uk': [49.9, 55.8, -6.5, 2.0],
    'germany': [47.2, 55.1, 5.8, 15.0],
    'spain': [35.9, 44.0, -9.5, 4.5],
    'japan': [30.0, 46.0, 129.0, 146.0],
    'china': [18.0, 53.5, 73.0, 135.0],
    'usa': [18.0, 72.0, -170.0, -30.0] 
};

// --- Elementi UI ---
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

const selectLabel = document.createElement('label');
selectLabel.textContent = 'Regione:';
selectLabel.style.position = 'absolute';
selectLabel.style.top = '13px';
selectLabel.style.right = '200px';
selectLabel.style.zIndex = '1000';
selectLabel.style.color = 'white';
selectLabel.style.fontFamily = 'sans-serif';
selectLabel.style.fontSize = '13px';

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


// --- Funzioni di Utilità ---

function formatTime(date) {
  return date.toLocaleTimeString('it-IT', { hour12: false });
}

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

function createPlaneIcon(imgPath, deg, size = 34) {
  const style = `
    transform: rotate(${deg}deg);
    width: ${size}px;
    height: ${size}px;
    display: block;
    margin: 0;
    padding: 0;
    -webkit-backface-visibility: hidden;
  `;
  const html = `<img src="${imgPath}" style="${style}" alt="plane" />`;
  return L.divIcon({
    className: 'plane-divicon',
    html,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
}

function choosePlaneImage(baroAltitude) {
  if (baroAltitude == null || Number.isNaN(baroAltitude)) return '/plane2.png'; 

  const alt = Number(baroAltitude);
  if (alt < 100) return '/plane2.png';   
  if (alt > 10000) return '/plane1.png'; 
  if (alt < 1000) return '/plane.png';   
  return '/plane.png';                    
}

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
  select.value = 'italy';
}

function buildPocketBaseFilter(regionKey) {
    const bounds = REGION_BOUNDS[regionKey];
    if (!bounds || regionKey === 'all') {
        return '';
    }
    
    // Filtro per latitudine E longitudine: lat_min, lat_max, lon_min, lon_max
    const [lat_min, lat_max, lon_min, lon_max] = bounds;

    return `latitudine >= ${lat_min} && latitudine <= ${lat_max} && longitudine >= ${lon_min} && longitudine <= ${lon_max}`;
}

// --- Funzioni Principali ---

// Aggiorna o crea marker aereo
function updateOrCreatePlane(record) {
    const icao24 = record.icao24;
    const callsign = record.callsign;
    const originCountry = record.origin_country;
    const lon = record.longitudine;
    const lat = record.latitudine;
    const baroAltitude = record.altitudine_baro;
    const velocity = record.velocita;
    const heading = record.rotta;

    if (lat == null || lon == null) return;

    let bearing;
    if (heading != null && !Number.isNaN(heading)) {
        bearing = heading;
    } else {
        bearing = 0;
    }

    const img = choosePlaneImage(baroAltitude);

    if (planeMarkers[icao24]) {
        const m = planeMarkers[icao24];
        m.setLatLng([lat, lon]);
        m.setIcon(createPlaneIcon(img, bearing));

        const popup = m.getPopup();
        if (popup) {
            popup.setContent(`
                <b>${callsign}</b><br/>
                ICAO24: ${icao24}<br/>
                Paese: ${originCountry}<br/>
                Altitudine (baro): ${baroAltitude ? Math.round(baroAltitude) + " m" : "N/D"}<br/>
                Velocità: ${velocity ? (velocity * 3.6).toFixed(0) + " km/h" : "N/D"}<br/>
                Direzione (°): ${bearing ? Math.round(bearing) : 'N/D'}
            `);
        }
    } else {
        const icon = createPlaneIcon(img, bearing);
        const marker = L.marker([lat, lon], { icon }).addTo(planesLayer);

        marker.bindPopup(`
            <b>${callsign}</b><br/>
            ICAO24: ${icao24}<br/>
            Paese: ${originCountry}<br/>
            Altitudine (baro): ${baroAltitude ? Math.round(baroAltitude) + " m" : "N/D"}<br/>
            Velocità: ${velocity ? (velocity * 3.6).toFixed(0) + " km/h" : "N/D"}<br/>
            Direzione (°): ${bearing ? Math.round(bearing) : 'N/D'}
        `);

        marker.bindTooltip(callsign, { permanent: false, direction: 'top', offset: [0, -10] });
        marker.on('mouseover', e => e.target.openTooltip());
        marker.on('mouseout', e => e.target.closeTooltip());

        planeMarkers[icao24] = marker;
    }
}

// Carica i dati dal DB PocketBase applicando il filtro regione
export async function loadPlanesFromPocketBase() {
    try {
        console.log(`Inizio caricamento aerei da PocketBase per la regione: ${currentRegionKey}...`);
        
        const filterString = buildPocketBaseFilter(currentRegionKey);
        
        // RECUPERA I RECORD DALLA COLLEZIONE CON IL FILTRO APPLICATO
        const records = await pb.collection(collectionName).getFullList({
            filter: filterString, 
        });
        
        const seen = new Set();

        for (const record of records) {
            const icao24 = record.icao24;
            seen.add(icao24);
            updateOrCreatePlane(record); 
        }

        // Rimuovi i marker che non sono più presenti nei risultati filtrati
        for (const key of Object.keys(planeMarkers)) {
            if (!seen.has(key)) {
                planesLayer.removeLayer(planeMarkers[key]);
                delete planeMarkers[key];
            }
        }

        info.textContent = `Ultimo aggiornamento: ${formatTime(new Date())} (Da PocketBase - ${records.length} aerei)`;
        console.log(`✅ Caricamento da PocketBase completato. Aerei visualizzati: ${records.length}`);

    } catch (err) {
        console.error('Errore durante il fetch da PocketBase:', err);
        info.textContent = `Errore aggiornamento: ${formatTime(new Date())}`;
    }
}


// Inizializza la mappa e gli elementi UI
export function initializeMap() {
    // Monta la UI nel body
    document.body.appendChild(btn);
    document.body.appendChild(select);
    document.body.appendChild(selectLabel);
    document.body.appendChild(info);

    // Gestione eventi: Il pulsante AGGIORNA ora carica da PocketBase
    btn.addEventListener('click', loadPlanesFromPocketBase);
    
    // Gestione evento: cambio regione
    select.addEventListener('change', () => {
        const key = select.value;
        currentRegionKey = key; // Aggiorna la chiave della regione corrente
        
        // Centra la mappa
        switch (key) {
            case 'italy': map.setView([42.5, 12.5], 5); break;
            case 'europe': map.setView([54.0, 10.0], 4); break;
            case 'france': map.setView([46.5, 2.5], 5); break;
            case 'uk': map.setView([54.0, -2.0], 5); break;
            case 'germany': map.setView([51.0, 10.0], 5); break;
            case 'spain': map.setView([40.0, -3.5], 5); break;
            case 'japan': map.setView([36.0, 138.0], 5); break;
            case 'china': map.setView([35.0, 103.0], 4); break;
            case 'usa': map.setView([39.0, -98.0], 4); break;
            default: map.setView([42.5, 12.5], 5);
        }
        
        // Carica i dati con il nuovo filtro
        loadPlanesFromPocketBase(); 
    });
    
    // Popola il selettore delle regioni
    populateSelect();
}

// Inizializzazione principale all'avvio dell'app (se non usi un main.js separato)
// Se stai usando un main.js separato, queste righe vanno commentate o rimosse:
// initializeMap();
// createCollection().then(loadPlanesFromPocketBase);