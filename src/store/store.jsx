import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { uid, makeSamples, isOverdue, isOld7, CATEGORIES } from '../utils/helpers.js'

const Ctx = createContext(null)
const load = (k,fb) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fb } catch { return fb } }
const save = (k,v)  => { try { localStorage.setItem(k,JSON.stringify(v)) } catch {} }

const URL = 'https://pojhfovzxcjjyrbdyqyc.supabase.co/rest/v1'
const KEY = 'sb_publishable_Os81VZl31s-E1PlNoSSIYA_ZEPoCs3k'
const H = { 'Content-Type':'application/json', 'apikey':KEY, 'Authorization':`Bearer ${KEY}` }

async function dbGet(table) {
  const r = await fetch(`${URL}/${table}?order=created_at.desc`, { headers:H })
  if (!r.ok) throw new Error(`fetch ${table} failed`)
  return r.json()
}
async function dbUpsert(table, data) {
  await fetch(`${URL}/${table}`, {
    method:'POST',
    headers:{ ...H, 'Prefer':'resolution=merge-duplicates' },
    body:JSON.stringify(data),
  })
}
async function dbDelete(table, id) {
  await fetch(`${URL}/${table}?id=eq.${id}`, { method:'DELETE', headers:H })
}

function taskToDB(t) {
  return {
    id:t.id, title:t.title, description:t.description||'',
    category:t.category, priority:t.priority,
    is_completed:t.isCompleted, created_at:t.createdAt, updated_at:t.updatedAt,
    due_date:t.dueDate||null, completed_at:t.completedAt||null,
    notes:t.notes||[], tags:t.tags||[],
    project_id:t.projectId||null, calendar_event_id:t.calendarEventId||null,
    image_uri:t.imageUri||null, is_archived:t.isArchivedToOneNote||false,
  }
}
function taskFromDB(r) {
  return {
    id:r.id, title:r.title, description:r.description||'',
    category:r.category, priority:r.priority,
    isCompleted:r.is_completed, createdAt:r.created_at, updatedAt:r.updated_at,
    dueDate:r.due_date||null, completedAt:r.completed_at||null,
    notes:r.notes||[], tags:r.tags||[],
    projectId:r.project_id||null, calendarEventId:r.calendar_event_id||null,
    imageUri:r.image_uri||null, isArchivedToOneNote:r.is_archived||false,
  }
}
function projToDB(p) {
  return {
    id:p.id, name:p.name, description:p.description||'',
    category:p.category, task_ids:p.taskIds||[], notes:p.notes||[],
    is_completed:p.isCompleted, created_at:p.createdAt, updated_at:p.updatedAt,
    due_date:p.dueDate||null, completed_at:p.completedAt||null,
  }
}
function projFromDB(r) {
  return {
    id:r.id, name:r.name, description:r.description||'',
    category:r.category, taskIds:r.task_ids||[], notes:r.notes||[],
    isCompleted:r.is_completed, createdAt:r.created_at, updatedAt:r.updated_at,
    dueDate:r.due_date||null, completedAt:r.completed_at||null,
  }
}

