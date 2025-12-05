import { saveToLocalStorage } from './localstorage.js';

// URL aggiornato a OpenSky Network
const URL = 'https://opensky-network.org/api/states/all';
const KEY = 'opensky'; 

export async function fetchAndStoreData() {
    console.log("Inizio recupero dati OpenSky.");
    try {
        const response = await fetch(URL);
        if (!response.ok) {
            console.error(`Errore HTTP durante il fetch: ${response.status}`);
            return false;
        }
        
        const data = await response.json();
        // I dati OpenSky contengono l'array 'states'
        if (!data || !data.states || data.states.length === 0) {
            console.warn("Dati OpenSky non validi o stati aeromobili mancanti.");
            return false;
        }
        
        // Salva l'oggetto dati completo
        saveToLocalStorage(KEY, data);
        console.log(`✅ Dati OpenSky (${data.states.length} aeromobili) salvati nel localStorage.`);
        return true;

    } catch (error) {
        console.error("ERRORE di rete o parsing durante il fetch OpenSky:", error);
        return false;
    }
}

export { KEY };