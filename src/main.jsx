import React from "react"
import ReactDOM from "react-dom/client"
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "./styles.css"

const pins = []

function AddPin(){
  useMapEvents({
    click(e){
      pins.push(e.latlng)
      window.location.reload()
    }
  })
  return null
}

function App(){
  return (
    <MapContainer
      className="map"
      center={[35.681236,139.767125]}
      zoom={5}
      minZoom={5}
      maxBounds={[
        [30,120],
        [46,150]
      ]}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      <AddPin/>

      {pins.map((p,i)=>(
        <Marker key={i} position={p}>
          <Popup>Pin</Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>)