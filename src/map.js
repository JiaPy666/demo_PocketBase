// map.js
// Logica Mappa Leaflet, UI, Filtri e Visualizzazione dati DA LOCALSTORAGE

import { loadFromLocalStorage } from './localstorage.js';
import { KEY } from './data_fetcher.js'; // Chiave per localStorage ('opensky')

// --- VARIABILI GLOBALI LEAFLET E STATO ---
const map = L.map('map').setView([42.5, 12.5], 5); // Inizializzazione mappa con vista sull'Italia
const planesLayer = L.layerGroup().addTo(map);
const planeMarkers = {};

let currentRegionKey = 'italy';
// *** RIPRISTINATO: Variabile per il filtro altitudine ***
let activeFilter = "all"; // Filtro per quota: 'all', 'red', 'yellow', 'green' 

let regionListElement; // Elemento UI per la lista di regioni
// *** RIPRISTINATO: Variabile per il box del filtro altitudine ***
let altitudeFilterBox; 

// Mappa regioni con coordinate per il filtering lato client (bounding box) e etichette
const REGION_BOUNDS = {
  'all': { label: 'Tutto (Global)', view: [42.5, 12.5], zoom: 3, bounds: { lamin: -90, lomin: -180, lamax: 90, lomax: 180 } },
  'europe': { label: 'Europa', view: [54.0, 10.0], zoom: 4, bounds: { lamin: 34.0, lomin: -25.0, lamax: 72.0, lomax: 45.0 } },
  'italy': { label: 'Italia', view: [42.5, 12.5], zoom: 5, bounds: { lamin: 35.0, lomin: 6.0, lamax: 47.5, lomax: 19.0 } },
  'france': { label: 'Francia', view: [46.5, 2.5], zoom: 5, bounds: { lamin: 41.0, lomin: -5.5, lamax: 51.5, lomax: 9.6 } },
  'uk': { label: 'Regno Unito', view: [54.0, -2.0], zoom: 5, bounds: { lamin: 49.9, lomin: -6.5, lamax: 55.8, lomax: 2.0 } },
  'germany': { label: 'Germania', view: [51.0, 10.0], zoom: 5, bounds: { lamin: 47.2, lomin: 5.8, lamax: 55.1, lomax: 15.0 } },
  'spain': { label: 'Spagna', view: [40.0, -3.5], zoom: 5, bounds: { lamin: 35.9, lomin: -9.5, lamax: 44.0, lomax: 4.5 } },
  'japan': { label: 'Giappone', view: [36.0, 138.0], zoom: 5, bounds: { lamin: 30.0, lomin: 129.0, lamax: 46.0, lomax: 146.0 } },
  'china': { label: 'Cina', view: [35.0, 103.0], zoom: 4, bounds: { lamin: 18.0, lomin: 73.0, lamax: 53.5, lomax: 135.0 } },
  'usa': { label: 'America', view: [39.0, -98.0], zoom: 4, bounds: { lamin: 18.0, lomin: -170.0, lamax: 72.0, lomax: -30.0 } }
};

// Funzione di utilità per mappare l'indice dell'array alla path dell'immagine
function getImageForRegion(index) {
    // Le immagini sono numerate da 1 a 10
    return `/image${index + 1}.png`; 
}


// --- FUNZIONI UTILITY (MANTENUTE PER LA VISUALIZZAZIONE DEL COLORE DEL PLANE) ---

// ... (Le funzioni formatTime, getColorCategoryFromImgPath, choosePlaneImage, createPlaneIcon, updateOrCreatePlane rimangono invariate) ...

function formatTime(date) { 
    return date.toLocaleTimeString('it-IT', { hour12: false }); 
}

function getColorCategoryFromImgPath(imgPath) {
  if (imgPath.includes("plane1.png")) return "red";
  if (imgPath.includes("plane2.png")) return "green";
  return "yellow";
}

