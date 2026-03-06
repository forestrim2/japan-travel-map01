import { useState } from "react"

export default function usePins(key){

 const [pins,setPins] = useState(()=>{
  try{
   const saved = localStorage.getItem(key)
   return saved ? JSON.parse(saved) : []
  }catch{
   return []
  }
 })

 function save(next){
  setPins(next)
  localStorage.setItem(key, JSON.stringify(next))
 }

 function add(pin){
  setPins(prev=>{
   const next=[...prev,pin]
   localStorage.setItem(key,JSON.stringify(next))
   return next
  })
 }

 function update(pin){
  setPins(prev=>{
   const next=prev.map(p=>p.id===pin.id?pin:p)
   localStorage.setItem(key,JSON.stringify(next))
   return next
  })
 }

 function remove(id){
  setPins(prev=>{
   const next=prev.filter(p=>p.id!==id)
   localStorage.setItem(key,JSON.stringify(next))
   return next
  })
 }

 return {pins, add, update, remove}
}
