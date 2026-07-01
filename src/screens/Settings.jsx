import { useState } from 'react'
import { useStore } from '../store/store.jsx'
import { C } from '../utils/helpers.js'

export default function Settings() {
  const { apiKey, setApiKey } = useStore()
  const [key,   setKey]   = useState(apiKey)
  const [saved, setSaved] = useState(false)
  function save() { setApiKey(key.trim()); setSaved(true); setTimeout(()=>setSaved(false),2000) }
  return (
    <div style={{padding:'0 16px 100px'}}>
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:16}}>
        <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:4}}>✨ Anthropic API Key</h3>
        <p style={{color:C.textSec,fontSize:13,marginBottom:12,lineHeight:1.5}}>
          Required for AI features. Get your key at{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{color:C.accent}}>console.anthropic.com</a>
        </p>
        <input type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="sk-ant-..." style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'11px 14px',color:C.text,fontSize:14,fontFamily:'Inter,sans-serif',outline:'none',marginBottom:10}}/>
        <button onClick={save} style={{width:'100%',background:saved?C.success:C.accent,color:'#fff',border:'none',borderRadius:12,padding:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'background 0.3s'}}>
          {saved?'✅ Saved!':'Save API Key'}
        </button>
        <p style={{color:C.textMuted,fontSize:11,marginTop:8,textAlign:'center'}}>🔒 Stored locally in your browser only.</p>
      </div>

      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:16}}>
        <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:12}}>How to get your API Key</h3>
        {[['1','Go to console.anthropic.com'],['2','Sign up or log in'],['3','Click Settings → API Keys'],['4','Click "Create Key", name it SecretaryAI'],['5','Copy the key (starts with sk-ant-…)'],['6','Paste it above and tap Save']].map(([n,t])=>(
          <div key={n} style={{display:'flex',gap:12,marginBottom:10,alignItems:'flex-start'}}>
            <div style={{width:24,height:24,borderRadius:'50%',background:C.accentSoft,color:C.accent,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{n}</div>
            <span style={{color:C.textSec,fontSize:13,lineHeight:1.5}}>{t}</span>
          </div>
        ))}
      </div>

      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16}}>
        <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:10}}>About</h3>
        <div style={{color:C.textSec,fontSize:13,lineHeight:1.8}}>
          <div>📱 Secretary AI v2.0</div>
          <div>💾 Data stored locally in your browser</div>
          <div>🤖 Powered by Claude claude-sonnet-4-6</div>
          <div>🌐 Hosted on GitHub Pages</div>
        </div>
      </div>
    </div>
  )
}
