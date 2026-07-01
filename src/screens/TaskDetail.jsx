import { useState } from 'react'
import { useStore } from '../store/store.jsx'
import { NoteCard, Btn, Spin, Field, CatChips, PriSelector } from '../components/UI.jsx'
import { smartNotes } from '../services/ai.js'
import { C, CAT, PRI, fmtDate, fmtRel } from '../utils/helpers.js'

export default function TaskDetail() {
  const { tasks, completeTask, deleteTask, addNote, updateTask, go, param, apiKey } = useStore()
  const task = tasks.find(t => t.id === param)

  const [editing,   setEditing]   = useState(false)
  const [noteText,  setNoteText]  = useState('')
  const [genAI,     setGenAI]     = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [saving,    setSaving]    = useState(false)

  // Edit form state
  const [editTitle, setEditTitle] = useState('')
  const [editDesc,  setEditDesc]  = useState('')
  const [editCat,   setEditCat]   = useState('Work')
  const [editPri,   setEditPri]   = useState(2)
  const [editHasDue,setEditHasDue]= useState(false)
  const [editDue,   setEditDue]   = useState('')

  if (!task) return <div style={{padding:32,textAlign:'center',color:C.textSec}}>Task not found.</div>

  const cat  = CAT[task.category] || CAT.Work
  const pri  = PRI[task.priority] || PRI[2]
  const over = !task.isCompleted && task.dueDate && new Date(task.dueDate) < new Date()

  function startEditing() {
    setEditTitle(task.title)
    setEditDesc(task.description || '')
    setEditCat(task.category)
    setEditPri(task.priority)
    setEditHasDue(!!task.dueDate)
    setEditDue(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '')
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
  }

  function saveEdits() {
    if (!editTitle.trim()) return
    setSaving(true)
    updateTask(task.id, {
      title:       editTitle.trim(),
      description: editDesc.trim(),
      category:    editCat,
      priority:    editPri,
      dueDate:     editHasDue && editDue ? new Date(editDue).toISOString() : null,
    })
    setSaving(false)
    setEditing(false)
  }

  async function genNote() {
    if (!apiKey) { alert('Add your API key in ⚙️ Settings first.'); return }
    setGenAI(true)
    try {
      const n = await smartNotes(apiKey, task.title, task.category, task.description)
      if (n) addNote(task.id, n, true)
    } catch(e) { alert('AI error: ' + e.message) }
    setGenAI(false)
  }

  function submitNote() {
    if (!noteText.trim()) return
    addNote(task.id, noteText.trim())
    setNoteText('')
  }

  async function archive() {
    setArchiving(true)
    await new Promise(r => setTimeout(r, 900))
    addNote(task.id, `✅ Archived to OneNote: ${task.category} section`, true)
    updateTask(task.id, { isArchivedToOneNote: true })
    setArchiving(false)
  }

  function del() {
    if (window.confirm(`Delete "${task.title}"?`)) {
      deleteTask(task.id)
      go('tasks')
    }
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div style={{padding:'0 16px 100px'}}>
        {/* Edit header */}
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <h2 style={{color:C.text,fontSize:18,fontWeight:700}}>Edit Task</h2>
            <button onClick={cancelEditing} style={{background:C.surface,border:'none',borderRadius:8,width:30,height:30,cursor:'pointer',color:C.textSec,fontSize:16}}>✕</button>
          </div>

          <Field label="Title *" value={editTitle} onChange={setEditTitle} placeholder="Task title"/>
          <Field label="Description (optional)" value={editDesc} onChange={setEditDesc} placeholder="More details..." rows={3}/>

          <div style={{marginBottom:14}}>
            <label style={{color:C.textSec,fontSize:12,fontWeight:500,display:'block',marginBottom:7}}>Category</label>
            <CatChips selected={editCat} onSelect={setEditCat}/>
          </div>

          <div style={{marginBottom:14}}>
            <label style={{color:C.textSec,fontSize:12,fontWeight:500,display:'block',marginBottom:7}}>Priority</label>
            <PriSelector selected={editPri} onChange={setEditPri}/>
          </div>

          <div style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:editHasDue?8:0}}>
              <label style={{color:C.textSec,fontSize:12,fontWeight:500}}>Due Date</label>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input type="checkbox" checked={editHasDue} onChange={e=>setEditHasDue(e.target.checked)}/>
                <span style={{color:C.textSec,fontSize:12}}>Set deadline</span>
              </label>
            </div>
            {editHasDue && (
              <input
                type="date"
                value={editDue}
                onChange={e=>setEditDue(e.target.value)}
                style={{width:'100%',background:C.card,border:`1px solid ${C.accent}`,borderRadius:10,padding:'10px 14px',color:C.text,fontSize:14,fontFamily:'Inter,sans-serif',outline:'none'}}
              />
            )}
          </div>

          <div style={{display:'flex',gap:10}}>
            <button onClick={cancelEditing} style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:12,color:C.textSec,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              Cancel
            </button>
            <button onClick={saveEdits} disabled={saving||!editTitle.trim()} style={{flex:2,background:saving||!editTitle.trim()?C.surface:C.accent,border:'none',borderRadius:12,padding:12,color:saving||!editTitle.trim()?C.textMuted:'#fff',fontSize:14,fontWeight:600,cursor:saving||!editTitle.trim()?'not-allowed':'pointer',fontFamily:'Inter,sans-serif'}}>
              {saving ? 'Saving...' : '✓ Save Changes'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
  return (
    <div style={{padding:'0 16px 100px'}}>

      {/* Header card */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div style={{width:42,height:42,borderRadius:12,background:cat.soft,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{cat.icon}</div>
          <div>
            <div style={{color:cat.color,fontSize:12,fontWeight:600}}>{task.category}</div>
            <div style={{color:pri.color,fontSize:12}}>{pri.label}</div>
          </div>
          <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
            {task.isCompleted && <span style={{background:'rgba(82,201,134,0.15)',color:C.success,fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:8}}>Done</span>}
            {over && <span style={{background:'rgba(255,94,94,0.15)',color:C.danger,fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:8}}>OVERDUE</span>}
            {/* Edit button */}
            <button onClick={startEditing} style={{background:C.accentSoft,border:`1px solid rgba(108,99,255,0.3)`,borderRadius:9,padding:'5px 12px',color:C.accent,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:5}}>
              ✏️ Edit
            </button>
          </div>
        </div>

        <h2 style={{color:task.isCompleted?C.textMuted:C.text,fontSize:20,fontWeight:700,marginBottom:6,textDecoration:task.isCompleted?'line-through':'none',lineHeight:1.3}}>
          {task.title}
        </h2>

        {task.dueDate && (
          <div style={{color:over?C.danger:C.textMuted,fontSize:13,display:'flex',alignItems:'center',gap:5}}>
            📅 <span>{fmtDate(task.dueDate)}</span>
          </div>
        )}
      </div>

      {/* Complete button */}
      {!task.isCompleted && (
        <div style={{marginBottom:14}}>
          <Btn label="✓  Mark as Complete" color={C.success} onClick={()=>completeTask(task.id)}/>
        </div>
      )}

      {/* Description */}
      {task.description && (
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
          <div style={{color:C.accent,fontSize:12,fontWeight:600,marginBottom:6}}>📄 Description</div>
          <p style={{color:C.text,fontSize:14,lineHeight:1.6}}>{task.description}</p>
        </div>
      )}

      {/* Notes section */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <span style={{color:C.text,fontSize:14,fontWeight:700}}>📝 Notes & Updates</span>
          <button onClick={genNote} disabled={genAI} style={{background:'rgba(255,215,0,0.12)',border:'1px solid rgba(255,215,0,0.3)',borderRadius:8,padding:'5px 10px',color:C.aiGold,fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontFamily:'Inter,sans-serif'}}>
            {genAI ? <Spin size={11} color={C.aiGold}/> : '✨'} AI Notes
          </button>
        </div>
        {task.notes?.length === 0 && <p style={{color:C.textMuted,fontSize:13,marginBottom:12}}>No notes yet. Add one or tap AI Notes.</p>}
        {task.notes?.map(n => <NoteCard key={n.id} note={n}/>)}
        <div style={{display:'flex',gap:8,marginTop:10,alignItems:'flex-end'}}>
          <textarea
            value={noteText}
            onChange={e=>setNoteText(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            style={{flex:1,background:C.surface,border:'none',borderRadius:10,padding:'10px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',resize:'none',outline:'none'}}
          />
          <button onClick={submitNote} style={{background:C.accentSoft,border:'none',borderRadius:10,width:40,height:40,cursor:'pointer',color:C.accent,fontSize:18,flexShrink:0}}>➤</button>
        </div>
      </div>

      {/* OneNote Archive */}
      {task.isCompleted && (
        <div style={{marginBottom:14}}>
          <Btn
            label={archiving?'Archiving...':task.isArchivedToOneNote?'✅ Archived to OneNote':'📒  Archive to OneNote'}
            color="#0078D4"
            loading={archiving}
            disabled={task.isArchivedToOneNote}
            onClick={archive}
          />
        </div>
      )}

      {/* Metadata */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{color:C.text,fontSize:13,fontWeight:600,marginBottom:10}}>ℹ️ Details</div>
        {[
          ['Created',  fmtDate(task.createdAt)],
          ['Updated',  fmtRel(task.updatedAt)],
          task.dueDate      && ['Due',       fmtDate(task.dueDate)],
          task.completedAt  && ['Completed', fmtDate(task.completedAt)],
          task.tags?.length > 0 && ['Tags', task.tags.map(t=>`#${t}`).join(', ')],
        ].filter(Boolean).map(([l, v]) => (
          <div key={l} style={{display:'flex',gap:12,paddingBottom:6,marginBottom:6,borderBottom:`1px solid ${C.border}`}}>
            <span style={{color:C.textMuted,fontSize:12,width:75,flexShrink:0}}>{l}</span>
            <span style={{color:C.textSec,fontSize:12}}>{v}</span>
          </div>
        ))}
      </div>

      {/* Delete */}
      <button onClick={del} style={{width:'100%',background:'rgba(255,94,94,0.08)',border:'1px solid rgba(255,94,94,0.2)',borderRadius:12,padding:12,color:C.danger,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
        🗑 Delete Task
      </button>
    </div>
  )
}
