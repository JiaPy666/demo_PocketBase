import { saveToLocalStorage } from './localstorage.js';

// URL aggiornato a OpenSky Network
const URL = 'https://opensky-network.org/api/states/all';
// Non serve più la KEY qui se non si salva direttamente
// const KEY = 'opensky'; 

export async function fetchOpenSkyData() {
    console.log("Inizio recupero dati OpenSky.");
    try {
        const response = await fetch(URL);
        if (!response.ok) {
            console.error(`Errore HTTP durante il fetch: ${response.status}`);
            return null; // Ritorna null in caso di errore
        }
        
        const data = await response.json();
        // Ritorna l'oggetto dati completo
        if (!data || !data.states || data.states.length === 0) {
            console.warn("Dati OpenSky non validi o stati aeromobili mancanti.");
            return null;
        }
        
        console.log(`✅ Dati OpenSky (${data.states.length} aeromobili) recuperati.`);
        return data; // Ritorna l'oggetto dati
        

    } catch (error) {
        console.error("ERRORE di rete o parsing durante il fetch OpenSky:", error);
        return null;
    }
}

// Rimuovere l'esportazione di KEY da qui, spostata in dati_carica.js o localstorage.js se necessario.
// La tengo in map.js per retrocompatibilità.
// export { KEY };