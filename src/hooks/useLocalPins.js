import { useState } from "react"

export default function useLocalPins(key){

 const [pins,setPins]=useState(()=>{
  try{
   const saved=localStorage.getItem(key)
   return saved?JSON.parse(saved):[]
  }catch{
   return []
  }
 })

 function save(next){
  setPins(next)
  localStorage.setItem(key,JSON.stringify(next))
 }

 function add(pin){
  save([...pins,pin])
 }

 function update(pin){
  save(pins.map(p=>p.id===pin.id?pin:p))
 }

 function remove(id){
  save(pins.filter(p=>p.id!==id))
 }

 return {pins,add,update,remove}
}