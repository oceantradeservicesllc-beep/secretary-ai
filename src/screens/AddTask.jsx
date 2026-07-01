import { useState, useRef } from 'react'
import { useStore } from '../store/store.jsx'
import { Btn, AISuggestion, CatChips, PriSelector, Field, Spin } from '../components/UI.jsx'
import { classifyTask, classifyImage } from '../services/ai.js'
import { C } from '../utils/helpers.js'

const MODES=[{k:'text',i:'⌨️',l:'Type'},{k:'paste',i:'📋',l:'Paste'},{k:'camera',i:'📷',l:'Camera'}]

export default function AddTask() {
  const { addTask, addNote, go, apiKey } = useStore()
  const [mode,   setMode]   = useState('text')
  const [raw,    setRaw]    = useState('')
  const [busy,   setBusy]   = useState(false)
  const [sug,    setSug]    = useState(null)
  const [imgB64, setImgB64] = useState(null)
  const [imgPre, setImgPre] = useState(null)
  const [err,    setErr]    = useState('')
  const [title,  setTitle]  = useState('')
  const [desc,   setDesc]   = useState('')
  const [cat,    setCat]    = useState('Work')
  const [pri,    setPri]    = useState(2)
  const [hasDue, setHasDue] = useState(false)
  const [due,    setDue]    = useState('')
  const [note,   setNote]   = useState('')
  const fileRef = useRef()

  const hasInput = raw.trim()||imgB64

  async function analyze() {
    if (!apiKey) { setErr('Add your Anthropic API key in ⚙️ Settings first.'); return }
    setBusy(true); setErr('')
    try {
      const r = imgB64 ? await classifyImage(apiKey,imgB64) : await classifyTask(apiKey,raw)
      if (r) { setSug(r); setTitle(r.title||''); setDesc(r.description||''); setCat(r.category||'Work'); setPri(r.priority||2) }
      else setErr('AI could not parse the input. Fill the form manually.')
    } catch(e) { setErr('AI error: '+e.message) }
    setBusy(false)
  }

  async function paste() {
    try { const t=await navigator.clipboard.readText(); setRaw(t); setMode('paste') }
    catch { setErr('Could not read clipboard. Paste manually in the text area below.') }
  }

  function pickImage(e) {
    const f=e.target.files?.[0]; if (!f) return
    const r=new FileReader()
    r.onload=ev=>{ const d=ev.target.result; setImgPre(d); setImgB64(d.split(',')[1]) }
    r.readAsDataURL(f)
  }

  function save() {
    if (!title.trim()) { setErr('Please enter a task title.'); return }
    const t = addTask({title:title.trim(),description:desc.trim(),category:cat,priority:pri,dueDate:hasDue&&due?new Date(due).toISOString():null})
    if (note.trim()) addNote(t.id,note.trim())
    if (sug) addNote(t.id,`🤖 AI classified: ${cat}, P${pri} (${Math.round(sug.confidence*100)}% confidence)`,true)
    go('dashboard')
  }

  return (
    <div style={{padding:'0 16px 100px'}}>
      {/* Mode tabs */}
      <div style={{display:'flex',background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,marginBottom:14,overflow:'hidden'}}>
        {MODES.map(m=>(
          <button key={m.k} onClick={()=>setMode(m.k)} style={{flex:1,border:'none',background:mode===m.k?'rgba(108,99,255,0.15)':'transparent',color:mode===m.k?C.accent:C.textMuted,padding:'10px 4px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontSize:11,fontWeight:mode===m.k?600:400,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <span style={{fontSize:17}}>{m.i}</span>{m.l}
          </button>
        ))}
      </div>

      {/* Input areas */}
      {mode==='text'&&(
        <textarea value={raw} onChange={e=>{setRaw(e.target.value)}} placeholder="Type your task, idea, or note… AI will categorize and prioritize it automatically." rows={4} style={{width:'100%',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 14px',color:C.text,fontSize:14,fontFamily:'Inter,sans-serif',resize:'vertical',outline:'none',marginBottom:12}}/>
      )}
      {mode==='paste'&&(
        <div style={{marginBottom:12}}>
          <button onClick={paste} style={{width:'100%',background:C.accent,color:'#fff',border:'none',borderRadius:12,padding:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',marginBottom:10}}>📋 Paste from Clipboard</button>
          {raw&&<div style={{background:C.card,borderRadius:10,padding:12,color:C.textSec,fontSize:12,maxHeight:80,overflow:'hidden'}}>{raw.slice(0,200)}{raw.length>200?'...':''}</div>}
        </div>
      )}
      {mode==='camera'&&(
        <div style={{marginBottom:12}}>
          <input type="file" accept="image/*" capture="environment" ref={fileRef} onChange={pickImage} style={{display:'none'}}/>
          {imgPre
            ? <div style={{position:'relative',marginBottom:10}}>
                <img src={imgPre} alt="preview" style={{width:'100%',borderRadius:12,maxHeight:200,objectFit:'cover'}}/>
                <button onClick={()=>{setImgPre(null);setImgB64(null)}} style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,0.6)',border:'none',borderRadius:8,color:'#fff',padding:'4px 8px',cursor:'pointer',fontSize:12}}>✕</button>
              </div>
            : <button onClick={()=>fileRef.current.click()} style={{width:'100%',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24,cursor:'pointer',textAlign:'center',color:C.textSec,fontFamily:'Inter,sans-serif'}}>
                <div style={{fontSize:32}}>📷</div><div style={{fontSize:12,marginTop:6}}>Take Photo or Upload Image</div>
              </button>
          }
          <p style={{color:C.textMuted,fontSize:11,textAlign:'center',marginTop:6}}>AI will extract task info from your photo</p>
        </div>
      )}

      {/* Analyze button */}
      {hasInput&&<div style={{marginBottom:14}}><Btn label={busy?'Analyzing with AI…':'✨  Analyze with AI'} loading={busy} onClick={analyze}/></div>}

      {/* Error */}
      {err&&<div style={{background:'rgba(255,94,94,0.1)',border:'1px solid rgba(255,94,94,0.3)',borderRadius:10,padding:'10px 14px',color:C.danger,fontSize:13,marginBottom:12}}>{err}</div>}

      <AISuggestion s={sug}/>

      {/* Form */}
      <div style={{background:`${C.card}88`,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16}}>
        <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:14}}>Task Details</h3>
        <Field label="Title *" value={title} onChange={setTitle} placeholder="Task title"/>
        <Field label="Description" value={desc} onChange={setDesc} placeholder="More details…" rows={2}/>
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
        <Field label="Initial Note" value={note} onChange={setNote} placeholder="Add action steps or context…" rows={2}/>
        <Btn label="Save Task" onClick={save} disabled={!title.trim()}/>
      </div>
    </div>
  )
}
