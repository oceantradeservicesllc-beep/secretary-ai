import { useState, useEffect } from 'react'
import { useStore } from '../store/store.jsx'
import { TaskCard, Spin } from '../components/UI.jsx'
import { morningBriefing } from '../services/ai.js'
import { C, CAT, PRI } from '../utils/helpers.js'

export default function Dashboard() {
  const { activeTasks, overdueTasks, byCategory, byPriority, go, apiKey } = useStore()
  const [brief, setBrief] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadBrief() }, []) // eslint-disable-line

  async function loadBrief() {
    setLoading(true)
    if (apiKey) {
      try { setBrief(await morningBriefing(apiKey, activeTasks, overdueTasks.length)) }
      catch { setBrief(fallback()) }
    } else { setBrief(fallback()) }
    setLoading(false)
  }

  function fallback() {
    const p1 = activeTasks.filter(t=>t.priority===1)
    let s = `Good morning! You have ${activeTasks.length} active task${activeTasks.length!==1?'s':''}.`
    if (p1.length) s += `\n🔴 ${p1.length} high-priority item${p1.length!==1?'s':''} need attention.`
    if (overdueTasks.length) s += `\n⚠️ ${overdueTasks.length} task${overdueTasks.length!==1?'s are':' is'} overdue.`
    if (!p1.length&&!overdueTasks.length) s += '\n✅ No urgent items — you\'re on top of things!'
    return s
  }

  const today = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})

  return (
    <div style={{padding:'0 16px 100px'}}>
      {/* Briefing */}
      <div style={{background:'linear-gradient(135deg,rgba(108,99,255,0.18),rgba(255,101,132,0.08))',border:`1px solid rgba(108,99,255,0.3)`,borderRadius:16,padding:16,marginBottom:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{color:C.accent,fontSize:13,fontWeight:700}}>✨ AI Morning Briefing</span>
          <span style={{color:C.textMuted,fontSize:11}}>{today}</span>
        </div>
        {loading
          ? <div style={{display:'flex',alignItems:'center',gap:8}}><Spin size={14} color={C.accent}/><span style={{color:C.textSec,fontSize:13}}>Preparing your briefing...</span></div>
          : <p style={{color:C.text,fontSize:13,lineHeight:1.7,whiteSpace:'pre-line'}}>{brief}</p>
        }
        <button onClick={loadBrief} style={{marginTop:10,background:'none',border:`1px solid rgba(108,99,255,0.3)`,borderRadius:8,padding:'5px 12px',color:C.accent,fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>↻ Refresh</button>
      </div>

      {/* Priority pills */}
      <div style={{display:'flex',gap:10,marginBottom:20}}>
        {[1,2,3].map(p=>{
          const m=PRI[p]; const cnt=byPriority(p).length
          return <div key={p} onClick={()=>go('priority',p)} style={{flex:1,background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:'12px 6px',textAlign:'center',cursor:'pointer'}}>
            <div style={{fontSize:20}}>{m.emoji}</div>
            <div style={{color:m.color,fontSize:22,fontWeight:800,marginTop:2}}>{cnt}</div>
            <div style={{color:C.textMuted,fontSize:11}}>{m.short}</div>
          </div>
        })}
      </div>

      {/* Categories */}
      <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:10}}>Categories</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:20}}>
        {Object.entries(CAT).map(([cat,m])=>{
          const cnt=byCategory(cat).length
          return <div key={cat} onClick={()=>go('category',cat)} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:'10px 12px',display:'flex',alignItems:'center',gap:9,cursor:'pointer'}}>
            <div style={{width:36,height:36,borderRadius:9,background:m.soft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>{m.icon}</div>
            <div style={{minWidth:0}}>
              <div style={{color:C.text,fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cat}</div>
              <div style={{color:C.textMuted,fontSize:11}}>{cnt} active</div>
            </div>
          </div>
        })}
      </div>

      {/* Overdue */}
      {overdueTasks.length>0&&(
        <div style={{background:'rgba(255,94,94,0.05)',border:'1px solid rgba(255,94,94,0.2)',borderRadius:14,padding:14,marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <span style={{color:C.danger,fontSize:14,fontWeight:700}}>⚠️ Needs Attention</span>
            <span style={{background:C.danger,color:'#fff',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:10}}>{overdueTasks.length}</span>
          </div>
          {overdueTasks.slice(0,3).map(t=>(
            <div key={t.id} onClick={()=>go('task',t.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:`1px solid rgba(255,94,94,0.1)`,cursor:'pointer'}}>
              <span style={{fontSize:14}}>{CAT[t.category]?.icon}</span>
              <span style={{color:C.text,fontSize:13,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</span>
              <span style={{color:PRI[t.priority]?.color,fontSize:11,fontWeight:700}}>P{t.priority}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top tasks */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <h3 style={{color:C.text,fontSize:15,fontWeight:700}}>Top Priority Tasks</h3>
        <button onClick={()=>go('tasks')} style={{background:'none',border:'none',color:C.accent,fontSize:13,cursor:'pointer',fontWeight:500,fontFamily:'Inter,sans-serif'}}>See All</button>
      </div>
      {activeTasks.length===0
        ? <div style={{textAlign:'center',padding:32}}><div style={{fontSize:44}}>✅</div><p style={{color:C.textSec,marginTop:10}}>All caught up! Tap + to add a task.</p></div>
        : activeTasks.slice(0,6).map(t=><TaskCard key={t.id} task={t} onClick={()=>go('task',t.id)}/>)
      }
    </div>
  )
}
