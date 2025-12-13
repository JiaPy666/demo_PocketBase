import './style.css';
// Logica PocketBase/Sync: Avvia il loop (Fetch -> LocalStorage -> PocketBase)
import { startUpdateScheduler } from './dati_carica.js'; 
// Logica Mappa: Inizializza UI e visualizza i dati DA LOCALSTORAGE
import { initializeMapAndUI, loadPlanesFromLocalStorage } from './map.js'; 

// Intervalli: Allineati a 70 secondi come richiesto.
const MAP_UPDATE_INTERVAL_MS = 70 * 1000;

// Funzione principale che inizializza tutto
async function init() {
    console.log("Inizio inizializzazione applicazione...");
    
    // 1. Inizializza Mappa e UI (deve essere fatto per primo)
    initializeMapAndUI(); 

    // 2. Avvia lo scheduler di aggiornamento dati (fetch, save, sync). 
    // Include la prima esecuzione.
    startUpdateScheduler(); 
    
    // 3. Esegue il primo caricamento degli aerei sulla mappa da LocalStorage.
    await loadPlanesFromLocalStorage(); 
    
    // 4. Avvia il loop di aggiornamento della mappa (ogni 70s)
    // Aggiorna la mappa prelevando i dati freschi salvati nello Storage dal loop di sincronizzazione.
    setInterval(loadPlanesFromLocalStorage, MAP_UPDATE_INTERVAL_MS); 
    
    console.log("Applicazione inizializzata. Due loop attivi: Dati/Sync e Mappa/Visualizzazione.");
}

init();