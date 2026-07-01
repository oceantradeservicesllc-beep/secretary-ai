import { createContext, useContext, useState, useCallback } from 'react'
import { uid, makeSamples, isOverdue, isOld7, CATEGORIES } from '../utils/helpers.js'

const Ctx = createContext(null)

const load = (k,fb) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fb } catch{ return fb } }
const save = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)) } catch{} }

export function StoreProvider({ children }) {
  const [tasks,    setTasksRaw]    = useState(()=>load('sai_tasks',   makeSamples()))
  const [projects, setProjectsRaw] = useState(()=>load('sai_projects',[{id:uid(),name:'Home Renovation 2026',description:'Full kitchen and bathroom remodel',category:'Projects',taskIds:[],notes:[{id:uid(),content:"Budget: $45,000. Contractor: Mike's Renovations.",createdAt:new Date().toISOString(),isAI:false}],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),isCompleted:false}]))
  const [apiKey,   setApiKeyRaw]   = useState(()=>localStorage.getItem('sai_key')||'')
  const [screen,   setScreen]      = useState('dashboard')
  const [param,    setParam]       = useState(null)

  const setTasks    = useCallback(v=>{ setTasksRaw(v);    save('sai_tasks',v)    },[])
  const setProjects = useCallback(v=>{ setProjectsRaw(v); save('sai_projects',v) },[])
  const setApiKey   = useCallback(k=>{ setApiKeyRaw(k);   localStorage.setItem('sai_key',k) },[])
  const go          = useCallback((s,p=null)=>{ setScreen(s); setParam(p) },[])

  // Tasks
  const addTask = useCallback((f)=>{
    const t={id:uid(),isCompleted:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),notes:[],tags:[],...f}
    setTasks(prev=>[t,...prev]); return t
  },[setTasks])

  const updateTask = useCallback((id,u)=>
    setTasks(prev=>prev.map(t=>t.id===id?{...t,...u,updatedAt:new Date().toISOString()}:t))
  ,[setTasks])

  const deleteTask = useCallback((id)=>setTasks(prev=>prev.filter(t=>t.id!==id)),[setTasks])

  const completeTask = useCallback((id)=>
    setTasks(prev=>prev.map(t=>t.id===id?{...t,isCompleted:true,completedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}:t))
  ,[setTasks])

  const addNote = useCallback((taskId,content,isAI=false)=>{
    const note={id:uid(),content,createdAt:new Date().toISOString(),isAI}
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,notes:[...t.notes,note],updatedAt:new Date().toISOString()}:t))
  },[setTasks])

  // Projects
  const addProject = useCallback((f)=>{
    const p={id:uid(),taskIds:[],notes:[],isCompleted:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...f}
    setProjects(prev=>[p,...prev]); return p
  },[setProjects])

  const updateProject = useCallback((id,u)=>
    setProjects(prev=>prev.map(p=>p.id===id?{...p,...u,updatedAt:new Date().toISOString()}:p))
  ,[setProjects])

  const deleteProject = useCallback((id)=>setProjects(prev=>prev.filter(p=>p.id!==id)),[setProjects])

  const addProjectNote = useCallback((pid,content,isAI=false)=>{
    const note={id:uid(),content,createdAt:new Date().toISOString(),isAI}
    setProjects(prev=>prev.map(p=>p.id===pid?{...p,notes:[...p.notes,note],updatedAt:new Date().toISOString()}:p))
  },[setProjects])

  // Computed
  const activeTasks      = tasks.filter(t=>!t.isCompleted).sort((a,b)=>a.priority-b.priority)
  const overdueTasks     = tasks.filter(t=>isOverdue(t))
  const byCategory       = (cat) => tasks.filter(t=>t.category===cat&&!t.isCompleted).sort((a,b)=>a.priority-b.priority)
  const byPriority       = (p)   => tasks.filter(t=>t.priority===p&&!t.isCompleted)
  const forProject       = (pid) => { const pr=projects.find(x=>x.id===pid); return pr?tasks.filter(t=>pr.taskIds.includes(t.id)):[] }
  const completedByCategory = (cat) => tasks.filter(t=>t.category===cat&&t.isCompleted)

  const weeklyStats = () => {
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
      addTask,updateTask,deleteTask,completeTask,addNote,
      addProject,updateProject,deleteProject,addProjectNote,
      activeTasks,overdueTasks,byCategory,byPriority,forProject,completedByCategory,weeklyStats,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useStore = () => useContext(Ctx)
