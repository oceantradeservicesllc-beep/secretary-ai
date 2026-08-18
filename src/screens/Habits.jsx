import { useState } from 'react'
import { useHabits, HABIT_EMOJIS, FREQ_OPTIONS } from '../store/habitStore.jsx'
import { C } from '../utils/helpers.js'

const TODAY = new Date().toISOString().split('T')[0]

const TYPE_COLOR = { good:'#52C986', bad:'#FF5E5E' }

export default function Habits() {
  const [view, setView] = useState('today') // today | manage | add | stats
  const [editHabit, setEditHabit] = useState(null)
  const { habits, syncing } = useHabits()
  const activeHabits = habits.filter(h=>h.isActive)

  return (
    <div style={{padding:'0 0 100px'}}>
      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`}}>
        {[['today','Today'],['stats','Stats'],['manage','Manage']].map(([k,l])=>(
          <button key={k} onClick={()=>setView(k)}
            style={{flex:1,border:'none',borderBottom:`2px solid ${view===k?C.accent:'transparent'}`,
              background:'transparent',color:view===k?C.accent:C.textMuted,
              padding:'12px 4px',fontSize:13,fontWeight:view===k?600:400,
              cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{padding:'0 16px'}}>
        {view==='today'  && <TodayView  onAdd={()=>setView('manage')}/>}
        {view==='stats'  && <StatsView/>}
        {view==='manage' && <ManageView onAdd={()=>setEditHabit({})} onEdit={h=>setEditHabit(h)}/>}
      </div>

      {editHabit!==null && (
        <HabitModal habit={editHabit} onClose={()=>setEditHabit(null)}/>
      )}
    </div>
  )
}

// ── Today View ────────────────────────────────────────────────────────────────
function TodayView({ onAdd }) {
  const { habits, logHabit, getLogForDate, isDueOnDate } = useHabits()
  const active = habits.filter(h=>h.isActive)
  const due    = active.filter(h=>isDueOnDate(h,TODAY))
  const good   = due.filter(h=>h.type==='good')
  const bad    = due.filter(h=>h.type==='bad')

  const doneCnt    = due.filter(h=>getLogForDate(h.id,TODAY)?.status==='done').length
  const pct        = due.length ? Math.round(doneCnt/due.length*100) : 0

  return (
    <div style={{paddingTop:16}}>
      {/* Progress header */}
      <div style={{marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
          <div>
            <div style={{color:C.textMuted,fontSize:12}}>Today's habits</div>
            <div style={{color:C.text,fontSize:22,fontWeight:700}}>{doneCnt} / {due.length}</div>
          </div>
          <div style={{color:C.accent,fontSize:28,fontWeight:700}}>{pct}%</div>
        </div>
        <div style={{background:C.surface,borderRadius:6,height:8,overflow:'hidden'}}>
          <div style={{background:C.accent,height:'100%',width:`${pct}%`,borderRadius:6,transition:'width .4s'}}/>
        </div>
      </div>

      {due.length===0 ? (
        <div style={{textAlign:'center',padding:'40px 20px'}}>
          <div style={{fontSize:44,marginBottom:12}}>🎯</div>
          <div style={{color:C.text,fontSize:16,fontWeight:600,marginBottom:6}}>No habits scheduled today</div>
          <div style={{color:C.textSec,fontSize:13,marginBottom:20}}>Add habits to start tracking</div>
          <button onClick={onAdd} style={{background:C.accent,border:'none',borderRadius:12,
            padding:'10px 24px',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
            fontFamily:'Inter,sans-serif'}}>+ Add habit</button>
        </div>
      ) : (
        <>
          {good.length>0&&<>
            <div style={{color:C.success,fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:8,textTransform:'uppercase'}}>Good habits</div>
            {good.map(h=><HabitCheckRow key={h.id} habit={h} date={TODAY} onLog={logHabit} getLog={getLogForDate}/>)}
            <div style={{marginBottom:16}}/>
          </>}
          {bad.length>0&&<>
            <div style={{color:C.danger,fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:8,textTransform:'uppercase'}}>Bad habits to avoid</div>
            {bad.map(h=><HabitCheckRow key={h.id} habit={h} date={TODAY} onLog={logHabit} getLog={getLogForDate} isBad/>)}
          </>}
        </>
      )}
    </div>
  )
}

function HabitCheckRow({ habit, date, onLog, getLog, isBad }) {
  const log    = getLog(habit.id, date)
  const isDone = log?.status==='done'
  const color  = isBad ? C.danger : C.success

  return (
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',
      borderBottom:`1px solid ${C.border}22`}}>
      <div style={{width:40,height:40,borderRadius:12,
        background:isDone?color+'20':C.surface,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:20,flexShrink:0,transition:'background .2s'}}>
        {habit.logoEmoji}
      </div>
      <div style={{flex:1}}>
        <div style={{color:C.text,fontSize:13,fontWeight:600,
          textDecoration:isDone&&!isBad?'line-through':isDone&&isBad?'line-through':'none',
          opacity:isDone?0.6:1}}>
          {habit.name}
        </div>
        {habit.description&&(
          <div style={{color:C.textMuted,fontSize:11}}>{habit.description}</div>
        )}
      </div>
      <button onClick={()=>onLog(habit.id, date, isDone?'skipped':'done')}
        style={{width:34,height:34,borderRadius:10,border:`2px solid ${isDone?color:C.border}`,
          background:isDone?color:'transparent',cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center',
          transition:'all .2s',flexShrink:0}}>
        {isDone&&<span style={{color:'#fff',fontSize:16,fontWeight:700}}>✓</span>}
      </button>
    </div>
  )
}

// ── Stats View ────────────────────────────────────────────────────────────────
function StatsView() {
  const { habits, getLogsForDateRange, isDueOnDate } = useHabits()
  const [days, setDays] = useState(7)
  const active = habits.filter(h=>h.isActive)

  const dates = []
  for(let i=days-1;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i)
    dates.push(d.toISOString().split('T')[0])
  }
  const startDate = dates[0]
  const endDate   = dates[dates.length-1]
  const logs = getLogsForDateRange(startDate, endDate)

  function getStreak(habit) {
    let streak=0
    const today=new Date()
    for(let i=0;i<365;i++) {
      const d=new Date(today); d.setDate(d.getDate()-i)
      const date=d.toISOString().split('T')[0]
      if(!isDueOnDate(habit,date)) continue
      const log=logs.find(l=>l.habitId===habit.id&&l.date===date)
      if(log?.status==='done') streak++
      else break
    }
    return streak
  }

  return (
    <div style={{paddingTop:16}}>
      <div style={{display:'flex',gap:5,marginBottom:16,background:C.surface,borderRadius:10,padding:4}}>
        {[[7,'7d'],[14,'14d'],[30,'30d']].map(([d,l])=>(
          <button key={d} onClick={()=>setDays(d)}
            style={{flex:1,background:days===d?C.card:'transparent',
              border:days===d?`0.5px solid ${C.border}`:'1px solid transparent',
              borderRadius:7,padding:'5px 4px',color:days===d?C.text:C.textMuted,
              fontSize:12,fontWeight:days===d?600:400,cursor:'pointer',
              fontFamily:'Inter,sans-serif',textAlign:'center'}}>
            {l}
          </button>
        ))}
      </div>

      {active.map(h=>{
        const due   = dates.filter(d=>isDueOnDate(h,d))
        const done  = due.filter(d=>logs.find(l=>l.habitId===h.id&&l.date===d&&l.status==='done'))
        const pct   = due.length?Math.round(done.length/due.length*100):0
        const streak= getStreak(h)
        const color = h.type==='good'?C.success:C.danger

        return (
          <div key={h.id} style={{background:C.card,border:`0.5px solid ${C.border}`,
            borderRadius:12,padding:'12px 14px',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <span style={{fontSize:20}}>{h.logoEmoji}</span>
              <div style={{flex:1}}>
                <div style={{color:C.text,fontSize:13,fontWeight:600}}>{h.name}</div>
                <div style={{color:C.textMuted,fontSize:11}}>{done.length}/{due.length} days completed</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{color,fontSize:16,fontWeight:700}}>{pct}%</div>
                {streak>0&&<div style={{color:C.warning,fontSize:10}}>🔥 {streak} streak</div>}
              </div>
            </div>
            {/* Mini calendar dots */}
            <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
              {dates.map(d=>{
                const isDue = isDueOnDate(h,d)
                const log   = logs.find(l=>l.habitId===h.id&&l.date===d)
                const bg    = !isDue?C.surface:log?.status==='done'?color:log?.status==='cancelled'?C.danger+'60':C.surface
                return <div key={d} style={{width:10,height:10,borderRadius:3,
                  background:bg,border:`0.5px solid ${isDue?color:C.border}22`}}/>
              })}
            </div>
          </div>
        )
      })}

      {active.length===0&&(
        <div style={{textAlign:'center',padding:'40px 20px'}}>
          <div style={{fontSize:44,marginBottom:12}}>📊</div>
          <div style={{color:C.textSec}}>No habits yet — add some to see stats</div>
        </div>
      )}
    </div>
  )
}

// ── Manage View ───────────────────────────────────────────────────────────────
function ManageView({ onAdd, onEdit }) {
  const { habits, deleteHabit } = useHabits()
  const active = habits.filter(h=>h.isActive)

  return (
    <div style={{paddingTop:16}}>
      <button onClick={onAdd}
        style={{width:'100%',background:C.accentSoft,border:`1px dashed rgba(108,99,255,.4)`,
          borderRadius:12,padding:'12px',color:C.accent,fontSize:13,fontWeight:600,
          cursor:'pointer',fontFamily:'Inter,sans-serif',marginBottom:16}}>
        + Add new habit
      </button>

      {active.length===0&&(
        <div style={{textAlign:'center',padding:'40px 20px'}}>
          <div style={{fontSize:44,marginBottom:12}}>🎯</div>
          <div style={{color:C.textSec}}>No habits yet. Add your first one!</div>
        </div>
      )}

      {[['good','Good habits ✅'],['bad','Bad habits to avoid 🚫']].map(([type,label])=>{
        const list = active.filter(h=>h.type===type)
        if(!list.length) return null
        return (
          <div key={type} style={{marginBottom:20}}>
            <div style={{color:type==='good'?C.success:C.danger,fontSize:12,fontWeight:700,
              letterSpacing:.5,marginBottom:8}}>{label}</div>
            {list.map(h=>(
              <div key={h.id} style={{display:'flex',alignItems:'center',gap:12,
                padding:'10px 0',borderBottom:`1px solid ${C.border}22`}}>
                <span style={{fontSize:22,width:36,textAlign:'center'}}>{h.logoEmoji}</span>
                <div style={{flex:1}}>
                  <div style={{color:C.text,fontSize:13,fontWeight:600}}>{h.name}</div>
                  <div style={{color:C.textMuted,fontSize:11}}>
                    {FREQ_OPTIONS.find(f=>f.k===h.frequencyType)?.label||'Daily'}
                    {h.frequencyValue>1?` (every ${h.frequencyValue})`:''}
                    {h.notify?` · 🔔 ${h.notifyTime}`:''}
                  </div>
                </div>
                <button onClick={()=>onEdit(h)}
                  style={{background:C.accentSoft,border:'none',borderRadius:8,
                    padding:'5px 10px',color:C.accent,fontSize:12,cursor:'pointer',
                    fontFamily:'Inter,sans-serif'}}>Edit</button>
                <button onClick={()=>{ if(window.confirm(`Delete "${h.name}"? History kept.`)) deleteHabit(h.id) }}
                  style={{background:'rgba(255,94,94,.1)',border:'none',borderRadius:8,
                    padding:'5px 8px',color:C.danger,fontSize:12,cursor:'pointer',
                    fontFamily:'Inter,sans-serif'}}>🗑</button>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Habit Modal (Add / Edit) ──────────────────────────────────────────────────
function HabitModal({ habit, onClose }) {
  const { addHabit, updateHabit } = useHabits()
  const isEdit = !!habit.id

  const [name,         setName]         = useState(habit.name||'')
  const [description,  setDescription]  = useState(habit.description||'')
  const [type,         setType]         = useState(habit.type||'good')
  const [logoEmoji,    setLogoEmoji]    = useState(habit.logoEmoji||'⭐')
  const [freqType,     setFreqType]     = useState(habit.frequencyType||'daily')
  const [freqVal,      setFreqVal]      = useState(habit.frequencyValue||1)
  const [notify,       setNotify]       = useState(habit.notify||false)
  const [notifyTime,   setNotifyTime]   = useState(habit.notifyTime||'08:00')
  const [showEmojis,   setShowEmojis]   = useState(false)
  const [err,          setErr]          = useState('')
  const [saved,        setSaved]        = useState(false)

  function handleSave() {
    if (!name.trim()) { setErr('Name is required'); return }
    const data = { name:name.trim(), description, type, logoEmoji,
      frequencyType:freqType, frequencyValue:parseInt(freqVal)||1,
      notify, notifyTime }
    if (isEdit) updateHabit(habit.id, data)
    else        addHabit(data)
    setSaved(true); setTimeout(onClose, 900)
  }

  const needsValue = freqType.includes('every_x')

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',
      zIndex:1000,display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.card,borderRadius:'20px 20px 0 0',width:'100%',
          padding:20,maxHeight:'92vh',overflowY:'auto'}}>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h3 style={{color:C.text,fontSize:18,fontWeight:700}}>
            {isEdit?'Edit habit':'New habit'}
          </h3>
          <button onClick={onClose} style={{background:C.surface,border:'none',borderRadius:8,
            width:30,height:30,cursor:'pointer',color:C.textSec,fontSize:18}}>✕</button>
        </div>

        {/* Logo picker */}
        <div style={{textAlign:'center',marginBottom:16}}>
          <div onClick={()=>setShowEmojis(!showEmojis)}
            style={{width:64,height:64,borderRadius:16,background:C.surface,
              fontSize:36,cursor:'pointer',display:'inline-flex',alignItems:'center',
              justifyContent:'center',border:`2px dashed ${C.border}`}}>
            {logoEmoji}
          </div>
          <div style={{color:C.textMuted,fontSize:11,marginTop:4}}>Tap to change icon</div>
          {showEmojis&&(
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10,
              background:C.surface,borderRadius:12,padding:10}}>
              {HABIT_EMOJIS.map(e=>(
                <button key={e} onClick={()=>{setLogoEmoji(e);setShowEmojis(false)}}
                  style={{width:36,height:36,borderRadius:8,border:`1px solid ${logoEmoji===e?C.accent:C.border}`,
                    background:logoEmoji===e?C.accentSoft:C.card,cursor:'pointer',fontSize:18}}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Name *</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Morning run"
            style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
              padding:'9px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
        </div>

        {/* Description */}
        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Short description (optional)</label>
          <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. 30 min run before work"
            style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
              padding:'9px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
        </div>

        {/* Good / Bad */}
        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:6}}>Habit type</label>
          <div style={{display:'flex',gap:8}}>
            {[['good','✅ Good habit',C.success],['bad','🚫 Bad habit',C.danger]].map(([t,l,c])=>(
              <button key={t} onClick={()=>setType(t)}
                style={{flex:1,border:`2px solid ${type===t?c:C.border}`,borderRadius:10,
                  padding:'10px 8px',background:type===t?c+'15':'transparent',
                  color:type===t?c:C.textMuted,fontSize:12,fontWeight:type===t?600:400,
                  cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:6}}>Frequency / reminder</label>
          <select value={freqType} onChange={e=>setFreqType(e.target.value)}
            style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
              padding:'9px 12px',color:C.text,fontSize:13,outline:'none',marginBottom:needsValue?8:0}}>
            {FREQ_OPTIONS.map(f=><option key={f.k} value={f.k}>{f.label}</option>)}
          </select>
          {needsValue&&(
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{color:C.textSec,fontSize:12}}>Every</span>
              <input type="number" min="2" max="365" value={freqVal} onChange={e=>setFreqVal(e.target.value)}
                style={{width:70,background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
                  padding:'8px 10px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
              <span style={{color:C.textSec,fontSize:12}}>{freqType.includes('day')?'days':freqType.includes('week')?'weeks':'months'}</span>
            </div>
          )}
        </div>

        {/* Notification */}
        <div style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:notify?8:0}}>
            <label style={{color:C.textSec,fontSize:12}}>🔔 Reminder notification</label>
            <button onClick={()=>setNotify(!notify)}
              style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',
                background:notify?C.accent:C.surface,padding:0,position:'relative',transition:'background .2s'}}>
              <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',
                position:'absolute',top:3,left:notify?23:3,transition:'left .2s'}}/>
            </button>
          </div>
          {notify&&(
            <input type="time" value={notifyTime} onChange={e=>setNotifyTime(e.target.value)}
              style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
                padding:'8px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
          )}
        </div>

        {err&&<div style={{color:C.danger,fontSize:12,marginBottom:10}}>{err}</div>}

        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose}
            style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,
              padding:12,color:C.textSec,fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            Cancel
          </button>
          <button onClick={handleSave}
            style={{flex:2,background:saved?C.success:C.accent,border:'none',borderRadius:12,
              padding:12,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
              fontFamily:'Inter,sans-serif',transition:'background .3s'}}>
            {saved?'✅ Saved!':(isEdit?'Save Changes':'Add Habit')}
          </button>
        </div>
      </div>
    </div>
  )
}
