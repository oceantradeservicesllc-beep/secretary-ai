import { useState } from 'react'
import { useStore } from '../store/store.jsx'
import { TaskCard, Btn } from '../components/UI.jsx'
import { C } from '../utils/helpers.js'

const SIM = [
  {id:'e1',title:'Q3 Board Meeting',     startDate:new Date(Date.now()+2*86400000).toISOString(),location:'Conference Room A',isDeadline:false},
  {id:'e2',title:'Report Submission Deadline',startDate:new Date(Date.now()+3*86400000).toISOString(),isDeadline:true},
  {id:'e3',title:'Team Standup',          startDate:new Date(Date.now()+86400000).toISOString(),location:'Zoom',isDeadline:false},
]

export default function Calendar() {
  const { tasks, addTask, go } = useStore()
  const [events,  setEvents]  = useState([])
  const [syncing, setSyncing] = useState(false)
  const [synced,  setSynced]  = useState(null)
  const linked = tasks.filter(t=>t.calendarEventId)

  async function sync() {
    setSyncing(true)
    await new Promise(r=>setTimeout(r,1200))
    setEvents(SIM); setSynced(new Date())
    setSyncing(false)
  }

  function create(ev) {
    addTask({title:ev.isDeadline?`📋 DEADLINE: ${ev.title}`:`📅 ${ev.title}`,description:ev.location||'',category:'Work',priority:ev.isDeadline?1:2,dueDate:ev.startDate,calendarEventId:ev.id})
  }

  return (
    <div style={{padding:'0 16px 100px'}}>
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:20,marginBottom:20,textAlign:'center'}}>
        <div style={{width:52,height:52,borderRadius:14,background:'rgba(0,120,212,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,margin:'0 auto 12px'}}>📅</div>
        <h3 style={{color:C.text,fontSize:17,fontWeight:700,marginBottom:6}}>Outlook Calendar Sync</h3>
        <p style={{color:C.textSec,fontSize:13,marginBottom:14,lineHeight:1.5}}>Sync meetings and deadlines from Outlook to create linked tasks automatically.</p>
        {synced&&<p style={{color:C.textMuted,fontSize:12,marginBottom:12}}>Last synced: {synced.toLocaleTimeString()}</p>}
        <Btn label={syncing?'Syncing Outlook…':'🔄  Sync Now'} color="#0078D4" loading={syncing} onClick={sync}/>
        <p style={{color:C.textMuted,fontSize:11,marginTop:10}}>Connect your real Outlook account by adding Microsoft Graph credentials in Settings.</p>
      </div>

      {events.length>0&&(
        <div style={{marginBottom:20}}>
          <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:10}}>Upcoming Events ({events.length})</h3>
          {events.map(ev=><EventCard key={ev.id} ev={ev} onCreate={()=>create(ev)}/>)}
        </div>
      )}

      {linked.length>0&&(
        <div>
          <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:10}}>Linked Tasks ({linked.length})</h3>
          {linked.map(t=><TaskCard key={t.id} task={t} onClick={()=>go('task',t.id)}/>)}
        </div>
      )}

      {events.length===0&&linked.length===0&&(
        <div style={{textAlign:'center',padding:40}}>
          <div style={{fontSize:48,marginBottom:12}}>📅</div>
          <p style={{color:C.textSec,fontSize:14}}>Tap Sync Now to fetch your Outlook events.</p>
        </div>
      )}
    </div>
  )
}

const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function EventCard({ ev, onCreate }) {
  const d=new Date(ev.startDate)
  const h=d.getHours()%12||12, mm=String(d.getMinutes()).padStart(2,'0'), ampm=d.getHours()>=12?'PM':'AM'
  return (
    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:12,marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
      <div style={{width:44,height:50,borderRadius:8,background:ev.isDeadline?'rgba(255,94,94,0.1)':'rgba(0,120,212,0.1)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <div style={{color:ev.isDeadline?C.danger:C.msBlue,fontSize:18,fontWeight:800}}>{d.getDate()}</div>
        <div style={{color:C.textMuted,fontSize:10}}>{MO[d.getMonth()]}</div>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{color:C.text,fontSize:14,fontWeight:500,display:'flex',alignItems:'center',gap:5}}>
          {ev.isDeadline&&<span style={{color:C.danger,fontSize:12}}>🚩</span>}
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.title}</span>
        </div>
        <div style={{color:C.textMuted,fontSize:11,marginTop:2}}>{h}:{mm} {ampm}{ev.location?` · ${ev.location}`:''}</div>
      </div>
      <button onClick={onCreate} style={{background:C.accentSoft,border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',color:C.accent,fontSize:18,flexShrink:0}}>+</button>
    </div>
  )
}
