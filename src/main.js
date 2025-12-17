import './style.css';
import { startUpdateScheduler } from './dati_carica.js'; 
import { initializeMapAndUI, loadPlanesFromLocalStorage } from './map.js'; 

// Nuovo intervallo: 60 secondi (1 minuto) per l'aggiornamento della MAPPA dal LocalStorage
const MAP_RENDER_INTERVAL_MS = 60 * 1000; 

// Funzione principale che inizializza tutto
async function init() {
    console.log("Inizio inizializzazione applicazione...");
    
    initializeMapAndUI(); 

    // Avvia il loop Fetch -> PocketBase -> LocalStorage (ogni 70s)
    startUpdateScheduler(); 
    
    // Carica subito i dati appena fetchati (dopo il primo fetch del scheduler)
    await loadPlanesFromLocalStorage(); 
    
    // Avvia il loop di aggiornamento della Mappa dal LocalStorage (ogni 60s)
    setInterval(loadPlanesFromLocalStorage, MAP_RENDER_INTERVAL_MS); 
    
    console.log(`Aggiornamento mappa avviato ogni ${MAP_RENDER_INTERVAL_MS / 1000} secondi (lettura da LocalStorage).`);
}

init();