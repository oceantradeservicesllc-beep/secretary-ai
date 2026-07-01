import { useState } from 'react'
import { useStore } from '../store/store.jsx'
import { TaskCard, Empty } from '../components/UI.jsx'
import { C, CAT, PRI } from '../utils/helpers.js'

export default function Tasks() {
  const { tasks, activeTasks, go } = useStore()
  const [tab,    setTab]    = useState('active')
  const [search, setSearch] = useState('')
  const [sort,   setSort]   = useState('priority')

  const completed = tasks.filter(t=>t.isCompleted)
  const pool = (tab==='active'?activeTasks:completed)
    .filter(t=>!search||t.title.toLowerCase().includes(search.toLowerCase())||t.category.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{
      if(sort==='dueDate') return (new Date(a.dueDate||'2099'))-(new Date(b.dueDate||'2099'))
      if(sort==='category') return a.category.localeCompare(b.category)
      if(sort==='created') return new Date(b.createdAt)-new Date(a.createdAt)
      return a.priority-b.priority
    })

  return (
    <div style={{padding:'0 16px 100px'}}>
      <div style={{display:'flex',background:C.card,borderRadius:12,marginBottom:12,overflow:'hidden'}}>
        {[['active',`Active (${activeTasks.length})`],['done',`Done (${completed.length})`]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,border:'none',background:tab===k?C.accentSoft:'transparent',color:tab===k?C.accent:C.textMuted,padding:'11px 8px',fontSize:13,fontWeight:tab===k?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{l}</button>
        ))}
      </div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks…" style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 10px',color:C.textSec,fontSize:12,outline:'none',cursor:'pointer'}}>
          <option value="priority">Priority</option>
          <option value="dueDate">Due Date</option>
          <option value="category">Category</option>
          <option value="created">Newest</option>
        </select>
      </div>
      {pool.length===0
        ? <Empty emoji={tab==='active'?'✅':'📋'} title={tab==='active'?'No active tasks':'No completed tasks'} sub={tab==='active'?'Tap + to add your first task':'Complete tasks to see them here'}/>
        : pool.map(t=><TaskCard key={t.id} task={t} onClick={()=>go('task',t.id)}/>)
      }
    </div>
  )
}

export function CategoryDetail() {
  const { tasks, byCategory, go, param } = useStore()
  const cat=param; const m=CAT[cat]||CAT.Work
  const active=byCategory(cat)
  const done=tasks.filter(t=>t.category===cat&&t.isCompleted)
  const [tab,setTab]=useState('active')
  const list=tab==='active'?active:done
  return (
    <div style={{padding:'0 16px 100px'}}>
      <div style={{background:`${m.color}12`,border:`1px solid ${m.color}30`,borderRadius:14,padding:'14px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:14}}>
        <div style={{width:50,height:50,borderRadius:'50%',background:m.soft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>{m.icon}</div>
        <div>
          <div style={{color:C.text,fontSize:18,fontWeight:700}}>{cat}</div>
          <div style={{display:'flex',gap:10}}>
            <span style={{color:m.color,fontSize:12,fontWeight:600}}>{active.length} active</span>
            <span style={{color:C.textMuted,fontSize:12}}>·</span>
            <span style={{color:C.success,fontSize:12}}>{done.length} done</span>
          </div>
        </div>
      </div>
      <div style={{display:'flex',background:C.card,borderRadius:12,marginBottom:12,overflow:'hidden'}}>
        {[['active',`Active (${active.length})`],['done',`Done (${done.length})`]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,border:'none',background:tab===k?C.accentSoft:'transparent',color:tab===k?C.accent:C.textMuted,padding:10,fontSize:13,fontWeight:tab===k?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{l}</button>
        ))}
      </div>
      {list.length===0
        ? <Empty emoji="🎯" title={`No ${tab} tasks`} sub={`Nothing ${tab==='active'?'active':'completed'} in ${cat}`}/>
        : list.map(t=><TaskCard key={t.id} task={t} onClick={()=>go('task',t.id)}/>)
      }
    </div>
  )
}

export function PriorityDetail() {
  const { byPriority, go, param } = useStore()
  const p=param; const m=PRI[p]||PRI[2]; const list=byPriority(p)
  return (
    <div style={{padding:'0 16px 100px'}}>
      <div style={{background:`${m.color}12`,border:`1px solid ${m.color}30`,borderRadius:14,padding:16,marginBottom:16,display:'flex',alignItems:'center',gap:14}}>
        <span style={{fontSize:36}}>{m.emoji}</span>
        <div>
          <div style={{color:C.text,fontSize:17,fontWeight:700}}>{m.label}</div>
          <div style={{color:m.color,fontSize:13}}>{list.length} task{list.length!==1?'s':''}</div>
        </div>
      </div>
      {list.length===0
        ? <Empty emoji="✅" title="No tasks here" sub="No active tasks at this priority level"/>
        : list.map(t=><TaskCard key={t.id} task={t} onClick={()=>go('task',t.id)}/>)
      }
    </div>
  )
}
