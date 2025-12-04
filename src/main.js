import './style.css';
import pb, { autentificazione } from './pocketbase.js'; 
import { fetchAndStoreData, KEY } from './data_fetcher.js';
import { loadFromLocalStorage } from './localstorage.js';

const collectionName = 'earthquakes';

// Definisce la struttura della tabella per gli eventi sismici USGS
const attributi = [
    { name: 'usgs_id', type: 'text', required: true, unique: true },
    { name: 'magnitude', type: 'number', required: true },
    { name: 'place', type: 'text' },
    { name: 'time_event', type: 'date' },
    { name: 'tsunami', type: 'bool', default: false },
    { name: 'alert', type: 'text' },
    { name: 'url', type: 'url' },
    { name: 'latitude', type: 'number', required: true },
    { name: 'longitude', type: 'number', required: true },
    { name: 'depth', type: 'number' }
];

// Funzione di utilità per convertire il timestamp (ms) in formato ISO 8601
function convertTimestamp(ms) {
    if (!ms) return null;
    return new Date(ms).toISOString();
}

// Recupera i dati dal localStorage e li sincronizza con PocketBase (UPSERT).
async function DataFromStorageToPocketBase() {
    const data = loadFromLocalStorage(KEY);
    if (!data || !data.features) {
        console.log("Nessun dato valido da sincronizzare trovato in localStorage.");
        return;
    }

    const features = data.features;
    let upsertedCount = 0;
    console.log(`\nInizio sincronizzazione di ${features.length} eventi sismici su PocketBase...`);

    for (const feature of features) {
        const { id, properties, geometry } = feature;
        const [longitude, latitude, depth] = geometry.coordinates;
        const payload = {
            usgs_id: id,
            magnitude: properties.mag,
            place: properties.place,
            time_event: convertTimestamp(properties.time), 
            tsunami: properties.tsunami === 1 ? true : false,
            alert: properties.alert,
            url: properties.url,
            latitude: latitude,
            longitude: longitude,
            depth: depth,
        };

        try {
            const esisteRecord = await pb.collection(collectionName).getFirstListItem(`usgs_id="${id}"`);
            await pb.collection(collectionName).update(esisteRecord.id, payload);
        } catch (e) {
            if (e.status === 404) {
                await pb.collection(collectionName).create(payload);
            } else {
                console.error(`Errore durante l'UPSERT per ${id}:`, e.message);
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