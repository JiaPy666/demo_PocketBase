import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const ADMIN_EMAIL = 'admin@admin.it'; 
const ADMIN_PASSWORD = 'admin12345'; 

export async function autentificazione() {
    console.log("Tentativo di login Admin dal pocketbase.js...");
    try {
        // Usa authWithPassword per ottenere il token e salvarlo nell'authStore
        await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log("Autenticazione Admin riuscita.");
        return true;
    } catch (error) {
        console.error("ERRORE CRITICO: Impossibile autenticarsi. Verifica credenziali e server.", error);
        return false;
    }
}

export default pb;