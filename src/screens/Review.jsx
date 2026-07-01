import { useState, useEffect } from 'react'
import { useStore } from '../store/store.jsx'
import { Spin } from '../components/UI.jsx'
import { weeklyReview } from '../services/ai.js'
import { C, CAT } from '../utils/helpers.js'

export default function Review() {
  const { weeklyStats, go, apiKey } = useStore()
  const stats = weeklyStats()
  const [review,   setReview]   = useState('')
  const [loading,  setLoading]  = useState(false)
  useEffect(()=>{ load() },[]) // eslint-disable-line
  async function load() {
    setLoading(true)
    if (apiKey) { try { setReview(await weeklyReview(apiKey,stats)) } catch { setReview(fallback()) } }
    else setReview(fallback())
    setLoading(false)
  }
  function fallback() {
    const pct=stats.total?Math.round(stats.rate*100):0
    return `This week: ${stats.completed}/${stats.total} tasks completed (${pct}%). ${stats.overdue.length?`${stats.overdue.length} tasks need attention.`:'No overdue tasks — great work!'}`
  }
  const rate=stats.total?Math.round(stats.rate*100):0
  return (
    <div style={{padding:'0 16px 100px'}}>
      {/* Stat cells */}
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        {[['Total',stats.total,'#45B7D1'],['Done',stats.completed,C.success],['Rate',`${rate}%`,C.accent],['Overdue',stats.overdue.length,C.danger]].map(([l,v,color])=>(
          <div key={l} style={{flex:1,background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'10px 4px',textAlign:'center'}}>
            <div style={{color,fontSize:20,fontWeight:800}}>{v}</div>
            <div style={{color:C.textMuted,fontSize:10,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:7}}>
          <span style={{color:C.textSec,fontSize:12}}>Completion Rate</span>
          <span style={{color:C.accent,fontSize:13,fontWeight:700}}>{rate}%</span>
        </div>
        <div style={{background:C.accentSoft,borderRadius:4,height:8,overflow:'hidden'}}>
          <div style={{background:C.accent,height:'100%',width:`${rate}%`,borderRadius:4,transition:'width 0.6s'}}/>
        </div>
      </div>

      {/* By category */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
        <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:12}}>By Category</h3>
        {Object.entries(stats.byCat).filter(([,v])=>v.total>0).map(([cat,v])=>{
          const m=CAT[cat]||CAT.Work
          return (
            <div key={cat} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <span style={{fontSize:14,width:20}}>{m.icon}</span>
              <span style={{color:C.textSec,fontSize:12,width:72}}>{cat}</span>
              <div style={{flex:1,background:`${m.color}20`,borderRadius:3,height:6,overflow:'hidden'}}>
                <div style={{background:m.color,height:'100%',width:`${v.rate*100}%`,borderRadius:3}}/>
              </div>
              <span style={{color:C.textMuted,fontSize:11,width:35,textAlign:'right'}}>{v.completed}/{v.total}</span>
            </div>
          )
        })}
        {Object.values(stats.byCat).every(v=>v.total===0)&&<p style={{color:C.textMuted,fontSize:13}}>No tasks this week yet.</p>}
      </div>

      {/* AI review */}
      <div style={{background:C.aiSoft,border:`1px solid rgba(255,215,0,0.25)`,borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{color:C.aiGold,fontSize:13,fontWeight:700}}>✨ AI Weekly Review</span>
          <button onClick={load} style={{background:'none',border:'none',color:C.aiGold,cursor:'pointer',fontSize:15}}>↻</button>
        </div>
        {loading
          ? <div style={{display:'flex',alignItems:'center',gap:8}}><Spin size={14} color={C.aiGold}/><span style={{color:C.textSec,fontSize:13}}>Generating your review…</span></div>
          : <p style={{color:C.text,fontSize:13,lineHeight:1.7,whiteSpace:'pre-line'}}>{review}</p>
        }
      </div>

      {/* Overdue */}
      {stats.overdue.length>0&&(
        <div style={{background:'rgba(255,94,94,0.05)',border:'1px solid rgba(255,94,94,0.2)',borderRadius:14,padding:14}}>
          <h3 style={{color:C.danger,fontSize:14,fontWeight:700,marginBottom:8}}>⚠️ Needs Attention ({stats.overdue.length})</h3>
          <p style={{color:C.textMuted,fontSize:12,marginBottom:10}}>Open for 7+ days:</p>
          {stats.overdue.slice(0,5).map(t=>(
            <div key={t.id} onClick={()=>go('task',t.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:`1px solid rgba(255,94,94,0.1)`,cursor:'pointer'}}>
              <span style={{fontSize:13}}>{CAT[t.category]?.icon}</span>
              <div style={{flex:1}}>
                <div style={{color:C.text,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                <div style={{color:C.textMuted,fontSize:11}}>{Math.floor((Date.now()-new Date(t.createdAt))/86400000)}d old · {t.category}</div>
              </div>
              <span style={{color:C.danger,fontSize:11,fontWeight:700}}>P{t.priority}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