function choosePlaneImage(baroAltitude) {
  if (baroAltitude == null || Number.isNaN(baroAltitude)) return '/plane2.png'; 

  const alt = Number(baroAltitude);
  if (alt < 100) return '/plane2.png';   // verde (Terra/Molto Bassa)
  if (alt > 10000) return '/plane1.png'; // rosso (Alta Quota)
  return '/plane.png';                    // giallo (Bassa Quota/Media)
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

function updateOrCreatePlane(state) {
  // Mappatura dati OpenSky (come da standard)
  const icao24 = state[0];
  const callsign = state[1] ? state[1].trim() : "N/A";
  const originCountry = state[2];
  const lon = state[5];
  const lat = state[6];
  const baroAltitude = state[7]; 
  const velocity = state[9];
  const heading = state[10];

  if (lat == null || lon == null) return;

  const bearing = (heading != null && !Number.isNaN(heading)) ? heading : 0;

  const img = choosePlaneImage(baroAltitude);
  const colorCategory = getColorCategoryFromImgPath(img); // Usato per il filtro altitudine

  const popupContent = `
        <b>${callsign}</b><br/>
        ICAO24: ${icao24}<br/>
        Paese: ${originCountry}<br/>
        Altitudine (baro): ${baroAltitude ? Math.round(baroAltitude) + " m" : "N/D"}<br/>
        Velocità: ${velocity ? (velocity * 3.6).toFixed(0) + " km/h" : "N/D"}<br/>
        Direzione (°): ${bearing ? Math.round(bearing) : 'N/D'}
    `;

  if (planeMarkers[icao24]) {
    const m = planeMarkers[icao24];
    m.setLatLng([lat, lon]);
    m.setIcon(createPlaneIcon(img, bearing));
    m._altitude = baroAltitude;
    m._altColor = colorCategory; // Salvataggio della categoria di colore per il filtro altitudine
    
    const popup = m.getPopup();
    if (popup) popup.setContent(popupContent);
    const tt = m.getTooltip();
    if (tt) tt.setContent(callsign);
    m.update(); 
    
  } else {
    const icon = createPlaneIcon(img, bearing);
    const marker = L.marker([lat, lon], { icon });

    marker._altitude = baroAltitude;
    marker._altColor = colorCategory; // Salvataggio della categoria di colore per il filtro altitudine

    marker.bindPopup(popupContent);
    marker.bindTooltip(callsign, { permanent: false, direction: 'top', offset: [0, -10] });
    marker.on('mouseover', e => e.target.openTooltip());
    marker.on('mouseout', e => e.target.closeTooltip());

    planeMarkers[icao24] = marker;
  }
}

// --- LOGICA DI FILTRAGGIO COMBINATO (REGIONALE E ALTITUDINE) ---

/**
 * Applica entrambi i filtri (Regionale e Quota) ai marker attualmente creati.
 */
function applyFilter() {
    const currentBounds = REGION_BOUNDS[currentRegionKey].bounds;

    Object.values(planeMarkers).forEach(marker => {
        const col = marker._altColor;
        const lat = marker.getLatLng().lat;
        // CORREZIONE: Usare .lng per la longitudine di Leaflet
        const lon = marker.getLatLng().lng; 

        // 1. Filtro Regionale (BOUNDING BOX)
        const inBounds = lat >= currentBounds.lamin && lat <= currentBounds.lamax &&
                         lon >= currentBounds.lomin && lon <= currentBounds.lomax;
        
        // 2. Filtro Altitudine (USA la variabile globale activeFilter)
        let altitudeShow = (activeFilter === "all" || col === activeFilter);

        // Visualizza solo se passa entrambi i filtri
        if (inBounds && altitudeShow) marker.addTo(planesLayer);
        else planesLayer.removeLayer(marker);
    });
}

// --- FUNZIONI DI INIZIALIZZAZIONE UI ---

function getUIReferences() {
    // Riferimento all'elemento contenitore della lista regioni
    regionListElement = document.getElementById('region-list');
    // *** RIPRISTINATO: Riferimento al box del filtro altitudine ***
    altitudeFilterBox = document.getElementById('altitude-filter-box');
}

/**
 * Crea e inietta i bottoni regione con immagini nel contenitore.
 */
function createRegionSelectorUI() {
    Object.entries(REGION_BOUNDS).forEach(([key, data], index) => {
        const imgPath = getImageForRegion(index);
        
        const btn = document.createElement('div');
        // Imposta 'active' per la regione di default (italy)
        btn.className = `region-btn ${key === currentRegionKey ? 'active' : ''}`;
        btn.dataset.region = key;
        
        btn.innerHTML = `
            <img src="${imgPath}" alt="${data.label}" />
            <span>${data.label}</span>
        `;

        regionListElement.appendChild(btn);
    });
}

function setupEventListeners() {
    
    // --- 1. Gestione filtri ALTITUDINE (RIPRISTINATO) ---
    altitudeFilterBox.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        altitudeFilterBox.querySelectorAll(".filter-btn")
          .forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        
        applyFilter(); // Applica i filtri combinati
      });
    });

    // --- 2. Gestione selezione REGIONE sul nuovo selettore ---
    regionListElement.querySelectorAll(".region-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const key = btn.dataset.region;

        // Rimuovi 'active' da tutti i bottoni e aggiungilo al bottone cliccato
        regionListElement.querySelectorAll(".region-btn")
          .forEach(b => b.classList.remove("active"));
        e.currentTarget.classList.add("active");

        if (REGION_BOUNDS[key]) {
          const data = REGION_BOUNDS[key];
          currentRegionKey = key;
          map.setView(data.view, data.zoom);
          applyFilter(); // Applica i filtri combinati
        }
      });
    });

}

// --- FUNZIONI ESPORTATE (Rimangono invariate, ma applyFilter ora esegue la logica combinata) ---

export async function loadPlanesFromLocalStorage() {
    // ... (Logica di caricamento dati e creazione marker rimane invariata) ...
    const data = loadFromLocalStorage(KEY);
    
    if (!data || !data.states) {
        console.warn("Nessun dato OpenSky valido nel LocalStorage per l'aggiornamento mappa.");
        return;
    }

    const states = data.states;
    const seen = new Set();
    
    for (const state of states) {
        const icao24 = state[0];
        seen.add(icao24);
        updateOrCreatePlane(state); 
    }

    for (const key of Object.keys(planeMarkers)) {
        if (!seen.has(key)) {
            planesLayer.removeLayer(planeMarkers[key]);
            delete planeMarkers[key];
        }
    }
    
    applyFilter();
    console.log(`✅ Mappa aggiornata con ${states.length} aerei. Filtri regionale e altitudine applicati.`);
}

export function initializeMapAndUI() {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    getUIReferences();
    createRegionSelectorUI();
    setupEventListeners();
}