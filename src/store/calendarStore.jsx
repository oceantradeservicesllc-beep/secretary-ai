import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const Ctx = createContext(null)

const SUPA_URL = 'https://meqsodoybcsgpmmccwpe.supabase.co/rest/v1'
const SUPA_KEY = 'sb_publishable_-KsN5vI4j3YYkw14ursHuw_HC5H0j_O'
const H = {
  'Content-Type':  'application/json',
  'apikey':        SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Prefer':        'resolution=merge-duplicates,return=minimal',
}

const LKEY = 'sai_cal_events_v2'
const uid  = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const load = (k, fb) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb }
}
const persist = (v) => {
  try { localStorage.setItem(LKEY, JSON.stringify(v)) } catch {}
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function dbFetchAll() {
  try {
    const r = await fetch(
      `${SUPA_URL}/calendar_events?order=event_date.asc&limit=5000`,
      { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
    )
    if (!r.ok) { console.warn('calendar_events fetch failed:', r.status, await r.text()); return null }
    return await r.json()
  } catch(e) { console.warn('calendar_events fetch error:', e); return null }
}

async function dbUpsert(ev) {
  try {
    const r = await fetch(`${SUPA_URL}/calendar_events`, {
      method:  'POST',
      headers: H,
      body:    JSON.stringify(ev),
    })
    if (!r.ok) console.warn('calendar upsert failed:', r.status, await r.text())
  } catch(e) { console.warn('calendar upsert error:', e) }
}

async function dbDelete(id) {
  try {
    const r = await fetch(`${SUPA_URL}/calendar_events?id=eq.${id}`, {
      method:  'DELETE',
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
    })
    if (!r.ok) console.warn('calendar delete failed:', r.status)
  } catch(e) { console.warn('calendar delete error:', e) }
}

// ── Row converters ────────────────────────────────────────────────────────────
function toRow(e) {
  return {
    id:         e.id,
    title:      e.title || '',
    type:       e.type  || 'appointment',
    event_date: e.date,
    event_time: e.time     || null,
    end_time:   e.endTime  || null,
    custody:    e.custody  || null,
    habit_id:   e.habitId  || null,
    task_id:    e.taskId   || null,
    status:     e.status   || 'scheduled',
    note:       e.note     || '',
    color:      e.color    || null,
    all_day:    e.allDay   !== false,
    recurring:  e.recurring|| null,
    created_at: e.createdAt|| new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function fromRow(r) {
  return {
    id:        r.id,
    title:     r.title     || '',
    type:      r.type      || 'appointment',
    date:      r.event_date,
    time:      r.event_time|| null,
    endTime:   r.end_time  || null,
    custody:   r.custody   || null,
    habitId:   r.habit_id  || null,
    taskId:    r.task_id   || null,
    status:    r.status    || 'scheduled',
    note:      r.note      || '',
    color:     r.color     || null,
    allDay:    r.all_day   !== false,
    recurring: r.recurring || null,
    createdAt: r.created_at,
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const CUSTODY_OPTIONS = [
  { k:'me',    label:'Me',    color:'#6C63FF' },
  { k:'laura', label:'Laura', color:'#FF9F43' },
]

export const EVENT_TYPES = [
  { k:'appointment', label:'Appointment', color:'#45B7D1' },
  { k:'task',        label:'Task',        color:'#6C63FF' },
  { k:'habit',       label:'Habit',       color:'#52C986' },
  { k:'custody',     label:'Custody',     color:'#FF9F43' },
  { k:'reminder',    label:'Reminder',    color:'#C984E0' },
]

// ── Provider ──────────────────────────────────────────────────────────────────
export function CalendarProvider({ children }) {
  const [events,  setEvents]  = useState(() => load(LKEY, []))
  const [syncing, setSyncing] = useState(false)
  const [syncErr, setSyncErr] = useState('')
  const synced = useRef(false)

  // Always persist to localStorage on change
  useEffect(() => { persist(events) }, [events])

  // Sync from Supabase once on mount
  useEffect(() => {
    if (!synced.current) { synced.current = true; syncFromCloud() }
  }, []) // eslint-disable-line

  const syncFromCloud = useCallback(async () => {
    setSyncing(true); setSyncErr('')
    const rows = await dbFetchAll()
    if (rows === null) {
      // Network error — keep local data
      setSyncErr('Offline — using local data')
    } else if (rows.length > 0) {
      // Merge: cloud wins for existing IDs, keep local-only events
      setEvents(prev => {
        const cloudIds  = new Set(rows.map(r => r.id))
        const localOnly = prev.filter(e => !cloudIds.has(e.id))
        // Push local-only events to cloud
        localOnly.forEach(e => dbUpsert(toRow(e)))
        return [...rows.map(fromRow), ...localOnly]
      })
    } else {
      // Cloud empty — push all local events up
      const local = load(LKEY, [])
      if (local.length > 0) {
        local.forEach(e => dbUpsert(toRow(e)))
      }
    }
    setSyncing(false)
  }, [])

  // ── Add ───────────────────────────────────────────────────────────────────
  const addEvent = useCallback((data) => {
    const ev = {
      id:        uid(),
      title:     data.title     || '',
      type:      data.type      || 'appointment',
      date:      data.date,
      time:      data.time      || null,
      endTime:   data.endTime   || null,
      custody:   data.custody   || null,
      habitId:   data.habitId   || null,
      taskId:    data.taskId    || null,
      status:    data.status    || 'scheduled',
      note:      data.note      || '',
      color:     data.color     || null,
      allDay:    data.allDay    !== false,
      recurring: data.recurring || null,
      createdAt: new Date().toISOString(),
    }
    setEvents(prev => [ev, ...prev])
    dbUpsert(toRow(ev))
    return ev
  }, [])

  // ── Update ────────────────────────────────────────────────────────────────
  const updateEvent = useCallback((id, updates) => {
    setEvents(prev => prev.map(e => {
      if (e.id !== id) return e
      const updated = { ...e, ...updates }
      dbUpsert(toRow(updated))
      return updated
    }))
  }, [])

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteEvent = useCallback((id) => {
    setEvents(prev => prev.filter(e => e.id !== id))
    dbDelete(id)
  }, [])

  // ── Queries ───────────────────────────────────────────────────────────────
  const getEventsForDate = useCallback((date) => {
    return events.filter(e => e.date === date)
  }, [events])

  const getEventsForMonth = useCallback((year, month) => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return events.filter(e => e.date?.startsWith(prefix))
  }, [events])

  const confirmHabitEvent = useCallback((eventId, status) => {
    updateEvent(eventId, { status })
  }, [updateEvent])

  return (
    <Ctx.Provider value={{
      events, syncing, syncErr,
      addEvent, updateEvent, deleteEvent,
      getEventsForDate, getEventsForMonth,
      confirmHabitEvent, syncFromCloud,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useCalendar = () => useContext(Ctx)
