import { useStore } from '../store/store.jsx'
import { useHabits } from '../store/habitStore.jsx'
import { useCalendar } from '../store/calendarStore.jsx'
import { C, isOverdue, CATEGORIES } from '../utils/helpers.js'

const TODAY = new Date().toISOString().split('T')[0]

export default function Dashboard() {
  const { tasks, go, weeklyStats } = useStore()
  const { habits, getWeekStats, getLogForDate, isDueOnDate } = useHabits()
  const { getEventsForDate } = useCalendar()

  const ws         = weeklyStats()
  const habitStats = getWeekStats()
  const overdue    = tasks.filter(t=>isOverdue(t)&&!t.isCompleted)
  const p1Today    = tasks.filter(t=>t.priority===1&&!t.isCompleted)
  const todayEvents= getEventsForDate(TODAY)
  const todayHabits= habits.filter(h=>h.isActive&&isDueOnDate(h,TODAY))
  const habitsDone = todayHabits.filter(h=>getLogForDate(h.id,TODAY)?.status==='done').length

  // Tasks completed last 7 days
  const last7start = new Date(); last7start.setDate(last7start.getDate()-6)
  const tasksLast7 = tasks.filter(t=>t.isCompleted&&t.completedAt&&new Date(t.completedAt)>=last7start).length

  return (
    <div style={{padding:'12px 16px 20px'}}>

      {/* Greeting */}
      <div style={{marginBottom:18}}>
        <div style={{color:C.text,fontSize:20,fontWeight:700,marginBottom:2}}>
          {greeting()}, Jean-François
        </div>
        <div style={{color:C.textMuted,fontSize:12}}>
          {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
        </div>
      </div>

      {/* Quick stats row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:16}}>
        <StatCard label="Tasks done" value={tasksLast7} sub="last 7 days" color={C.accent} onClick={()=>go('tasks')}/>
        <StatCard label="Good habits" value={habitStats.goodDone} sub="last 7 days" color={C.success} onClick={()=>go('habits')}/>
        <StatCard label="Bad habits" value={habitStats.badDone} sub="last 7 days" color={C.danger} onClick={()=>go('habits')}/>
      </div>

      {/* Today's habits progress */}
      {todayHabits.length>0&&(
        <div onClick={()=>go('habits')} style={{background:C.card,border:`0.5px solid ${C.border}`,
          borderRadius:14,padding:'12px 14px',marginBottom:12,cursor:'pointer'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{color:C.text,fontSize:13,fontWeight:700}}>Today's habits</div>
            <div style={{color:C.accent,fontSize:11}}>{habitsDone}/{todayHabits.length} done →</div>
          </div>
          <div style={{background:C.surface,borderRadius:5,height:7,overflow:'hidden'}}>
            <div style={{background:habitsDone===todayHabits.length?C.success:C.accent,
              height:'100%',width:`${todayHabits.length?habitsDone/todayHabits.length*100:0}%`,
              borderRadius:5,transition:'width .4s'}}/>
          </div>
          <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
            {todayHabits.slice(0,6).map(h=>{
              const done = getLogForDate(h.id,TODAY)?.status==='done'
              return (
                <div key={h.id} style={{fontSize:18,opacity:done?1:.35}}>{h.logoEmoji}</div>
              )
            })}
            {todayHabits.length>6&&<div style={{color:C.textMuted,fontSize:11,alignSelf:'center'}}>+{todayHabits.length-6}</div>}
          </div>
        </div>
      )}

      {/* Overdue alert */}
      {overdue.length>0&&(
        <div onClick={()=>go('tasks')} style={{background:'rgba(255,94,94,.07)',
          border:'1px solid rgba(255,94,94,.25)',borderRadius:12,
          padding:'10px 14px',marginBottom:12,cursor:'pointer'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{color:C.danger,fontSize:13,fontWeight:700}}>⚠️ {overdue.length} overdue task{overdue.length>1?'s':''}</div>
            <div style={{color:C.danger,fontSize:11}}>View →</div>
          </div>
          {overdue.slice(0,2).map(t=>(
            <div key={t.id} style={{color:C.danger,fontSize:11,marginTop:4,opacity:.8}}>· {t.title}</div>
          ))}
        </div>
      )}

      {/* P1 tasks */}
      {p1Today.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:8}}>🔴 Priority 1</div>
          {p1Today.slice(0,3).map(t=>(
            <div key={t.id} onClick={()=>go('task',t.id)}
              style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,
                padding:'10px 12px',marginBottom:6,cursor:'pointer'}}>
              <div style={{color:C.text,fontSize:13,fontWeight:600}}>{t.title}</div>
              <div style={{color:C.textMuted,fontSize:11}}>{t.category}</div>
            </div>
          ))}
        </div>
      )}

      {/* Today's calendar events */}
      {todayEvents.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{color:C.text,fontSize:13,fontWeight:700}}>📅 Today's schedule</div>
            <button onClick={()=>go('calendar')} style={{background:'none',border:'none',
              color:C.accent,fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>See all →</button>
          </div>
          {todayEvents.map(ev=>(
            <div key={ev.id} style={{display:'flex',alignItems:'center',gap:10,
              padding:'7px 0',borderBottom:`1px solid ${C.border}22`}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:ev.color||C.accent,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{color:C.text,fontSize:12,fontWeight:600}}>{ev.title}</div>
                {ev.time&&<div style={{color:C.textMuted,fontSize:10}}>{ev.time}{ev.endTime?` – ${ev.endTime}`:''}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Weekly summary */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,
        padding:'12px 14px',marginBottom:12}}>
        <div style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>This week</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <MiniStat label="Tasks created"   value={ws.total}     />
          <MiniStat label="Completed"        value={ws.completed} color={C.success}/>
          <MiniStat label="Win rate"         value={`${Math.round(ws.rate*100)}%`} color={C.accent}/>
          <MiniStat label="Overdue"          value={overdue.length} color={overdue.length>0?C.danger:C.textMuted}/>
        </div>
      </div>

      {/* Quick nav */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {[
          ['💼 Trading',  ()=>go('trading')],
          ['📊 Performance', ()=>go('perf')],
          ['📚 Projects', ()=>go('projects')],
          ['📈 Stocks',   ()=>go('stocks')],
        ].map(([l,fn])=>(
          <button key={l} onClick={fn}
            style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,
              padding:'12px',color:C.textSec,fontSize:12,fontWeight:500,
              cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'left'}}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{background:C.card,border:`0.5px solid ${C.border}`,
      borderRadius:12,padding:'10px 10px',cursor:'pointer',textAlign:'center'}}>
      <div style={{color,fontSize:22,fontWeight:700}}>{value}</div>
      <div style={{color:C.text,fontSize:11,fontWeight:600,marginTop:2}}>{label}</div>
      <div style={{color:C.textMuted,fontSize:10}}>{sub}</div>
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{background:C.surface,borderRadius:9,padding:'7px 10px'}}>
      <div style={{color:color||C.text,fontSize:16,fontWeight:700}}>{value}</div>
      <div style={{color:C.textMuted,fontSize:10}}>{label}</div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if(h<12) return 'Good morning'
  if(h<17) return 'Good afternoon'
  return 'Good evening'
}
