// src/store/store.jsx — with Supabase sync
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { uid, makeSamples, isOverdue, isOld7, CATEGORIES } from '../utils/helpers.js'
import {
  fetchTasks, upsertTask, removeTask,
  fetchProjects, upsertProject, removeProject,
} from '../services/supabase.js'

const Ctx = createContext(null)

// localStorage fallback while Supabase loads
const load = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } }
const save = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export function StoreProvider({ children }) {
  const [tasks,    setTasksRaw]    = useState(() => load('sai_tasks',    makeSamples()))
  const [projects, setProjectsRaw] = useState(() => load('sai_projects', [{
    id: uid(), name: "Home Renovation 2026", description: "Full kitchen and bathroom remodel",
    category: "Projects", taskIds: [], notes: [{id:uid(),content:"Budget: $45,000. Contractor: Mike's Renovations.",createdAt:new Date().toISOString(),isAI:false}],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isCompleted: false,
  }]))
  const [apiKey,   setApiKeyRaw]   = useState(() => localStorage.getItem('sai_key') || '')
  const [screen,   setScreen]      = useState('dashboard')
  const [param,    setParam]       = useState(null)
  const [syncing,  setSyncing]     = useState(false)
  const [syncError,setSyncError]   = useState('')

  // ── Persist to localStorage as backup ──────────────────────────────────────
  const setTasks    = useCallback(v => { setTasksRaw(v);    save('sai_tasks',    v) }, [])
  const setProjects = useCallback(v => { setProjectsRaw(v); save('sai_projects', v) }, [])
  const setApiKey   = useCallback(k => { setApiKeyRaw(k);   localStorage.setItem('sai_key', k) }, [])
  const go          = useCallback((s, p = null) => { setScreen(s); setParam(p) }, [])

  // ── Load from Supabase on startup ──────────────────────────────────────────
  useEffect(() => {
    async function loadFromCloud() {
      setSyncing(true)
      setSyncError('')
      try {
        const [cloudTasks, cloudProjects] = await Promise.all([fetchTasks(), fetchProjects()])
        if (cloudTasks.length > 0)    setTasks(cloudTasks)
        if (cloudProjects.length > 0) setProjects(cloudProjects)
      } catch (e) {
        setSyncError('Offline — using local data')
        console.warn('Supabase load failed:', e.message)
      }
      setSyncing(false)
    }
    loadFromCloud()
  }, []) // eslint-disable-line

  // ── Task actions ───────────────────────────────────────────────────────────
  const addTask = useCallback((f) => {
    const t = { id: uid(), isCompleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notes: [], tags: [], ...f }
    setTasks(prev => [t, ...prev])
    upsertTask(t).catch(console.warn)
    return t
  }, [setTasks])

  const updateTask = useCallback((id, u) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...u, updatedAt: new Date().toISOString() } : t)
      const updated = next.find(t => t.id === id)
      if (updated) upsertTask(updated).catch(console.warn)
      return next
    })
  }, [setTasks])

  const deleteTask = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    removeTask(id).catch(console.warn)
  }, [setTasks])

  const completeTask = useCallback((id) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id
        ? { ...t, isCompleted: true, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : t)
      const updated = next.find(t => t.id === id)
      if (updated) upsertTask(updated).catch(console.warn)
      return next
    })
  }, [setTasks])

  const addNote = useCallback((taskId, content, isAI = false) => {
    const note = { id: uid(), content, createdAt: new Date().toISOString(), isAI }
    setTasks(prev => {
      const next = prev.map(t => t.id === taskId
        ? { ...t, notes: [...t.notes, note], updatedAt: new Date().toISOString() }
        : t)
      const updated = next.find(t => t.id === taskId)
      if (updated) upsertTask(updated).catch(console.warn)
      return next
    })
  }, [setTasks])

  // ── Project actions ────────────────────────────────────────────────────────
  const addProject = useCallback((f) => {
    const p = { id: uid(), taskIds: [], notes: [], isCompleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...f }
    setProjects(prev => [p, ...prev])
    upsertProject(p).catch(console.warn)
    return p
  }, [setProjects])

  const updateProject = useCallback((id, u) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...u, updatedAt: new Date().toISOString() } : p)
      const updated = next.find(p => p.id === id)
      if (updated) upsertProject(updated).catch(console.warn)
      return next
    })
  }, [setProjects])

  const deleteProject = useCallback((id) => {
    setProjects(prev => prev.filter(p => p.id !== id))
    removeProject(id).catch(console.warn)
  }, [setProjects])

  const addProjectNote = useCallback((pid, content, isAI = false) => {
    const note = { id: uid(), content, createdAt: new Date().toISOString(), isAI }
    setProjects(prev => {
      const next = prev.map(p => p.id === pid
        ? { ...p, notes: [...p.notes, note], updatedAt: new Date().toISOString() }
        : p)
      const updated = next.find(p => p.id === pid)
      if (updated) upsertProject(updated).catch(console.warn)
      return next
    })
  }, [setProjects])

  // ── Manual sync (pull from cloud) ──────────────────────────────────────────
  const syncNow = useCallback(async () => {
    setSyncing(true)
    setSyncError('')
    try {
      const [cloudTasks, cloudProjects] = await Promise.all([fetchTasks(), fetchProjects()])
      if (cloudTasks.length > 0)    setTasks(cloudTasks)
      if (cloudProjects.length > 0) setProjects(cloudProjects)
    } catch (e) {
      setSyncError('Sync failed — check your connection')
    }
    setSyncing(false)
  }, [setTasks, setProjects])

  // ── Computed ───────────────────────────────────────────────────────────────
  const activeTasks         = tasks.filter(t => !t.isCompleted).sort((a, b) => a.priority - b.priority)
  const overdueTasks        = tasks.filter(t => isOverdue(t))
  const byCategory          = (cat) => tasks.filter(t => t.category === cat && !t.isCompleted).sort((a, b) => a.priority - b.priority)
  const byPriority          = (p)   => tasks.filter(t => t.priority === p && !t.isCompleted)
  const forProject          = (pid) => { const pr = projects.find(x => x.id === pid); return pr ? tasks.filter(t => pr.taskIds.includes(t.id)) : [] }
  const completedByCategory = (cat) => tasks.filter(t => t.category === cat && t.isCompleted)

  const weeklyStats = () => {
    const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay()); ws.setHours(0, 0, 0, 0)
    const wt = tasks.filter(t => new Date(t.createdAt) >= ws)
    const done = wt.filter(t => t.isCompleted).length
    const byCat = {}
    CATEGORIES.forEach(cat => {
      const ct = wt.filter(t => t.category === cat)
      const cd = ct.filter(t => t.isCompleted).length
      byCat[cat] = { total: ct.length, completed: cd, rate: ct.length ? cd / ct.length : 0 }
    })
    return { total: wt.length, completed: done, rate: wt.length ? done / wt.length : 0, byCat, overdue: overdueTasks, old7: tasks.filter(t => isOld7(t)) }
  }

  return (
    <Ctx.Provider value={{
      tasks, projects, apiKey, setApiKey,
      screen, param, go,
      syncing, syncError, syncNow,
      addTask, updateTask, deleteTask, completeTask, addNote,
      addProject, updateProject, deleteProject, addProjectNote,
      activeTasks, overdueTasks, byCategory, byPriority, forProject, completedByCategory, weeklyStats,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useStore = () => useContext(Ctx)
