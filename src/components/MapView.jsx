import React from "react"
import {MapContainer,TileLayer,Marker,useMapEvents} from "react-leaflet"
import L from "leaflet"

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
 iconRetinaUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
 iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
 shadowUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
})

function AddPinHandler({onAddPin}){

 useMapEvents({
  click(e){
   const pin={
    id:Date.now(),
    name:"새 장소",
    memo:"",
    lat:e.latlng.lat,
    lng:e.latlng.lng
   }
   onAddPin(pin)
  }
 })

 return null
}

export default function MapView({pins,onAddPin,onSelectPin}){

 return (
  <MapContainer
   center={[35.6804,139.769]}
   zoom={5}
   style={{height:"100%",width:"100%"}}
  >

   <TileLayer
    attribution="&copy; OpenStreetMap"
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
   />

   <AddPinHandler onAddPin={onAddPin}/>

   {pins.map(p=>(
    <Marker
     key={p.id}
     position={[p.lat,p.lng]}
     eventHandlers={{click:()=>onSelectPin(p)}}
    />
   ))}

  </MapContainer>
 )
}