import { useState } from 'react'
import { useStore } from '../store/store.jsx'
import { NoteCard, Empty, Btn, Field, CatChips, PriSelector, TaskCard, AISuggestion, Spin } from '../components/UI.jsx'
import { classifyTask } from '../services/ai.js'
import { C, CAT, uid } from '../utils/helpers.js'

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
      {showAdd&&<AddProjectModal onClose={()=>setShowAdd(false)}/>}
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
      {project.notes.length>0&&<div style={{color:C.textMuted,fontSize:11,marginTop:8}}>📝 {project.notes.length} note{project.notes.length!==1?'s':''}</div>}
    </div>
  )
}

function AddProjectModal({ onClose }) {
  const { addProject } = useStore()
  const [name,setName]=useState('')
  const [desc,setDesc]=useState('')
  const [cat, setCat] =useState('Projects')
  function save() {
    if(!name.trim()) return
    addProject({name:name.trim(),description:desc.trim(),category:cat})
    onClose()
  }
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:'20px 20px 0 0',width:'100%',padding:20,maxHeight:'90vh',overflowY:'auto'}}>
        <h3 style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:16}}>New Project</h3>
        <Field label="Project name *" value={name} onChange={setName} placeholder="e.g. Home Renovation 2026"/>
        <Field label="Description (optional)" value={desc} onChange={setDesc} placeholder="Brief description..." rows={2}/>
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

function AddTaskToProjectModal({ project, onClose }) {
  const { addTask, addNote, updateProject, apiKey } = useStore()
  const [title,  setTitle]  = useState('')
  const [desc,   setDesc]   = useState('')
  const [cat,    setCat]    = useState(project.category)
  const [pri,    setPri]    = useState(2)
  const [hasDue, setHasDue] = useState(false)
  const [due,    setDue]    = useState('')
  const [note,   setNote]   = useState('')
  const [raw,    setRaw]    = useState('')
  const [busy,   setBusy]   = useState(false)
  const [sug,    setSug]    = useState(null)
  const [err,    setErr]    = useState('')
  const [tab,    setTab]    = useState('manual')

  async function analyze() {
    if (!raw.trim()) return
    if (!apiKey) { setErr('Add your API key in Settings first.'); return }
    setBusy(true); setErr('')
    try {
      const r = await classifyTask(apiKey, raw)
      if (r) { setSug(r); setTitle(r.title||''); setDesc(r.description||''); setCat(r.category||project.category); setPri(r.priority||2); setTab('manual') }
      else setErr('AI could not parse. Fill manually below.')
    } catch(e) { setErr('AI error: '+e.message) }
    setBusy(false)
  }

  function save() {
    if (!title.trim()) { setErr('Please enter a task title.'); return }
    const task = addTask({ title:title.trim(), description:desc.trim(), category:cat, priority:pri, dueDate:hasDue&&due?new Date(due).toISOString():null, projectId:project.id })
    if (note.trim()) addNote(task.id, note.trim())
    if (sug) addNote(task.id, `AI classified: ${cat}, P${pri} (${Math.round(sug.confidence*100)}% confidence)`, true)
    updateProject(project.id, { taskIds:[...(project.taskIds||[]), task.id] })
    onClose()
  }

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:'20px 20px 0 0',width:'100%',padding:20,maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div>
            <h3 style={{color:C.text,fontSize:18,fontWeight:700}}>New Task</h3>
            <p style={{color:C.textMuted,fontSize:12,marginTop:2}}>Linked to: {project.name}</p>
          </div>
          <button onClick={onClose} style={{background:C.surface,border:'none',borderRadius:8,width:30,height:30,cursor:'pointer',color:C.textSec,fontSize:16}}>✕</button>
        </div>

        <div style={{display:'flex',background:C.surface,borderRadius:10,marginBottom:14,overflow:'hidden'}}>
          {[['manual','✏️ Manual'],['ai','✨ Ask AI']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{flex:1,border:'none',background:tab===k?C.accentSoft:'transparent',color:tab===k?C.accent:C.textMuted,padding:'9px 4px',fontSize:12,fontWeight:tab===k?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{l}</button>
          ))}
        </div>

        {tab==='ai'&&(
          <div style={{marginBottom:14}}>
            <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Describe the task... AI will fill in the details." rows={3} style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'11px 14px',color:C.text,fontSize:14,fontFamily:'Inter,sans-serif',resize:'none',outline:'none',marginBottom:10}}/>
            <Btn label={busy?'Analyzing...':'✨  Analyze with AI'} loading={busy} onClick={analyze}/>
          </div>
        )}

        {err&&<div style={{background:'rgba(255,94,94,0.1)',border:'1px solid rgba(255,94,94,0.3)',borderRadius:10,padding:'10px 14px',color:C.danger,fontSize:13,marginBottom:12}}>{err}</div>}
        {sug&&<AISuggestion s={sug}/>}

        <Field label="Title *" value={title} onChange={setTitle} placeholder="Task title"/>
        <Field label="Description (optional)" value={desc} onChange={setDesc} placeholder="More details..." rows={2}/>

        <div style={{marginBottom:14}}>
          <label style={{color:C.textSec,fontSize:12,fontWeight:500,display:'block',marginBottom:7}}>Category</label>
          <CatChips selected={cat} onSelect={setCat}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{color:C.textSec,fontSize:12,fontWeight:500,display:'block',marginBottom:7}}>Priority</label>
          <PriSelector selected={pri} onChange={setPri}/>
        </div>

        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:hasDue?8:0}}>
            <label style={{color:C.textSec,fontSize:12,fontWeight:500}}>Due Date</label>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
              <input type="checkbox" checked={hasDue} onChange={e=>setHasDue(e.target.checked)}/>
              <span style={{color:C.textSec,fontSize:12}}>Set deadline</span>
            </label>
          </div>
          {hasDue&&<input type="date" value={due} onChange={e=>setDue(e.target.value)} style={{width:'100%',background:C.card,border:`1px solid ${C.accent}`,borderRadius:10,padding:'10px 14px',color:C.text,fontSize:14,fontFamily:'Inter,sans-serif',outline:'none'}}/>}
        </div>

        <Field label="Initial Note (optional)" value={note} onChange={setNote} placeholder="Add action steps or context..." rows={2}/>
        <Btn label="Add Task to Project" onClick={save} disabled={!title.trim()}/>
        <button onClick={onClose} style={{width:'100%',marginTop:10,background:'none',border:'none',color:C.textSec,fontSize:14,cursor:'pointer',padding:10,fontFamily:'Inter,sans-serif'}}>Cancel</button>
      </div>
    </div>
  )
}

