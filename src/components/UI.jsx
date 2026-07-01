import { C, CAT, PRI, fmtDate, fmtRel, isOverdue, CATEGORIES } from '../utils/helpers.js'

export function TaskCard({ task, onClick }) {
  const cat = CAT[task.category]||CAT.Work
  const pri = PRI[task.priority]||PRI[2]
  const over = isOverdue(task)
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'stretch',background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,marginBottom:8,overflow:'hidden',cursor:'pointer'}}>
      <div style={{width:4,background:pri.color,flexShrink:0}}/>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',flex:1}}>
        <div style={{width:34,height:34,borderRadius:9,background:cat.soft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{cat.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:task.isCompleted?C.textMuted:C.text,fontSize:13,fontWeight:500,textDecoration:task.isCompleted?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{task.title}</div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginTop:3}}>
            <span style={{color:cat.color,fontSize:11,fontWeight:600}}>{task.category}</span>
            {task.dueDate&&<><span style={{color:C.textMuted,fontSize:10}}>·</span><span style={{color:over?C.danger:C.textMuted,fontSize:11}}>{fmtDate(task.dueDate)}</span></>}
            {task.notes?.length>0&&<span style={{color:C.textMuted,fontSize:10}}>📝</span>}
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
          <span style={{background:pri.soft,color:pri.color,fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:6}}>{pri.short}</span>
          {over&&<span style={{color:C.danger,fontSize:9,fontWeight:700}}>OVERDUE</span>}
        </div>
      </div>
    </div>
  )
}

export function NoteCard({ note }) {
  return (
    <div style={{background:note.isAI?C.aiSoft:C.surface,border:`1px solid ${note.isAI?'rgba(255,215,0,0.25)':'transparent'}`,borderRadius:10,padding:'10px 12px',marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{color:note.isAI?C.aiGold:C.textSec,fontSize:11,fontWeight:600}}>{note.isAI?'✨ AI Note':'👤 You'}</span>
        <span style={{color:C.textMuted,fontSize:10}}>{fmtRel(note.createdAt)}</span>
      </div>
      <p style={{color:C.text,fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{note.content}</p>
    </div>
  )
}

export function AISuggestion({ s }) {
  if (!s) return null
  const cat=CAT[s.category]||CAT.Work
  const pri=PRI[s.priority]||PRI[2]
  return (
    <div style={{background:C.aiSoft,border:`1.5px solid rgba(255,215,0,0.35)`,borderRadius:14,padding:14,marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
        <span style={{color:C.aiGold,fontSize:13,fontWeight:700}}>✨ AI Suggestion</span>
        <span style={{color:C.textMuted,fontSize:11}}>{Math.round(s.confidence*100)}% confidence</span>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <span style={{color:cat.color,fontSize:12,fontWeight:600}}>{cat.icon} {s.category}</span>
        <span style={{background:pri.soft,color:pri.color,fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6}}>{pri.short}</span>
      </div>
      <div style={{color:C.text,fontSize:14,fontWeight:600,marginBottom:4}}>{s.title}</div>
      {s.description&&<div style={{color:C.textSec,fontSize:12,lineHeight:1.5}}>{s.description}</div>}
    </div>
  )
}

export function Btn({ label, onClick, loading, color, disabled }) {
  return (
    <button onClick={onClick} disabled={loading||disabled} style={{width:'100%',border:'none',borderRadius:12,padding:'13px 20px',fontSize:14,fontWeight:600,cursor:loading||disabled?'not-allowed':'pointer',background:loading||disabled?C.surface:color||C.accent,color:loading||disabled?C.textMuted:'#fff',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
      {loading?<Spin/>:label}
    </button>
  )
}

export function Spin({ size=16, color='#fff' }) {
  return (
    <>
      <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:size,height:size,border:`2px solid rgba(255,255,255,0.2)`,borderTopColor:color,borderRadius:'50%',animation:'_spin 0.8s linear infinite'}}/>
    </>
  )
}

export function CatChips({ selected, onSelect }) {
  return (
    <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:4}}>
      {CATEGORIES.map(cat=>{
        const m=CAT[cat]; const a=selected===cat
        return <button key={cat} onClick={()=>onSelect(cat)} style={{border:`1px solid ${a?m.color:C.border}`,borderRadius:20,padding:'5px 12px',background:a?m.color:C.card,color:a?'#fff':C.textSec,fontSize:12,fontWeight:a?600:400,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'Inter,sans-serif',flexShrink:0}}>{m.icon} {cat}</button>
      })}
    </div>
  )
}

export function PriSelector({ selected, onChange }) {
  return (
    <div style={{display:'flex',gap:8}}>
      {[1,2,3].map(p=>{
        const m=PRI[p]; const a=selected===p
        return <button key={p} onClick={()=>onChange(p)} style={{flex:1,border:'none',borderRadius:10,padding:'10px 4px',background:a?m.color:m.soft,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'center'}}>
          <div style={{fontSize:18}}>{m.emoji}</div>
          <div style={{color:a?'#fff':m.color,fontSize:12,fontWeight:700,marginTop:2}}>P{p}</div>
          <div style={{color:a?'rgba(255,255,255,0.8)':C.textMuted,fontSize:10}}>{p===1?'High':p===2?'Medium':'Low'}</div>
        </button>
      })}
    </div>
  )
}

export function Field({ label, value, onChange, placeholder, rows }) {
  const style={width:'100%',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'11px 14px',color:C.text,fontSize:14,fontFamily:'Inter,sans-serif',outline:'none',resize:'vertical'}
  return (
    <div style={{marginBottom:14}}>
      {label&&<label style={{color:C.textSec,fontSize:12,fontWeight:500,display:'block',marginBottom:5}}>{label}</label>}
      {rows
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={style}/>
        : <input   value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={style}/>
      }
    </div>
  )
}

export function Empty({ emoji, title, sub, action, onAction }) {
  return (
    <div style={{textAlign:'center',padding:'48px 20px'}}>
      <div style={{fontSize:52,marginBottom:14}}>{emoji}</div>
      <h3 style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:6}}>{title}</h3>
      <p style={{color:C.textSec,fontSize:13}}>{sub}</p>
      {action&&<button onClick={onAction} style={{marginTop:16,background:C.accent,color:'#fff',border:'none',borderRadius:12,padding:'10px 20px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{action}</button>}
    </div>
  )
}

export function SecHead({ title, action, onAction }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
      <h3 style={{color:C.text,fontSize:15,fontWeight:700}}>{title}</h3>
      {action&&<button onClick={onAction} style={{background:'none',border:'none',color:C.accent,fontSize:13,cursor:'pointer',fontWeight:500,fontFamily:'Inter,sans-serif'}}>{action}</button>}
    </div>
  )
}
