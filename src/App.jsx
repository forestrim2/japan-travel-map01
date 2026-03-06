import React,{useState} from "react"
import MapView from "./components/MapView"
import PinModal from "./components/PinModal"
import useLocalPins from "./hooks/useLocalPins"

const LS_KEY="travel_map_pins_v5"

export default function App(){

 const {pins,add,update,remove}=useLocalPins(LS_KEY)
 const [selected,setSelected]=useState(null)

 return (
  <div className="app">

   <MapView
    pins={pins}
    onAddPin={add}
    onSelectPin={setSelected}
   />

   {selected && (
    <PinModal
     pin={selected}
     onClose={()=>setSelected(null)}
     onSave={(p)=>{
      update(p)
      setSelected(p)
     }}
     onDelete={(id)=>{
      if(confirm("정말 삭제하시겠습니까?")){
       remove(id)
       setSelected(null)
      }
     }}
    />
   )}

  </div>
 )
}