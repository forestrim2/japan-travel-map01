import React, { useState } from "react"
import MapView from "./components/MapView"

const LS_KEY = "travel_pin_map_v3"

export default function App(){

  const [pins,setPins] = useState(()=>{
    try{
      const saved = localStorage.getItem(LS_KEY)
      return saved ? JSON.parse(saved) : []
    }catch{
      return []
    }
  })

  function addPin(pin){
    const next=[...pins,pin]
    setPins(next)
    localStorage.setItem(LS_KEY,JSON.stringify(next))
  }

  return (
    <div className="app">
      <MapView pins={pins} onAddPin={addPin} />
    </div>
  )
}