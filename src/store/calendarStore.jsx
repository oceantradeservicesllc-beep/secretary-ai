import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const Ctx = createContext(null)
const SUPA_URL = 'https://meqsodoybcsgpmmccwpe.supabase.co/rest/v1'
const SUPA_KEY = 'sb_publishable_-KsN5vI4j3YYkw14ursHuw_HC5H0j_O'
const H = { 'Content-Type':'application/json','apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}` }

const load = (k,fb) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb}catch{return fb} }
const save = (k,v)  => { try{localStorage.setItem(k,JSON.stringify(v))}catch{} }
const uid  = () => Math.random().toString(36).slice(2)+Date.now().toString(36)

async function dbGet(table, query='') {
  try {
    const r = await fetch(`${SUPA_URL}/${table}?order=created_at.desc${query}`,{headers:H})
    if(!r.ok) return []
    return r.json()
  } catch { return [] }
}
async function dbUpsert(table, data) {
  try {
    await fetch(`${SUPA_URL}/${table}`,{method:'POST',headers:{...H,'Prefer':'resolution=merge-duplicates'},body:JSON.stringify(Array.isArray(data)?data:[data])})
  } catch {}
}
async function dbDelete(table, id) {
  try { await fetch(`${SUPA_URL}/${table}?id=eq.${id}`,{method:'DELETE',headers:H}) } catch {}
}

export const CUSTODY_OPTIONS = [
  { k:'me',    label:'Me',       color:'#6C63FF' },
  { k:'laura', label:'Laura',    color:'#FF9F43' },
  { k:'both',  label:'Both',     color:'#45B7D1' },
  { k:'none',  label:'No kids',  color:'#55556A' },
]

export const EVENT_TYPES = [
  { k:'appointment', label:'Appointment', color:'#45B7D1' },
  { k:'task',        label:'Task',        color:'#6C63FF' },
  { k:'habit',       label:'Habit',       color:'#52C986' },
  { k:'custody',     label:'Custody',     color:'#FF9F43' },
  { k:'reminder',    label:'Reminder',    color:'#C984E0' },
]

function evToDB(e) {
  return {
    id:e.id, title:e.title, type:e.type||'appointment',
    event_date:e.date, event_time:e.time||null, end_time:e.endTime||null,
    custody:e.custody||null, habit_id:e.habitId||null, task_id:e.taskId||null,
    status:e.status||'scheduled', note:e.note||'', color:e.color||null,
    all_day:e.allDay!==false, recurring:e.recurring||null,
    created_at:e.createdAt||new Date().toISOString(),
    updated_at:new Date().toISOString(),
  }
}
function evFromDB(r) {
  return {
    id:r.id, title:r.title, type:r.type||'appointment',
    date:r.event_date, time:r.event_time||null, endTime:r.end_time||null,
    custody:r.custody||null, habitId:r.habit_id||null, taskId:r.task_id||null,
    status:r.status||'scheduled', note:r.note||'', color:r.color||null,
    allDay:r.all_day!==false, recurring:r.recurring||null,
    createdAt:r.created_at,
  }
}

export function CalendarProvider({ children }) {
  const [events,  setEvents]  = useState(()=>load('sai_cal_events',[]))
  const [syncing, setSyncing] = useState(false)

  useEffect(()=>{ save('sai_cal_events',events) },[events])
  useEffect(()=>{ syncFromCloud() },[]) // eslint-disable-line

  const syncFromCloud = useCallback(async()=>{
    setSyncing(true)
    try {
      const rows = await dbGet('calendar_events')
      if(rows.length) setEvents(rows.map(evFromDB))
    } catch {}
    setSyncing(false)
  },[])

  const addEvent = useCallback((data)=>{
    const ev = { id:uid(), ...data, status:data.status||'scheduled', createdAt:new Date().toISOString() }
    setEvents(prev=>[ev,...prev])
    dbUpsert('calendar_events',evToDB(ev))
    return ev
  },[])

  const updateEvent = useCallback((id, updates)=>{
    setEvents(prev=>prev.map(e=>{
      if(e.id!==id) return e
      const updated={...e,...updates}
      dbUpsert('calendar_events',evToDB(updated))
      return updated
    }))
  },[])

  const deleteEvent = useCallback((id)=>{
    setEvents(prev=>prev.filter(e=>e.id!==id))
    dbDelete('calendar_events',id)
  },[])

  const getEventsForDate = useCallback((date)=>{
    return events.filter(e=>e.date===date)
  },[events])

  const getEventsForMonth = useCallback((year, month)=>{
    const prefix=`${year}-${String(month+1).padStart(2,'0')}`
    return events.filter(e=>e.date?.startsWith(prefix))
  },[events])

  // Add habit scheduled events
  const scheduleHabitOnCalendar = useCallback((habit, date)=>{
    const existing = events.find(e=>e.habitId===habit.id&&e.date===date&&e.type==='habit')
    if(existing) return existing
    return addEvent({
      title:habit.name, type:'habit', date,
      habitId:habit.id, color:habit.type==='good'?'#52C986':'#FF5E5E',
      allDay:true, status:'scheduled',
    })
  },[events, addEvent])

  const confirmHabitEvent = useCallback((eventId, status)=>{
    updateEvent(eventId,{status})
  },[updateEvent])

  return (
    <Ctx.Provider value={{events,syncing,addEvent,updateEvent,deleteEvent,getEventsForDate,getEventsForMonth,scheduleHabitOnCalendar,confirmHabitEvent,syncFromCloud}}>
      {children}
    </Ctx.Provider>
  )
}

export const useCalendar = () => useContext(Ctx)
