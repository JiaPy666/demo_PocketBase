import './style.css'
import pb from './pocketbase.js'

// --- Configurazione ---
const collectionName = 'flight_data' // Nome della collezione
const FLIGHT_API_URL = `https://opensky-network.org/api/states/all`

// --- 1. Autenticazione ---
// Assumendo che questa parte sia corretta e funzioni
try {
    const authData = await pb.collection("_superusers").authWithPassword('admin@admin.it', 'admin12345');
    console.log(`Autenticazione valida: ${pb.authStore.isValid}`);
    console.log(`ID Utente: ${pb.authStore.record.id}`);
} catch (error) {
    console.error("❌ Errore di autenticazione:", error);
    // Interrompi l'esecuzione se l'autenticazione fallisce
    throw new Error("Impossibile autenticarsi. Controlla le credenziali o lo stato del server PocketBase.");
}


// --- 2. Gestione e Creazione della Collezione (Lasciamo intatto) ---
// ... (le funzioni createFlightCollection e verifyAndCreateCollection sono qui)

async function createFlightCollection() {
    console.log(`Tentativo di creazione della collezione '${collectionName}'...`);
    await pb.collections.create({
        name: collectionName,
        type: 'base',
        schema: [
            {
                name: 'icao24', 
                type: 'text',
                required: true,
                unique: true,
                options: {
                    max: 6 
                }
            },
            {
                name: 'latitude', 
                type: 'number',
                options: {
                    min: -90,
                    max: 90
                }
            },
            {
                name: 'longitude', 
                type: 'number',
                options: {
                    min: -180,
                    max: 180
                }
            },
            {
                name: 'callsign', 
                type: 'text',
            }
        ],
    });
}

async function verifyAndCreateCollection() {
    try {
        // Tenta di leggere la collezione
        const collection = await pb.collections.getOne(collectionName); 
        
        console.log(`✅ Successo: La collezione '${collectionName}' esiste già.`);
        
        // CORREZIONE: Verifichiamo che 'schema' esista prima di chiamare .map()
        if (collection && Array.isArray(collection.schema)) {
            const fieldNames = collection.schema.map(f => f.name);
            console.log(`Schema corrente della collezione (Campi trovati: ${fieldNames.length}):`, fieldNames);
        } else {
            console.warn("⚠️ Attenzione: La proprietà 'schema' non è presente o non è un array.");
        }
        
        return true;

    } catch (error) {
        if (error.status === 404) {
            // Se non trova (404), la crea
            console.log(`⚠️ Attenzione: La collezione '${collectionName}' non è stata trovata. Procedo alla creazione...`);
            await createFlightCollection(); 
            console.log(`✅ Successo: Collezione '${collectionName}' creata con successo!`);
            return true;
        } else {
            // Gestisce altri errori 
            console.error("❌ Errore critico durante il controllo dell'esistenza:", error);
            return false;
        }
    }
}


// --- 3. 🆕 NUOVA LOGICA: Caricamento dei Dati ---

async function fetchAndInsertFlightData() {
    console.log("Inizio del recupero dei dati di volo...");

    try {
        // a) Recupera i dati dall'API esterna
        const response = await fetch(FLIGHT_API_URL);
        if (!response.ok) {
            throw new Error(`Errore HTTP! Status: ${response.status}`);
        }
        const flightData = await response.json(); // Assumi che ritorni un JSON

        // Assumi che i dati di volo siano in un array nella chiave 'flights'
        const flights = flightData.flights || flightData; 

        if (flights.length === 0) {
            console.log("Nessun dato di volo da inserire.");
            return;
        }

        console.log(`Trovati ${flights.length} voli da inserire.`);
        
        let insertedCount = 0;

        // b) Inserisce ogni record in PocketBase
        for (const flight of flights) {
            // Assicurati che i campi corrispondano allo schema della tua collezione
            const dataToInsert = {
                icao24: flight.icao24,
                latitude: flight.latitude,
                longitude: flight.longitude,
                callsign: flight.callsign || '', // Usa una stringa vuota se callsign è assente
            };

            try {
                // Tenta di creare un nuovo record
                await pb.collection(collectionName).create(dataToInsert);
                insertedCount++;
            } catch (insertError) {
                // Ignora errori di record duplicato (se hai impostato icao24 come 'unique')
                if (insertError.data.data.icao24 && insertError.data.data.icao24.code === 'notUnique') {
                    // Potresti voler aggiornare il record esistente qui invece di ignorarlo
                    // Per semplicità, in questo esempio ignoriamo i duplicati
                    // console.log(`Skipped duplicate: ${flight.icao24}`);
                } else {
                    console.error(`❌ Errore durante l'inserimento del volo ${flight.icao24}:`, insertError);
                }
            }
        }
        
        console.log(`✅ Caricamento completato. Inseriti ${insertedCount} nuovi record.`);

    } catch (error) {
        console.error("❌ Errore durante il recupero o l'inserimento dei dati di volo:", error);
    }
}


// --- 4. 🚀 Esecuzione Principale Aggiornata ---

async function initializeDataLoad() {
    const isCollectionReady = await verifyAndCreateCollection();
    
    if (isCollectionReady) {
        await fetchAndInsertFlightData();
    } else {
        console.log("Non è possibile caricare i dati perché la collezione non è stata creata con successo.");
    }
}

// Avvia l'intera sequenza: verifica/creazione e poi caricamento dati
initializeDataLoad();