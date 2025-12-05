import './style.css';
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

// Recupera i dati dal localStorage e li sincronizza con PocketBase (UPSERT).
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
        const icao24 = state[0];
        const callsign = state[1] ? state[1].trim() : "N/A"; 
        const originCountry = state[2];
        const longitude = state[5]; 
        const latitude = state[6];  
        const baroAltitude = state[13]; 
        const velocity = state[9];
        const heading = state[10];
        
        // Controllo essenziale: se mancano ICAO24 o la posizione, saltiamo il record.
        if (!icao24 || longitude === null || latitude === null) {
            continue; 
        }

        // Costruzione del payload per PocketBase
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

// Creazione/Verifica dello fields e inizializzazione
async function createCollection() {
    // IL FETCH SALVA I DATI NELLO STORAGE
    const dataStored = await fetchAndStoreData();
    if (!dataStored) {
        console.warn("Impossibile procedere senza dati freschi in localStorage.");
        return;
    }

    // AUTENTIFICAZIONE ADMIN
    const autentifica = await autentificazione();
    if (!autentifica) {
        return;
    }

    // CREAZIONE/AGGIORNAMENTO DELLA COLLEZIONE
    try {
        const existingCollection = await pb.collections.getOne(collectionName);
        console.log(`\nCollezione '${collectionName}' ESISTE già. Verifico lo schema...`);
        
        // Aggiorna lo schema con i nuovi attributi 
        await pb.collections.update(existingCollection.id, {
            fields: attributi
        });
        console.log(`✅ Schema di '${collectionName}' aggiornato/verificato con successo.`);

    } catch (e) {
        if (e.status === 404) {
            console.log(`\nCollezione '${collectionName}' non trovata. Creazione...`);
            await pb.collections.create({
                name: collectionName,
                type: 'base',
                fields: attributi
            });
            console.log(`✅ Collezione '${collectionName}' creata con successo!`);
        } else {
            console.error("ERRORE CRITICO durante la gestione della collezione:", e.message);
            return;
        }
    }
    
    await DataFromStorageToPocketBase();
}

createCollection();