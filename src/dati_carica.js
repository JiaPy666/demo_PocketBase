// dati_carica.js
import pb, { autentificazione } from './pocketbase.js'; 
import { fetchAndStoreData, KEY } from './data_fetcher.js';
import { loadFromLocalStorage } from './localstorage.js';

const collectionName = 'opensky_states'; 

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

// Recupera i dati dal localStorage e li sincronizza con PocketBase (UPSERT)
async function DataFromStorageToPocketBase() {
    const data = loadFromLocalStorage(KEY);
    if (!data || !data.states) {
        console.log("Nessun dato valido di aeromobili da sincronizzare trovato in localStorage.");
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
    console.log(`\n✅ Sincronizzazione dati completata! Record processati: ${upsertedCount}`);
}

// Creazione/Verifica dello schema e avvio sync
export async function createCollection() {
    // 1. IL FETCH SALVA I DATI NELLO STORAGE
    const dataStored = await fetchAndStoreData();
    if (!dataStored) {
        return;
    }

    // 2. AUTENTIFICAZIONE ADMIN
    const autentifica = await autentificazione();
    if (!autentifica) {
        return;
    }

    // 3. CREAZIONE/AGGIORNAMENTO DELLA COLLEZIONE (Omissis per brevità)
    try {
        const existingCollection = await pb.collections.getOne(collectionName);
        console.log(`\nCollezione '${collectionName}' ESISTE già. Aggiorno lo schema.`);
        await pb.collections.update(existingCollection.id, { fields: attributi });
    } catch (e) {
        if (e.status === 404) {
            console.log(`\nCollezione '${collectionName}' non trovata. Creazione...`);
            await pb.collections.create({ name: collectionName, type: 'base', fields: attributi });
        } else {
            console.error("ERRORE CRITICO gestione collezione:", e.message);
            return;
        }
    }
    
    // 4. Esegue la sincronizzazione
    await DataFromStorageToPocketBase();
}

// NUOVA FUNZIONE: Avvia il loop di aggiornamento e sincronizzazione (Fetch -> LocalStorage -> PocketBase)
const UPDATE_INTERVAL_MS = 70 * 1000; 

export function startUpdateScheduler() {
    console.log(`Avvio scheduler: aggiornamento dati OpenSky e sync PocketBase ogni ${UPDATE_INTERVAL_MS / 1000} secondi.`);
    
    // Esegui la sincronizzazione iniziale e avvia il loop
    // createCollection() include fetchAndStoreData()
    // createCollection(); // rimosso da qui e lasciato in main.js come primo avvio
    
    setInterval(createCollection, UPDATE_INTERVAL_MS);
}