export function StoreProvider({ children }) {
  const [tasks,    setTasksRaw]    = useState(()=>load('sai_tasks',   makeSamples()))
  const [projects, setProjectsRaw] = useState(()=>load('sai_projects',[{
    id:uid(),name:"Home Renovation 2026",description:"Full kitchen and bathroom remodel",
    category:"Projects",taskIds:[],notes:[{id:uid(),content:"Budget: $45,000. Contractor: Mike's Renovations.",createdAt:new Date().toISOString(),isAI:false}],
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),isCompleted:false,
  }]))
  const [apiKey,   setApiKeyRaw]   = useState(()=>localStorage.getItem('sai_key')||'')
  const [screen,   setScreen]      = useState('dashboard')
  const [param,    setParam]       = useState(null)
  const [syncing,  setSyncing]     = useState(false)
  const [syncError,setSyncError]   = useState('')

  const setTasks    = useCallback(v=>{ setTasksRaw(v);    save('sai_tasks',v)    },[])
  const setProjects = useCallback(v=>{ setProjectsRaw(v); save('sai_projects',v) },[])
  const setApiKey   = useCallback(k=>{ setApiKeyRaw(k);   localStorage.setItem('sai_key',k) },[])
  const go          = useCallback((s,p=null)=>{ setScreen(s); setParam(p) },[])

  useEffect(()=>{ syncNow() },[]) // eslint-disable-line

  const syncNow = useCallback(async()=>{
    setSyncing(true); setSyncError('')
    try {
      const [tr,pr] = await Promise.all([dbGet('tasks'),dbGet('projects')])
      if(tr.length>0) setTasks(tr.map(taskFromDB))
      if(pr.length>0) setProjects(pr.map(projFromDB))
    } catch(e) { setSyncError('Offline — using local data') }
    setSyncing(false)
  },[setTasks,setProjects])

  const addTask = useCallback((f)=>{
    const t={id:uid(),isCompleted:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),notes:[],tags:[],...f}
    setTasks(prev=>[t,...prev])
    dbUpsert('tasks',taskToDB(t)).catch(console.warn)
    return t
  },[setTasks])

  const updateTask = useCallback((id,u)=>{
    setTasks(prev=>{
      const next=prev.map(t=>t.id===id?{...t,...u,updatedAt:new Date().toISOString()}:t)
      const updated=next.find(t=>t.id===id)
      if(updated) dbUpsert('tasks',taskToDB(updated)).catch(console.warn)
      return next
    })
  },[setTasks])

  const deleteTask = useCallback((id)=>{
    setTasks(prev=>prev.filter(t=>t.id!==id))
    dbDelete('tasks',id).catch(console.warn)
  },[setTasks])

  const completeTask = useCallback((id)=>{
    setTasks(prev=>{
      const next=prev.map(t=>t.id===id?{...t,isCompleted:true,completedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}:t)
      const updated=next.find(t=>t.id===id)
      if(updated) dbUpsert('tasks',taskToDB(updated)).catch(console.warn)
      return next
    })
  },[setTasks])

  const addNote = useCallback((taskId,content,isAI=false)=>{
    const note={id:uid(),content,createdAt:new Date().toISOString(),isAI}
    setTasks(prev=>{
      const next=prev.map(t=>t.id===taskId?{...t,notes:[...t.notes,note],updatedAt:new Date().toISOString()}:t)
      const updated=next.find(t=>t.id===taskId)
      if(updated) dbUpsert('tasks',taskToDB(updated)).catch(console.warn)
      return next
    })
  },[setTasks])

  const addProject = useCallback((f)=>{
    const p={id:uid(),taskIds:[],notes:[],isCompleted:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...f}
    setProjects(prev=>[p,...prev])
    dbUpsert('projects',projToDB(p)).catch(console.warn)
    return p
  },[setProjects])

  const updateProject = useCallback((id,u)=>{
    setProjects(prev=>{
      const next=prev.map(p=>p.id===id?{...p,...u,updatedAt:new Date().toISOString()}:p)
      const updated=next.find(p=>p.id===id)
      if(updated) dbUpsert('projects',projToDB(updated)).catch(console.warn)
      return next
    })
  },[setProjects])

  const deleteProject = useCallback((id)=>{
    setProjects(prev=>prev.filter(p=>p.id!==id))
    dbDelete('projects',id).catch(console.warn)
  },[setProjects])

  const addProjectNote = useCallback((pid,content,isAI=false)=>{
    const note={id:uid(),content,createdAt:new Date().toISOString(),isAI}
    setProjects(prev=>{
      const next=prev.map(p=>p.id===pid?{...p,notes:[...p.notes,note],updatedAt:new Date().toISOString()}:p)
      const updated=next.find(p=>p.id===pid)
      if(updated) dbUpsert('projects',projToDB(updated)).catch(console.warn)
      return next
    })
  },[setProjects])

  const activeTasks         = tasks.filter(t=>!t.isCompleted).sort((a,b)=>a.priority-b.priority)
  const overdueTasks        = tasks.filter(t=>isOverdue(t))
  const byCategory          = (cat)=>tasks.filter(t=>t.category===cat&&!t.isCompleted).sort((a,b)=>a.priority-b.priority)
  const byPriority          = (p)=>tasks.filter(t=>t.priority===p&&!t.isCompleted)
  const forProject          = (pid)=>{ const pr=projects.find(x=>x.id===pid); return pr?tasks.filter(t=>pr.taskIds.includes(t.id)):[] }
  const completedByCategory = (cat)=>tasks.filter(t=>t.category===cat&&t.isCompleted)

  const weeklyStats = ()=>{
    const ws=new Date(); ws.setDate(ws.getDate()-ws.getDay()); ws.setHours(0,0,0,0)
    const wt=tasks.filter(t=>new Date(t.createdAt)>=ws)
    const done=wt.filter(t=>t.isCompleted).length
    const byCat={}
    CATEGORIES.forEach(cat=>{
      const ct=wt.filter(t=>t.category===cat)
      const cd=ct.filter(t=>t.isCompleted).length
      byCat[cat]={total:ct.length,completed:cd,rate:ct.length?cd/ct.length:0}
    })
    return {total:wt.length,completed:done,rate:wt.length?done/wt.length:0,byCat,overdue:overdueTasks,old7:tasks.filter(t=>isOld7(t))}
  }

  return (
    <Ctx.Provider value={{
      tasks,projects,apiKey,setApiKey,screen,param,go,
      syncing,syncError,syncNow,
      addTask,updateTask,deleteTask,completeTask,addNote,
      addProject,updateProject,deleteProject,addProjectNote,
      activeTasks,overdueTasks,byCategory,byPriority,forProject,completedByCategory,weeklyStats,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useStore = ()=>useContext(Ctx)