export function ProjectDetail() {
  const { projects, forProject, addProjectNote, updateProject, deleteProject, go, param } = useStore()
  const project = projects.find(p=>p.id===param)
  const [note,    setNote]    = useState('')
  const [showAdd, setShowAdd] = useState(false)

  if (!project) return <div style={{padding:32,textAlign:'center',color:C.textSec}}>Project not found.</div>

  const tasks = forProject(project.id)
  const done  = tasks.filter(t=>t.isCompleted).length
  const pct   = tasks.length ? done/tasks.length : 0
  const m     = CAT[project.category]||CAT.Projects

  function handleDelete() {
    if (window.confirm(`Delete project "${project.name}"?`)) { deleteProject(project.id); go('projects') }
  }

  return (
    <div style={{padding:'0 16px 100px'}}>
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <div style={{width:48,height:48,borderRadius:12,background:m.soft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>{m.icon}</div>
          <div style={{flex:1}}>
            <h2 style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:2}}>{project.name}</h2>
            <span style={{color:m.color,fontSize:12,fontWeight:600}}>{project.category}</span>
          </div>
        </div>
        {project.description&&<p style={{color:C.textSec,fontSize:13,marginBottom:12,lineHeight:1.5}}>{project.description}</p>}
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
          <span style={{color:C.textMuted,fontSize:12}}>{done}/{tasks.length} tasks completed</span>
          <span style={{color:m.color,fontSize:12,fontWeight:700}}>{Math.round(pct*100)}%</span>
        </div>
        <div style={{background:`${m.color}20`,borderRadius:4,height:8,overflow:'hidden'}}>
          <div style={{background:m.color,height:'100%',width:`${pct*100}%`,borderRadius:4,transition:'width 0.5s'}}/>
        </div>
      </div>

      <div style={{marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <h3 style={{color:C.text,fontSize:15,fontWeight:700}}>Tasks ({tasks.length})</h3>
          <button onClick={()=>setShowAdd(true)} style={{background:m.soft,border:`1px solid ${m.color}40`,borderRadius:10,padding:'6px 14px',color:m.color,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ Add Task</button>
        </div>
        {tasks.length===0
          ? <div style={{background:C.surface,borderRadius:12,padding:20,textAlign:'center'}}>
              <div style={{fontSize:32,marginBottom:8}}>📋</div>
              <p style={{color:C.textMuted,fontSize:13}}>No tasks yet.</p>
              <button onClick={()=>setShowAdd(true)} style={{marginTop:10,background:C.accentSoft,border:'none',borderRadius:10,padding:'8px 16px',color:C.accent,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Add your first task</button>
            </div>
          : tasks.map(t=><TaskCard key={t.id} task={t} onClick={()=>go('task',t.id)}/>)
        }
      </div>

      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:16}}>
        <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:12}}>📝 Project Notes</h3>
        {project.notes.length===0&&<p style={{color:C.textMuted,fontSize:13,marginBottom:12}}>No notes yet.</p>}
        {project.notes.map(n=><NoteCard key={n.id} note={n}/>)}
        <div style={{display:'flex',gap:8,marginTop:10,alignItems:'flex-end'}}>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a project note..." rows={2} style={{flex:1,background:C.surface,border:'none',borderRadius:10,padding:'10px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',resize:'none',outline:'none'}}/>
          <button onClick={()=>{if(note.trim()){addProjectNote(project.id,note.trim());setNote('')}}} style={{background:C.accentSoft,border:'none',borderRadius:10,width:40,height:40,cursor:'pointer',color:C.accent,fontSize:18,alignSelf:'flex-end',flexShrink:0}}>➤</button>
        </div>
      </div>

      <button onClick={handleDelete} style={{width:'100%',background:'rgba(255,94,94,0.08)',border:'1px solid rgba(255,94,94,0.2)',borderRadius:12,padding:12,color:C.danger,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>🗑 Delete Project</button>

      {showAdd&&<AddTaskToProjectModal project={project} onClose={()=>setShowAdd(false)}/>}
    </div>
  )
}
