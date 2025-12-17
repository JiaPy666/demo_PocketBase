// dati_carica.js
import pb, { autentificazione } from './pocketbase.js'; 
import { fetchOpenSkyData } from './data_fetcher.js'; // Importa la nuova funzione
import { saveToLocalStorage } from './localstorage.js'; // Importa per salvare i dati

const collectionName = 'opensky_states'; 
const KEY = 'opensky'; // La chiave per LocalStorage viene gestita qui

const attributi = [
    { name: 'icao24', type: 'text', required: true, unique: true }, 
    { name: 'callsign', type: 'text' }, 
    { name: 'origin_country', type: 'text' },
    { name: 'latitudine', type: 'number' },
    { name: 'longitudine', type: 'number' },
    { name: 'altitudine_baro', type: 'number' }, 
    { name: 'velocita', type: 'number' },
    { name: 'rotta', type: 'number' } 
];

// NUOVA FUNZIONE: Prende i dati fetchati, li salva su PB e poi in LocalStorage
async function syncDataToPocketBaseAndStorage(data) {
    if (!data || !data.states) {
        console.log("Nessun dato valido di aeromobili da sincronizzare.");
        return;
    }

    const states = data.states;
    let upsertedCount = 0;
    console.log(`\nInizio sincronizzazione di ${states.length} vettori di stato su PocketBase...`);

    for (const state of states) {
        // Mappatura dati (come da standard OpenSky)
        const icao24 = state[0];
        const callsign = state[1] ? state[1].trim() : "N/A"; 
        const originCountry = state[2];
        const longitude = state[5]; 
        const latitude = state[6];  
        const baroAltitude = state[7]; 
        const velocity = state[9];
        const heading = state[10];
        
        if (!icao24 || longitude === null || latitude === null) {
            continue; 
        }

        const payload = {
            icao24: icao24,
            callsign: callsign,
            origin_country: originCountry,
            latitudine: latitude,
            longitudine: longitude,
            altitudine_baro: baroAltitude,
            velocita: velocity,
            rotta: heading,
        };

        try {
            // Logica UPSERT (Update or Insert)
            const esisteRecord = await pb.collection(collectionName).getFirstListItem(`icao24="${icao24}"`);
            await pb.collection(collectionName).update(esisteRecord.id, payload);
        } catch (e) {
            if (e.status === 404) {
                await pb.collection(collectionName).create(payload);
            } else {
                console.error(`Errore durante l'UPSERT per ${icao24}:`, e.message);
            }
        }
        upsertedCount++;
    }
    console.log(`\n✅ Sincronizzazione dati su PocketBase completata! Record processati: ${upsertedCount}`);
    
    // SALVATAGGIO DEI DATI ANCHE NEL LOCALSTORAGE
    saveToLocalStorage(KEY, data);
    console.log(`✅ Dati OpenSky (${states.length} aeromobili) salvati nel localStorage.`);
}


// Creazione/Verifica dello schema e avvio sync
export async function fetchSyncAndStoreData() {
    // 1. FETCH E RECUPERO DEI DATI
    const data = await fetchOpenSkyData();
    if (!data) {
        return false;
    }
    
    // 2. AUTENTIFICAZIONE ADMIN
    const autentifica = await autentificazione();
    if (!autentifica) {
        return false;
    }

    // 3. CREAZIONE/AGGIORNAMENTO DELLA COLLEZIONE
    try {
        const existingCollection = await pb.collections.getOne(collectionName);
        // console.log(`\nCollezione '${collectionName}' ESISTE già. Aggiorno lo schema.`);
        await pb.collections.update(existingCollection.id, { fields: attributi });
    } catch (e) {
        if (e.status === 404) {
            // console.log(`\nCollezione '${collectionName}' non trovata. Creazione...`);
            await pb.collections.create({ name: collectionName, type: 'base', fields: attributi });
        } else {
            console.error("ERRORE CRITICO gestione collezione:", e.message);
            return false;
        }
    }
    
    // 4. Esegue la sincronizzazione su PB e il salvataggio su LocalStorage
    await syncDataToPocketBaseAndStorage(data);
    return true;
}

// FUNZIONE SCHEDULER: Esegue il ciclo completo
const UPDATE_INTERVAL_MS = 70 * 1000; 

export function startUpdateScheduler() {
    console.log(`Avvio scheduler: aggiornamento dati OpenSky, sync PocketBase e LocalStorage ogni ${UPDATE_INTERVAL_MS / 1000} secondi.`);
    // Eseguo subito il primo ciclo e poi lo schedulo
    fetchSyncAndStoreData(); 
    setInterval(fetchSyncAndStoreData, UPDATE_INTERVAL_MS);
}

// Esporta la KEY qui per gli altri moduli
export { KEY };