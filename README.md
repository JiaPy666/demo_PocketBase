# ✈️ Demo Tracciamento Aereo (OpenSky Network + PocketBase)

Questo progetto è una demo di visualizzazione in tempo reale del traffico aereo utilizzando la libreria cartografica **Leaflet**, alimentata dai dati del servizio **OpenSky Network** e con sincronizzazione persistente su un backend **PocketBase**.

Il sistema è strutturato per recuperare i dati in background, salvarli localmente (LocalStorage) per l'accesso immediato della mappa, e sincronizzarli periodicamente con PocketBase.

## 🚀 Funzionalità Principali

* **Visualizzazione Mappa:** Tracciamento degli aeromobili su mappa Leaflet in tempo quasi reale.
* **Architettura a Loop:** Due loop di aggiornamento distinti (fetch dati + sync PocketBase / aggiornamento mappa) che lavorano in modo asincrono.
* **Filtro Regionale:** Selettore di regioni con immagini per restringere la visualizzazione (es. Italia, Europa, USA, etc.).
* **Filtro Altitudine:** Filtro per colorazione degli aerei in base alla quota di volo (Terra, Bassa, Alta).
* **Backend Persistente:** Uso di PocketBase per la persistenza e la gestione dei dati storici/sync.

## 🧱 Struttura del Progetto

Il progetto segue il principio della Separazione delle Preoccupazioni (SoC), con ciascun file dedicato a una logica specifica:

| File | Responsabilità |
| :--- | :--- |
| `index.html` | Struttura HTML e caricamento delle librerie (Leaflet) e degli script. Contiene i contenitori UI (`#map`, selettori filtri). |
| `style.css` | Stili per la mappa e tutti i componenti UI (selettori regione, filtri altitudine, icone aerei). |
| `main.js` | Punto di ingresso principale. Inizializza la mappa e avvia i due scheduler di aggiornamento. |
| `map.js` | **Logica Mappa.** Gestisce l'inizializzazione di Leaflet, la creazione/aggiornamento/rimozione dei marker, e l'applicazione dei filtri (Regione e Altitudine). |
| `data_fetcher.js` | Gestisce l'interazione con l'API OpenSky Network e il salvataggio dei dati grezzi in LocalStorage. |
| `localstorage.js` | Funzioni wrapper per l'I/O (Input/Output) da e verso il `window.localStorage`. |
| `pocketbase.js` | Inizializzazione della connessione PocketBase e gestione dell'autenticazione Admin. |
| `dati_carica.js` | **Logica Backend/Sync.** Gestisce la creazione della collezione e il loop di sincronizzazione dati da LocalStorage a PocketBase. |

## ⚙️ Setup e Avvio

### 1. Prerequisiti

È necessario avere un'istanza di PocketBase in esecuzione:

1.  **Avviare PocketBase:** Eseguire l'eseguibile di PocketBase (es. `pocketbase.exe serve`). Di default, dovrebbe essere disponibile su `http://127.0.0.1:8090`.
2.  **Configurare l'Admin:** Assicurarsi che le credenziali in `pocketbase.js` (`admin@admin.it`, `admin12345`) corrispondano a un utente Admin esistente nella tua istanza PocketBase.

### 2. Esecuzione del Frontend

Poiché il progetto è scritto in JavaScript modulare (`import/export`), è consigliato lanciare il progetto tramite un server di sviluppo locale (ad esempio, con [Vite](https://vitejs.dev/) se stai usando quella configurazione, o semplicemente con un live server di VS Code).

Il tuo file `main.js` è configurato per avviare i processi in automatico:

1.  **Inizializzazione Mappa:** La UI viene disegnata immediatamente.
2.  **Scheduler Sincronizzazione:** Avviato un loop (ogni 70 secondi) per:
    * `fetchAndStoreData()`: Scaricare i dati OpenSky e salvarli in LocalStorage.
    * `DataFromStorageToPocketBase()`: Leggere i dati da LocalStorage e fare l'UPSERT (aggiornamento/inserimento) su PocketBase.
3.  **Aggiornamento Mappa:** Avviato un secondo loop (ogni 70 secondi) che chiama `loadPlanesFromLocalStorage()` per aggiornare i marker sulla mappa utilizzando i dati freschi disponibili in LocalStorage.

## ⚠️ Punti Chiave e Debug

* **Dati Non Visualizzati:** Se gli aerei non compaiono, la causa più comune è un fallimento nel `fetch` dei dati da OpenSky (verificare i log della console da `data_fetcher.js`) o un errore nella funzione `applyFilter` (ora corretta per usare `lng` anziché `lon`).
* **Sincronizzazione PocketBase:** La collezione `opensky_states` viene creata automaticamente al primo avvio se non esiste. Controllare la console per gli eventuali errori di autenticazione in `pocketbase.js`.
* **Filtri Combinati:** Ricorda che la mappa applica **entrambi** i filtri contemporaneamente: solo gli aerei che sono **sia** all'interno dei limiti della Regione selezionata **sia** all'interno della Categoria di Altitudine selezionata (`activeFilter`) saranno visualizzati.