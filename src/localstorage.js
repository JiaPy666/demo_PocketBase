export const loadFromLocalStorage = (key) => {
    const local = localStorage.getItem(key);
    if (!local) return null;
    try {
        return JSON.parse(local);
    } catch (e) {
        console.error(`Errore nel parsing JSON per la chiave ${key}:`, e);
        return null;
    }
}

export const saveToLocalStorage = (key, data) => {
    const dataAsJson = JSON.stringify(data);
    localStorage.setItem(key, dataAsJson);
}