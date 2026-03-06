import React, { useState } from "react"
import MapView from "./components/MapView"

const LS_KEY = "travel_pin_map_v4"

export default function App(){

  const [pins,setPins] = useState(()=>{
    try{
      const saved = localStorage.getItem(LS_KEY)
      return saved ? JSON.parse(saved) : []
    }catch{
      return []
    }
  })

  function save(next){
    setPins(next)
    localStorage.setItem(LS_KEY,JSON.stringify(next))
  }

  function addPin(pin){
    save([...pins,pin])
  }

  function updatePin(updated){
    const next = pins.map(p=>p.id===updated.id?updated:p)
    save(next)
  }

  return (
    <div className="app">
      <MapView
        pins={pins}
        onAddPin={addPin}
        onUpdatePin={updatePin}
      />
    </div>
  )
}