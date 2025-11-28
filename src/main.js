import './style.css'
import pb from './pocketbase.js'

//const authData = await pb.collection("users").authWithPassword('userFlightRadar@user.com', 'Fly12345');
const authData = await pb.collection("_superusers").authWithPassword('admin@admin.it', 'admin12345');

const nomeDB = 'exampleBase'

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);


async function field() {
    await pb.collections.create({
        name: nomeDB,
        type: 'base',
        fields: [
            field('titolo', 'text'),
            field('stato', 'bool')
        ],
    });
}

async function verificaCreazione() {
    try {
        await pb.collections.getOne(nomeDB); 
        console.log(`La collezione '${nomeDB}' esiste già. Nessuna nuova creazione.`);
    } catch (error) {
        if (error.status === 404) {
            console.log(`La collezione '${nomeDB}' non è stata trovata. Procedo alla creazione...`);
            field()
            console.log(`Collezione '${nomeDB}' creata con successo!`);
        } else {
            console.error("Errore imprevisto durante il controllo dell'esistenza:", error);
        }
    }
}

fetch("https://opensky-network.org/api/states/all")
  .then(r =>r.json())
  .then(body => {
    const aeri = body.features
    for(const aereo of aeri){
        
        const lat = aereo.status[6]
        const lng = aereo.status[5]
    };
  })

verificaCreazione()