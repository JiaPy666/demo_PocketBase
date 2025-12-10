// main.js

import './style.css';
import { createCollection } from './dati_carica.js';
import { initializeMap, loadPlanesFromPocketBase } from './map.js';

// Inizializza l'intera applicazione
async function init() {
    initializeMap(); 


    await createCollection(); 
    
    await loadPlanesFromPocketBase(); 
}

init();