import { saveToLocalStorage } from './localstorage.js';

const URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
const KEY = 'terremoto'; 

export async function fetchAndStoreData() {
    console.log("Inizio recupero dati.");
    try {
        const response = await fetch(URL);
        if (!response.ok) {
            console.error(`Errore HTTP durante il fetch: ${response.status}`);
            return false;
        }
        
        const data = await response.json();
        if (!data || !data.features) {
            console.warn("Dati GeoJSON non validi o mancanti (features).");
            return false;
        }
        
        // Salva i dati
        saveToLocalStorage(KEY, data);
        console.log(`✅ Dati USGS (${data.features.length} eventi) salvati nel localStorage.`);
        return true;

    } catch (error) {
        console.error("ERRORE di rete o parsing durante il fetch USGS:", error);
        return false;
    }
}

export { KEY };