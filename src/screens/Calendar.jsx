import { useState } from 'react'
import { useCalendar, CUSTODY_OPTIONS, EVENT_TYPES } from '../store/calendarStore.jsx'
import { useHabits } from '../store/habitStore.jsx'
import { useStore } from '../store/store.jsx'
import { C } from '../utils/helpers.js'

const TODAY = new Date().toISOString().split('T')[0]

function dateStr(y,m,d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

export default function CalendarNew() {
  const [view,       setView]       = useState('month') // month | day
  const [selDate,    setSelDate]    = useState(TODAY)
  const [showModal,  setShowModal]  = useState(false)
  const [editEvent,  setEditEvent]  = useState(null)
  const [copied,     setCopied]     = useState(null)  // event being copied
  const { getEventsForDate, getEventsForMonth, confirmHabitEvent, deleteEvent, addEvent } = useCalendar()
  const { habits, isDueOnDate, getLogForDate } = useHabits()
  const { tasks } = useStore()

  const selDateObj = new Date(selDate+'T12:00:00')
  const year  = selDateObj.getFullYear()
  const month = selDateObj.getMonth()

  const daysInMonth = new Date(year, month+1, 0).getDate()
  const firstDay    = new Date(year, month, 1).getDay()
  const monthEvents = getEventsForMonth(year, month)

  // Tasks with deadlines this month
  const monthTasks = tasks.filter(t=>{
    if(!t.dueDate) return false
    const dd = t.dueDate.split('T')[0]
    const prefix = `${year}-${String(month+1).padStart(2,'0')}`
    return dd.startsWith(prefix)
  })

  // Active habits due on each day
  const activeHabits = habits.filter(h=>h.isActive)

  function goMonth(delta) {
    const d=new Date(year,month+delta,1)
    setSelDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`)
  }

  const dayEvents  = getEventsForDate(selDate)
  const dayTasks   = tasks.filter(t=>t.dueDate?.split('T')[0]===selDate&&!t.isCompleted)
  const dayHabits  = activeHabits.filter(h=>isDueOnDate(h,selDate))

  // Custody color for day
  function getCustodyForDay(dateStr) {
    const ev = monthEvents.find(e=>e.date===dateStr&&e.type==='custody')
    if(!ev) return null
    return CUSTODY_OPTIONS.find(c=>c.k===ev.custody)
  }

  return (
    <div style={{padding:'0 0 100px'}}>
      {/* Header */}
      <div style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.border}`}}>
        <button onClick={()=>goMonth(-1)} style={{background:'none',border:'none',color:C.text,fontSize:20,cursor:'pointer',padding:'4px 8px'}}>‹</button>
        <div style={{textAlign:'center'}}>
          <div style={{color:C.text,fontSize:16,fontWeight:700}}>
            {new Date(year,month).toLocaleDateString('en-US',{month:'long',year:'numeric'})}
          </div>
          <div style={{display:'flex',gap:4,justifyContent:'center',marginTop:4}}>
            {CUSTODY_OPTIONS.slice(0,3).map(c=>(
              <div key={c.k} style={{display:'flex',alignItems:'center',gap:3}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:c.color}}/>
                <span style={{color:C.textMuted,fontSize:9}}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={()=>goMonth(1)} style={{background:'none',border:'none',color:C.text,fontSize:20,cursor:'pointer',padding:'4px 8px'}}>›</button>
      </div>

      {/* Day headers */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',padding:'8px 8px 0',gap:2}}>
        {['S','M','T','W','T','F','S'].map((d,i)=>(
          <div key={i} style={{textAlign:'center',color:C.textMuted,fontSize:11,fontWeight:600,padding:'4px 0'}}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',padding:'0 8px 8px',gap:2}}>
        {Array(firstDay).fill(null).map((_,i)=><div key={`e${i}`}/>)}
        {Array(daysInMonth).fill(null).map((_,i)=>{
          const day   = i+1
          const dStr  = dateStr(year,month,day)
          const isToday = dStr===TODAY
          const isSel   = dStr===selDate
          const evs     = monthEvents.filter(e=>e.date===dStr)
          const hasTasks= monthTasks.filter(t=>t.dueDate?.split('T')[0]===dStr)
          const custody = getCustodyForDay(dStr)
          const habDue  = activeHabits.filter(h=>isDueOnDate(h,dStr))
          const habDone = habDue.filter(h=>getLogForDate(h.id,dStr)?.status==='done')

          return (
            <div key={day} onClick={()=>{ setSelDate(dStr); setView('day') }}
              style={{minHeight:52,borderRadius:8,padding:'4px 3px',cursor:'pointer',
                background:isSel?C.accent:isToday?C.accentSoft:custody?custody.color+'10':'transparent',
                border:`1px solid ${isSel?C.accent:isToday?C.accent:C.border}22`,
                position:'relative',transition:'background .15s'}}>
              <div style={{color:isSel?'#fff':isToday?C.accent:C.text,fontSize:12,fontWeight:isSel||isToday?700:400,textAlign:'center'}}>
                {day}
              </div>
              {/* Dots for events */}
              <div style={{display:'flex',justifyContent:'center',flexWrap:'wrap',gap:2,marginTop:2}}>
                {evs.slice(0,3).map((ev,j)=>{
                  const evType = EVENT_TYPES.find(t=>t.k===ev.type)
                  return <div key={j} style={{width:5,height:5,borderRadius:'50%',background:ev.color||evType?.color||C.accent}}/>
                })}
                {hasTasks.length>0&&<div style={{width:5,height:5,borderRadius:'50%',background:'#6C63FF'}}/>}
                {habDue.length>0&&<div style={{width:5,height:5,borderRadius:'50%',background:habDone.length===habDue.length?'#52C986':'#FF9F43'}}/>}
              </div>
              {/* Custody indicator */}
              {custody&&(
                <div style={{position:'absolute',top:2,right:2,width:6,height:6,borderRadius:'50%',background:custody.color}}/>
              )}
            </div>
          )
        })}
      </div>

      {/* Day detail */}
      {view==='day'&&(
        <div style={{padding:'0 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'12px 0',borderBottom:`1px solid ${C.border}`,marginBottom:12}}>
            <div>
              <div style={{color:C.text,fontSize:15,fontWeight:700}}>
                {new Date(selDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
              </div>
              <div style={{color:C.textMuted,fontSize:11,marginTop:2}}>
                {dayHabits.filter(h=>getLogForDate(h.id,selDate)?.status==='done').length}/{dayHabits.length} habits done
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              {copied&&(
                <button onClick={()=>{
                  const uid = ()=>Math.random().toString(36).slice(2)+Date.now().toString(36)
                  addEvent({...copied, id:undefined, date:selDate, status:'scheduled', title:copied.title})
                  setCopied(null)
                }}
                  style={{background:'rgba(82,201,134,.15)',border:'1px solid rgba(82,201,134,.3)',
                    borderRadius:10,padding:'7px 12px',color:'#52C986',fontSize:12,fontWeight:600,
                    cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:4}}>
                  📋 Paste
                </button>
              )}
              {copied&&(
                <button onClick={()=>setCopied(null)}
                  style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,
                    padding:'7px 8px',color:C.textMuted,fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                  ✕
                </button>
              )}
              <button onClick={()=>{setEditEvent({date:selDate});setShowModal(true)}}
                style={{background:C.accent,border:'none',borderRadius:10,padding:'7px 14px',
                  color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                + Add
              </button>
            </div>
          </div>

          {/* Copied event banner */}
          {copied&&(
            <div style={{background:'rgba(82,201,134,.08)',border:'1px solid rgba(82,201,134,.25)',
              borderRadius:10,padding:'8px 12px',marginBottom:10,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{color:'#52C986',fontSize:12,fontWeight:600}}>📋 Copied: {copied.title}</div>
                <div style={{color:'#52C986',fontSize:10,opacity:.8}}>Tap "Paste" to add to this day</div>
              </div>
              <button onClick={()=>setCopied(null)}
                style={{background:'none',border:'none',color:'#52C986',fontSize:16,cursor:'pointer'}}>✕</button>
            </div>
          )}

          {/* Custody picker for this day */}
          <div style={{marginBottom:12}}>
            <div style={{color:C.textMuted,fontSize:11,marginBottom:6}}>Kids custody</div>
            <CustodyPicker date={selDate}/>
          </div>

          {/* Tasks due */}
          {dayTasks.length>0&&(
            <Section title="Tasks due" color='#6C63FF'>
              {dayTasks.map(t=>(
                <EventRow key={t.id} emoji="☑️" title={t.title}
                  sub={`Priority ${t.priority} · ${t.category}`} color='#6C63FF'/>
              ))}
            </Section>
          )}

          {/* Habits */}
          {dayHabits.length>0&&(
            <Section title="Habits" color='#52C986'>
              {dayHabits.map(h=>{
                const log = getLogForDate(h.id,selDate)
                return (
                  <HabitEventRow key={h.id} habit={h} log={log} date={selDate}/>
                )
              })}
            </Section>
          )}

          {/* Calendar events */}
          {dayEvents.length>0&&(
            <Section title="Events & appointments" color='#45B7D1'>
              {dayEvents.map(ev=>{
                const evType = EVENT_TYPES.find(t=>t.k===ev.type)
                return (
                  <div key={ev.id} style={{display:'flex',alignItems:'center',gap:10,
                    padding:'8px 0',borderBottom:`1px solid ${C.border}22`}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:ev.color||evType?.color||C.accent,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{color:C.text,fontSize:13,fontWeight:600}}>{ev.title}</div>
                      <div style={{color:C.textMuted,fontSize:11}}>
                        {ev.time&&`${ev.time}${ev.endTime?` – ${ev.endTime}`:''} · `}
                        {evType?.label}
                        {ev.type==='habit'&&ev.status!=='scheduled'&&(
                          <span style={{color:ev.status==='done'?'#52C986':'#FF5E5E',marginLeft:6}}>
                            {ev.status==='done'?'✓ Done':'✗ Cancelled'}
                          </span>
                        )}
                      </div>
                      {ev.note&&<div style={{color:C.textMuted,fontSize:10,marginTop:2}}>{ev.note}</div>}
                    </div>
                    {ev.type==='habit'&&ev.status==='scheduled'&&(
                      <div style={{display:'flex',gap:5}}>
                        <button onClick={()=>confirmHabitEvent(ev.id,'done')}
                          style={{background:'rgba(82,201,134,.15)',border:'none',borderRadius:7,
                            padding:'4px 8px',color:'#52C986',fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                          Done
                        </button>
                        <button onClick={()=>confirmHabitEvent(ev.id,'cancelled')}
                          style={{background:'rgba(255,94,94,.1)',border:'none',borderRadius:7,
                            padding:'4px 8px',color:'#FF5E5E',fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                          Skip
                        </button>
                      </div>
                    )}
                    <div style={{display:'flex',gap:4,alignItems:'center'}}>
                      <button onClick={()=>{
                        const {id:_id,createdAt:_ca,...rest}=ev
                        setCopied(rest)
                      }}
                        title="Copy event"
                        style={{background:C.accentSoft,border:'none',borderRadius:6,
                          padding:'4px 7px',color:C.accent,fontSize:11,cursor:'pointer',
                          fontFamily:'Inter,sans-serif'}}>
                        📋
                      </button>
                      <button onClick={()=>{ if(window.confirm('Delete this event?')) deleteEvent(ev.id) }}
                        style={{background:'none',border:'none',color:C.textMuted,fontSize:14,cursor:'pointer'}}>🗑</button>
                    </div>
                  </div>
                )
              })}
            </Section>
          )}

          {dayTasks.length===0&&dayHabits.length===0&&dayEvents.length===0&&(
            <div style={{textAlign:'center',padding:'30px 20px'}}>
              <div style={{fontSize:36,marginBottom:8}}>📅</div>
              <div style={{color:C.textSec,fontSize:13}}>Nothing scheduled. Tap + to add an event.</div>
            </div>
          )}
        </div>
      )}

      {showModal&&(
        <AddEventModal preset={editEvent} onClose={()=>{setShowModal(false);setEditEvent(null)}}/>
      )}
    </div>
  )
}

function Section({ title, color, children }) {
  return (
    <div style={{marginBottom:16}}>
      <div style={{color,fontSize:11,fontWeight:700,letterSpacing:.5,marginBottom:8,textTransform:'uppercase'}}>
        {title}
      </div>
      {children}
    </div>
  )
}

function EventRow({ emoji, title, sub, color }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:`1px solid ${C.border}22`}}>
      <span style={{fontSize:16}}>{emoji}</span>
      <div>
        <div style={{color:C.text,fontSize:13,fontWeight:600}}>{title}</div>
        <div style={{color:C.textMuted,fontSize:11}}>{sub}</div>
      </div>
    </div>
  )
}

function HabitEventRow({ habit, log, date }) {
  const { logHabit } = useHabits()
  const isDone = log?.status==='done'
  const color  = habit.type==='good'?'#52C986':'#FF5E5E'
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:`1px solid ${C.border}22`}}>
      <span style={{fontSize:18}}>{habit.logoEmoji}</span>
      <div style={{flex:1}}>
        <div style={{color:C.text,fontSize:13,fontWeight:600}}>{habit.name}</div>
        <div style={{color:C.textMuted,fontSize:11}}>{habit.type==='good'?'Good habit':'Avoid'}</div>
      </div>
      <button onClick={()=>logHabit(habit.id, date, isDone?'skipped':'done')}
        style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${isDone?color:C.border}`,
          background:isDone?color+'15':'transparent',color:isDone?color:C.textSec,
          fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
        {isDone?'✓ Done':'Mark done'}
      </button>
    </div>
  )
}

function CustodyPicker({ date }) {
  const { addEvent, getEventsForDate, updateEvent, deleteEvent } = useCalendar()
  const evs    = getEventsForDate(date)
  const custEv = evs.find(e=>e.type==='custody')
  const curOpt = CUSTODY_OPTIONS.find(c=>c.k===custEv?.custody)

  function setCustody(opt) {
    if(custEv) {
      if(opt.k===custEv.custody) { deleteEvent(custEv.id); return }
      updateEvent(custEv.id,{custody:opt.k,color:opt.color})
    } else {
      addEvent({title:`Custody: ${opt.label}`,type:'custody',date,custody:opt.k,color:opt.color,allDay:true})
    }
  }

  return (
    <div style={{display:'flex',gap:6}}>
      {CUSTODY_OPTIONS.map(opt=>(
        <button key={opt.k} onClick={()=>setCustody(opt)}
          style={{flex:1,border:`2px solid ${curOpt?.k===opt.k?opt.color:C.border}`,
            borderRadius:8,padding:'6px 4px',
            background:curOpt?.k===opt.k?opt.color+'20':'transparent',
            color:curOpt?.k===opt.k?opt.color:C.textMuted,
            fontSize:10,fontWeight:curOpt?.k===opt.k?700:400,
            cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'center'}}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function AddEventModal({ preset, onClose }) {
  const { addEvent } = useCalendar()
  const { habits } = useHabits()

  const [title,    setTitle]    = useState(preset?.title||'')
  const [type,     setType]     = useState(preset?.type||'appointment')
  const [date,     setDate]     = useState(preset?.date||TODAY)
  const [time,     setTime]     = useState(preset?.time||'')
  const [endTime,  setEndTime]  = useState(preset?.endTime||'')
  const [note,     setNote]     = useState(preset?.note||'')
  const [custody,  setCustody]  = useState(preset?.custody||'')
  const [habitId,  setHabitId]  = useState(preset?.habitId||'')
  const [allDay,   setAllDay]   = useState(preset?.allDay!==false)
  const [err,      setErr]      = useState('')
  const [saved,    setSaved]    = useState(false)

  function handleSave() {
    if(!title.trim()&&type!=='habit') { setErr('Title is required'); return }
    const finalTitle = type==='habit'
      ? (habits.find(h=>h.id===habitId)?.name||'Habit')
      : title.trim()
    addEvent({ title:finalTitle, type, date, time:allDay?null:time, endTime:allDay?null:endTime,
      note, custody:custody||null, habitId:habitId||null, allDay,
      color:EVENT_TYPES.find(t=>t.k===type)?.color,
    })
    setSaved(true); setTimeout(onClose, 800)
  }

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',
      zIndex:1000,display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.card,borderRadius:'20px 20px 0 0',width:'100%',
          padding:20,maxHeight:'90vh',overflowY:'auto'}}>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h3 style={{color:C.text,fontSize:18,fontWeight:700}}>Add to calendar</h3>
          <button onClick={onClose} style={{background:C.surface,border:'none',borderRadius:8,
            width:30,height:30,cursor:'pointer',color:C.textSec,fontSize:18}}>✕</button>
        </div>

        {/* Type */}
        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:6}}>Type</label>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {EVENT_TYPES.map(t=>(
              <button key={t.k} onClick={()=>setType(t.k)}
                style={{border:`1px solid ${type===t.k?t.color:C.border}`,borderRadius:8,
                  padding:'5px 10px',background:type===t.k?t.color+'15':'transparent',
                  color:type===t.k?t.color:C.textSec,fontSize:11,fontWeight:type===t.k?600:400,
                  cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Habit picker */}
        {type==='habit'?(
          <div style={{marginBottom:12}}>
            <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Select habit</label>
            <select value={habitId} onChange={e=>setHabitId(e.target.value)}
              style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
                padding:'9px 12px',color:C.text,fontSize:13,outline:'none'}}>
              <option value=''>-- choose habit --</option>
              {habits.filter(h=>h.isActive).map(h=>(
                <option key={h.id} value={h.id}>{h.logoEmoji} {h.name}</option>
              ))}
            </select>
          </div>
        ):(
          <div style={{marginBottom:12}}>
            <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Title *</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Event title"
              style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
                padding:'9px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
          </div>
        )}

        {/* Date */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <div>
            <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
                padding:'8px 10px',color:C.text,fontSize:12,fontFamily:'Inter,sans-serif',outline:'none'}}/>
          </div>
          <div style={{display:'flex',alignItems:'flex-end',gap:6}}>
            <label style={{color:C.textSec,fontSize:11,marginBottom:4}}>All day</label>
            <button onClick={()=>setAllDay(!allDay)}
              style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',
                background:allDay?C.accent:C.surface,padding:0,position:'relative',
                transition:'background .2s',marginBottom:4}}>
              <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',
                position:'absolute',top:3,left:allDay?23:3,transition:'left .2s'}}/>
            </button>
          </div>
        </div>

        {/* Time (if not all day) */}
        {!allDay&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div>
              <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Start time</label>
              <input type="time" value={time} onChange={e=>setTime(e.target.value)}
                style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
                  padding:'8px 10px',color:C.text,fontSize:12,fontFamily:'Inter,sans-serif',outline:'none'}}/>
            </div>
            <div>
              <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>End time</label>
              <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}
                style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
                  padding:'8px 10px',color:C.text,fontSize:12,fontFamily:'Inter,sans-serif',outline:'none'}}/>
            </div>
          </div>
        )}

        {/* Custody */}
        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Kids (optional)</label>
          <div style={{display:'flex',gap:5}}>
            {CUSTODY_OPTIONS.map(opt=>(
              <button key={opt.k} onClick={()=>setCustody(custody===opt.k?'':opt.k)}
                style={{flex:1,border:`1px solid ${custody===opt.k?opt.color:C.border}`,borderRadius:7,
                  padding:'5px 2px',background:custody===opt.k?opt.color+'15':'transparent',
                  color:custody===opt.k?opt.color:C.textMuted,fontSize:10,cursor:'pointer',
                  fontFamily:'Inter,sans-serif'}}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div style={{marginBottom:14}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Note (optional)</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
            style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
              padding:'8px 12px',color:C.text,fontSize:12,fontFamily:'Inter,sans-serif',resize:'none',outline:'none'}}/>
        </div>

        {err&&<div style={{color:C.danger,fontSize:12,marginBottom:10}}>{err}</div>}

        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose}
            style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,
              padding:12,color:C.textSec,fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            Cancel
          </button>
          <button onClick={handleSave}
            style={{flex:2,background:saved?'#52C986':C.accent,border:'none',borderRadius:12,
              padding:12,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
              fontFamily:'Inter,sans-serif',transition:'background .3s'}}>
            {saved?'✅ Added!':'Add to calendar'}
          </button>
        </div>
      </div>
    </div>
  )
}
