import React,{useState,useEffect} from "react"

export default function PinModal({pin,onClose,onSave,onDelete}){

 const [edit,setEdit] = useState(false)
 const [name,setName] = useState("")
 const [memo,setMemo] = useState("")

 useEffect(()=>{
  setName(pin.name||"")
  setMemo(pin.memo||"")
 },[pin])

 function save(){
  onSave({...pin,name,memo})
  setEdit(false)
 }

 return (
  <div className="modalOverlay">

   <div className="modal">

    {!edit && (
     <>
      <h3>{name||"이름 없음"}</h3>
      <p>{memo||"메모 없음"}</p>

      <div className="btnRow">
       <button onClick={()=>setEdit(true)}>수정</button>
       <button onClick={()=>onDelete(pin.id)}>삭제</button>
       <button onClick={onClose}>닫기</button>
      </div>
     </>
    )}

    {edit && (
     <>
      <input
       value={name}
       onChange={e=>setName(e.target.value)}
       placeholder="장소 이름"
      />

      <textarea
       value={memo}
       onChange={e=>setMemo(e.target.value)}
       placeholder="메모"
      />

      <div className="btnRow">
       <button onClick={save}>저장</button>
       <button onClick={()=>setEdit(false)}>취소</button>
      </div>
     </>
    )}

   </div>

  </div>
 )
}