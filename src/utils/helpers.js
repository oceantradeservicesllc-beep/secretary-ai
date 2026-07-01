export const CATEGORIES = ['Perso','Family','Home','Work','Investment','Hobbies','Projects']

export const CAT = {
  Perso:      { icon:'👤', color:'#6C63FF', soft:'rgba(108,99,255,0.15)' },
  Family:     { icon:'👨‍👩‍👧', color:'#FF6B6B', soft:'rgba(255,107,107,0.15)' },
  Home:       { icon:'🔨', color:'#4ECDC4', soft:'rgba(78,205,196,0.15)'  },
  Work:       { icon:'💼', color:'#45B7D1', soft:'rgba(69,183,209,0.15)'  },
  Investment: { icon:'📈', color:'#52C986', soft:'rgba(82,201,134,0.15)'  },
  Hobbies:    { icon:'⭐', color:'#FFB347', soft:'rgba(255,179,71,0.15)'  },
  Projects:   { icon:'📁', color:'#C984E0', soft:'rgba(201,132,224,0.15)' },
}

export const PRI = {
  1: { label:'Priority 1 — High',   short:'P1', color:'#FF5E5E', soft:'rgba(255,94,94,0.15)',   emoji:'🔴' },
  2: { label:'Priority 2 — Medium', short:'P2', color:'#FF9F43', soft:'rgba(255,159,67,0.15)',  emoji:'🟠' },
  3: { label:'Priority 3 — Low',    short:'P3', color:'#52C986', soft:'rgba(82,201,134,0.15)', emoji:'🟢' },
}

export const C = {
  bg:'#0F0F14', surface:'#1A1A24', card:'#22222E', border:'#2E2E3E',
  text:'#F0F0F5', textSec:'#9090A8', textMuted:'#55556A',
  accent:'#6C63FF', accentSoft:'rgba(108,99,255,0.15)',
  pink:'#FF6584', success:'#52C986', danger:'#FF5E5E', warning:'#FF9F43',
  aiGold:'#FFD700', aiSoft:'rgba(255,215,0,0.08)', msBlue:'#0078D4',
}

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const fmtDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
}

export const fmtRel = (iso) => {
  const d = Math.floor((Date.now()-new Date(iso))/60000)
  if (d<1) return 'just now'
  if (d<60) return `${d}m ago`
  if (d<1440) return `${Math.floor(d/60)}h ago`
  return `${Math.floor(d/1440)}d ago`
}

export const isOverdue = (t) => !t.isCompleted && t.dueDate && new Date(t.dueDate)<new Date()
export const isOld7    = (t) => !t.isCompleted && Date.now()-new Date(t.createdAt)>7*86400000

export const makeSamples = () => {
  const now = new Date().toISOString()
  const f = (d) => new Date(Date.now()+d*86400000).toISOString()
  const p = (d) => new Date(Date.now()-d*86400000).toISOString()
  return [
    {id:uid(),title:'Prepare Q3 financial report',description:'Compile all investment data for board review',category:'Work',priority:1,isCompleted:false,createdAt:now,updatedAt:now,dueDate:f(2),notes:[{id:uid(),content:'Include ROI analysis for all portfolios',createdAt:now,isAI:false}],tags:[]},
    {id:uid(),title:'Review mortgage refinancing options',description:'Compare rates from 3 banks',category:'Investment',priority:1,isCompleted:false,createdAt:now,updatedAt:now,dueDate:f(5),notes:[],tags:[]},
    {id:uid(),title:'Schedule dental appointment for kids',description:'',category:'Family',priority:2,isCompleted:false,createdAt:now,updatedAt:now,dueDate:null,notes:[],tags:[]},
    {id:uid(),title:'Fix kitchen faucet',description:'Has been dripping for 2 weeks',category:'Home',priority:2,isCompleted:false,createdAt:now,updatedAt:now,dueDate:null,notes:[],tags:[]},
    {id:uid(),title:'Complete React course module 4',description:'',category:'Hobbies',priority:3,isCompleted:false,createdAt:now,updatedAt:now,dueDate:null,notes:[],tags:[]},
    {id:uid(),title:'Book family vacation to Mexico',description:'Look into Cancun resorts for August',category:'Family',priority:2,isCompleted:false,createdAt:now,updatedAt:now,dueDate:f(14),notes:[],tags:[]},
    {id:uid(),title:'Annual physical checkup',description:'',category:'Perso',priority:1,isCompleted:false,createdAt:now,updatedAt:now,dueDate:p(1),notes:[],tags:[]},
    {id:uid(),title:'Reorganize garage storage',description:'Install new shelving system',category:'Home',priority:3,isCompleted:false,createdAt:now,updatedAt:now,dueDate:null,notes:[],tags:[]},
  ]
}
