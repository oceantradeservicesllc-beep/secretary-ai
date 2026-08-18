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
    await fetch(`${SUPA_URL}/${table}`,{method:'POST',headers:{...H,'Prefer':'resolution=merge-duplicates'},body:JSON.stringify(data)})
  } catch {}
}
async function dbDelete(table, id) {
  try { await fetch(`${SUPA_URL}/${table}?id=eq.${id}`,{method:'DELETE',headers:H}) } catch {}
}

export const HABIT_EMOJIS = ['⭐','💪','🏃','🧘','📚','💧','🥗','😴','🚭','🍺','🎯','✍️','🧹','💊','🧠','❤️','🌿','☀️','🎵','📵','🚶','🏋️','🛁','🥤','🍎','☕','🧘‍♂️','💤','🎨','🤸']
export const FREQ_OPTIONS = [
  {k:'daily',    label:'Every day'},
  {k:'every_x_days', label:'Every X days'},
  {k:'weekly',   label:'Every week'},
  {k:'every_x_weeks', label:'Every X weeks'},
  {k:'monthly',  label:'Every month'},
  {k:'every_x_months', label:'Every X months'},
]

function habitToDB(h) {
  return {
    id:h.id, name:h.name, description:h.description||'',
    type:h.type||'good', logo_emoji:h.logoEmoji||'⭐',
    frequency_type:h.frequencyType||'daily',
    frequency_value:h.frequencyValue||1,
    notify:h.notify||false, notify_time:h.notifyTime||'08:00',
    color:h.color||'#6C63FF', is_active:h.isActive!==false,
    created_at:h.createdAt, updated_at:new Date().toISOString(),
  }
}
function habitFromDB(r) {
  return {
    id:r.id, name:r.name, description:r.description||'',
    type:r.type||'good', logoEmoji:r.logo_emoji||'⭐',
    frequencyType:r.frequency_type||'daily',
    frequencyValue:r.frequency_value||1,
    notify:r.notify||false, notifyTime:r.notify_time||'08:00',
    color:r.color||'#6C63FF', isActive:r.is_active!==false,
    createdAt:r.created_at,
  }
}
function logToDB(l) {
  return { id:l.id, habit_id:l.habitId, log_date:l.date, status:l.status||'done', note:l.note||'', created_at:l.createdAt||new Date().toISOString() }
}
function logFromDB(r) {
  return { id:r.id, habitId:r.habit_id, date:r.log_date, status:r.status||'done', note:r.note||'', createdAt:r.created_at }
}

export function HabitProvider({ children }) {
  const [habits,  setHabits]  = useState(()=>load('sai_habits',[]))
  const [logs,    setLogs]    = useState(()=>load('sai_habit_logs',[]))
  const [syncing, setSyncing] = useState(false)

  useEffect(()=>{ save('sai_habits',habits) },[habits])
  useEffect(()=>{ save('sai_habit_logs',logs) },[logs])
  useEffect(()=>{ syncFromCloud() },[]) // eslint-disable-line

  const syncFromCloud = useCallback(async()=>{
    setSyncing(true)
    try {
      const [hRows, lRows] = await Promise.all([dbGet('habits'),dbGet('habit_logs')])
      if(hRows.length) setHabits(hRows.map(habitFromDB))
      if(lRows.length) setLogs(lRows.map(logFromDB))
    } catch {}
    setSyncing(false)
  },[])

  const addHabit = useCallback((data)=>{
    const h = { id:uid(), name:data.name, description:data.description||'', type:data.type||'good',
      logoEmoji:data.logoEmoji||'⭐', frequencyType:data.frequencyType||'daily',
      frequencyValue:data.frequencyValue||1, notify:data.notify||false,
      notifyTime:data.notifyTime||'08:00', color:data.color||'#6C63FF',
      isActive:true, createdAt:new Date().toISOString() }
    setHabits(prev=>[h,...prev])
    dbUpsert('habits',habitToDB(h))
    return h
  },[])

  const updateHabit = useCallback((id, updates)=>{
    setHabits(prev=>prev.map(h=>{
      if(h.id!==id) return h
      const updated={...h,...updates}
      dbUpsert('habits',habitToDB(updated))
      return updated
    }))
  },[])

  const deleteHabit = useCallback((id)=>{
    // Keep logs but mark habit as inactive (so calendar history preserved)
    setHabits(prev=>prev.map(h=>h.id===id?{...h,isActive:false,deletedAt:new Date().toISOString()}:h))
    dbUpsert('habits',{id,is_active:false,updated_at:new Date().toISOString()})
  },[])

  const logHabit = useCallback((habitId, date, status='done', note='')=>{
    // Prevent duplicate for same day
    const exists = logs.find(l=>l.habitId===habitId&&l.date===date)
    if(exists) {
      const updated = {...exists, status, note}
      setLogs(prev=>prev.map(l=>l.id===exists.id?updated:l))
      dbUpsert('habit_logs',logToDB(updated))
      return
    }
    const log = { id:uid(), habitId, date, status, note, createdAt:new Date().toISOString() }
    setLogs(prev=>[log,...prev])
    dbUpsert('habit_logs',logToDB(log))
  },[logs])

  const getLogForDate = useCallback((habitId, date)=>{
    return logs.find(l=>l.habitId===habitId&&l.date===date)||null
  },[logs])

  const getLogsForDateRange = useCallback((startDate, endDate)=>{
    return logs.filter(l=>l.date>=startDate&&l.date<=endDate)
  },[logs])

  // Stats for dashboard — last 7 days
  const getWeekStats = useCallback(()=>{
    const dates = []
    for(let i=6;i>=0;i--) {
      const d=new Date(); d.setDate(d.getDate()-i)
      dates.push(d.toISOString().split('T')[0])
    }
    const activeHabits = habits.filter(h=>h.isActive)
    const goodHabits = activeHabits.filter(h=>h.type==='good')
    const badHabits  = activeHabits.filter(h=>h.type==='bad')

    let goodDone=0, badDone=0
    dates.forEach(date=>{
      goodHabits.forEach(h=>{ if(logs.find(l=>l.habitId===h.id&&l.date===date&&l.status==='done')) goodDone++ })
      badHabits.forEach(h=>{  if(logs.find(l=>l.habitId===h.id&&l.date===date&&l.status==='done')) badDone++ })
    })
    return { goodDone, badDone, goodTotal:goodHabits.length*7, badTotal:badHabits.length*7, dates }
  },[habits,logs])

  // Check if habit is due on a given date
  const isDueOnDate = useCallback((habit, date)=>{
    const ft = habit.frequencyType
    const fv = habit.frequencyValue||1
    const d  = new Date(date)
    const created = new Date(habit.createdAt)
    const daysDiff = Math.floor((d-created)/86400000)
    if(ft==='daily')           return true
    if(ft==='every_x_days')    return daysDiff%fv===0
    if(ft==='weekly')          return d.getDay()===created.getDay()
    if(ft==='every_x_weeks')   return Math.floor(daysDiff/7)%fv===0
    if(ft==='monthly')         return d.getDate()===created.getDate()
    if(ft==='every_x_months')  return d.getDate()===created.getDate()&&(d.getMonth()-created.getMonth())%fv===0
    return false
  },[])

  return (
    <Ctx.Provider value={{habits,logs,syncing,addHabit,updateHabit,deleteHabit,logHabit,getLogForDate,getLogsForDateRange,getWeekStats,isDueOnDate,syncFromCloud}}>
      {children}
    </Ctx.Provider>
  )
}

export const useHabits = () => useContext(Ctx)
