import './style.css'
import pb from './pocketbase.js'

// Definire mappa
const map = L.map('map').setView([45.4297, 10.1107], 3);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);


fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson")
  .then(r =>r.json())
  .then(body => {
    const terremoti = body.features
    for (const terremoto of terremoti){
      const time = terremoto.properties.time
      const lat = terremoto.geometry.coordinates[1]
      const lng = terremoto.geometry.coordinates[0]
      const mag = terremoto.properties.mag
    }
  })