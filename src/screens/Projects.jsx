import { useState } from 'react'
import { useStore } from '../store/store.jsx'
import { NoteCard, Empty, Btn, Field, CatChips, TaskCard } from '../components/UI.jsx'
import { C, CAT } from '../utils/helpers.js'

export default function Projects() {
  const { projects, go } = useStore()
  const [showAdd, setShowAdd] = useState(false)
  return (
    <div style={{padding:'0 16px 100px'}}>
      {projects.length===0&&!showAdd
        ? <Empty emoji="📁" title="No projects yet" sub="Group related tasks into projects." action="Create Project" onAction={()=>setShowAdd(true)}/>
        : <>
            {projects.map(p=><ProjectCard key={p.id} project={p} onClick={()=>go('project',p.id)}/>)}
            <button onClick={()=>setShowAdd(true)} style={{width:'100%',background:C.accentSoft,border:`1px dashed ${C.accent}`,borderRadius:14,padding:14,color:C.accent,fontSize:14,fontWeight:600,cursor:'pointer',marginTop:8,fontFamily:'Inter,sans-serif'}}>+ New Project</button>
          </>
      }
      {showAdd&&<AddModal onClose={()=>setShowAdd(false)}/>}
    </div>
  )
}

function ProjectCard({ project, onClick }) {
  const { forProject } = useStore()
  const tasks=forProject(project.id)
  const done=tasks.filter(t=>t.isCompleted).length
  const pct=tasks.length?done/tasks.length:0
  const m=CAT[project.category]||CAT.Projects
  return (
    <div onClick={onClick} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:10,cursor:'pointer'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
        <div style={{width:40,height:40,borderRadius:10,background:m.soft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{m.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:C.text,fontSize:14,fontWeight:600,marginBottom:2}}>{project.name}</div>
          <div style={{color:m.color,fontSize:11,fontWeight:600}}>{project.category}</div>
        </div>
        {project.isCompleted&&<span style={{color:C.success,fontSize:18}}>✅</span>}
      </div>
      {project.description&&<p style={{color:C.textSec,fontSize:13,marginBottom:10,lineHeight:1.4}}>{project.description}</p>}
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{color:C.textMuted,fontSize:11}}>{done}/{tasks.length} tasks</span>
        <span style={{color:m.color,fontSize:11,fontWeight:600}}>{Math.round(pct*100)}%</span>
      </div>
      <div style={{background:`${m.color}20`,borderRadius:4,height:5,overflow:'hidden'}}>
        <div style={{background:m.color,height:'100%',width:`${pct*100}%`,borderRadius:4}}/>
      </div>
    </div>
  )
}

function AddModal({ onClose }) {
  const { addProject } = useStore()
  const [name,setName]=useState('')
  const [desc,setDesc]=useState('')
  const [cat, setCat] =useState('Projects')
  function save() { if(!name.trim()) return; addProject({name:name.trim(),description:desc.trim(),category:cat}); onClose() }
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:'20px 20px 0 0',width:'100%',padding:20}}>
        <h3 style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:16}}>New Project</h3>
        <Field label="Project name *" value={name} onChange={setName} placeholder="e.g. Home Renovation 2026"/>
        <Field label="Description" value={desc} onChange={setDesc} placeholder="Brief description…" rows={2}/>
        <div style={{marginBottom:14}}>
          <label style={{color:C.textSec,fontSize:12,fontWeight:500,display:'block',marginBottom:7}}>Category</label>
          <CatChips selected={cat} onSelect={setCat}/>
        </div>
        <Btn label="Create Project" onClick={save} disabled={!name.trim()}/>
        <button onClick={onClose} style={{width:'100%',marginTop:10,background:'none',border:'none',color:C.textSec,fontSize:14,cursor:'pointer',padding:10,fontFamily:'Inter,sans-serif'}}>Cancel</button>
      </div>
    </div>
  )
}

export function ProjectDetail() {
  const { projects, forProject, addProjectNote, go, param } = useStore()
  const project=projects.find(p=>p.id===param)
  const [note,setNote]=useState('')
  if (!project) return <div style={{padding:32,textAlign:'center',color:C.textSec}}>Project not found.</div>
  const tasks=forProject(project.id)
  const done=tasks.filter(t=>t.isCompleted).length
  const pct=tasks.length?done/tasks.length:0
  const m=CAT[project.category]||CAT.Projects
  return (
    <div style={{padding:'0 16px 100px'}}>
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
          <span style={{fontSize:28}}>{m.icon}</span>
          <div>
            <div style={{color:m.color,fontSize:12,fontWeight:600}}>{project.category}</div>
            {project.description&&<div style={{color:C.textSec,fontSize:13}}>{project.description}</div>}
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
          <span style={{color:C.textMuted,fontSize:12}}>{done}/{tasks.length} tasks</span>
          <span style={{color:m.color,fontSize:12,fontWeight:700}}>{Math.round(pct*100)}%</span>
        </div>
        <div style={{background:`${m.color}20`,borderRadius:4,height:7,overflow:'hidden'}}>
          <div style={{background:m.color,height:'100%',width:`${pct*100}%`,borderRadius:4}}/>
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <h3 style={{color:C.text,fontSize:15,fontWeight:700}}>Tasks ({tasks.length})</h3>
          <button onClick={()=>go('addTask')} style={{background:C.accentSoft,border:'none',borderRadius:8,padding:'5px 12px',color:C.accent,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ Add Task</button>
        </div>
        {tasks.length===0
          ? <p style={{color:C.textMuted,fontSize:13}}>No tasks yet.</p>
          : tasks.map(t=><TaskCard key={t.id} task={t} onClick={()=>go('task',t.id)}/>)
        }
      </div>
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14}}>
        <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:12}}>📝 Project Notes</h3>
        {project.notes.map(n=><NoteCard key={n.id} note={n}/>)}
        <div style={{display:'flex',gap:8,marginTop:10}}>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a project note…" rows={2} style={{flex:1,background:C.surface,border:'none',borderRadius:10,padding:'10px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',resize:'none',outline:'none'}}/>
          <button onClick={()=>{if(note.trim()){addProjectNote(project.id,note.trim());setNote('')}}} style={{background:C.accentSoft,border:'none',borderRadius:10,width:40,height:40,cursor:'pointer',color:C.accent,fontSize:18,alignSelf:'flex-end'}}>➤</button>
        </div>
      </div>
    </div>
  )
}
