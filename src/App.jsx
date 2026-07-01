// src/App.jsx
import { StoreProvider, useStore } from './store/store.jsx'
import Dashboard from './screens/Dashboard.jsx'
import AddTask from './screens/AddTask.jsx'
import TaskDetail from './screens/TaskDetail.jsx'
import Tasks, { CategoryDetail, PriorityDetail } from './screens/Tasks.jsx'
import Projects, { ProjectDetail } from './screens/Projects.jsx'
import Calendar from './screens/Calendar.jsx'
import Review from './screens/Review.jsx'
import Settings from './screens/Settings.jsx'
import { C } from './utils/helpers.js'

const TABS = [
  { k:'dashboard', i:'⊞', l:'Home'     },
  { k:'tasks',     i:'☑', l:'Tasks'    },
  { k:'projects',  i:'📁',l:'Projects' },
  { k:'calendar',  i:'📅',l:'Calendar' },
  { k:'review',    i:'📊',l:'Review'   },
]

const TITLES = {
  dashboard:'Secretary AI', tasks:'All Tasks', addTask:'New Task',
  task:'Task Detail', projects:'Projects', project:'Project',
  calendar:'Calendar', review:'Weekly Review', settings:'Settings',
  category:'Category', priority:'Priority',
}

const BACK = {
  task:'tasks', addTask:'dashboard', project:'projects',
  category:'dashboard', priority:'dashboard', settings:'dashboard',
}

function Shell() {
  const { screen, go, syncing } = useStore()
  const isTab = TABS.some(t => t.k === screen)

  const Screen = {
    dashboard: Dashboard, tasks: Tasks, addTask: AddTask,
    task: TaskDetail, projects: Projects, project: ProjectDetail,
    calendar: Calendar, review: Review, settings: Settings,
    category: CategoryDetail, priority: PriorityDetail,
  }[screen] || Dashboard

  return (
    <div style={{maxWidth:480,margin:'0 auto',minHeight:'100vh',background:C.bg,position:'relative'}}>

      {/* Top bar */}
      <div style={{position:'sticky',top:0,zIndex:100,background:`${C.bg}ee`,backdropFilter:'blur(12px)',borderBottom:`1px solid ${C.border}`,padding:'12px 16px 10px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {!isTab && (
            <button onClick={()=>go(BACK[screen]||'dashboard')} style={{background:C.surface,border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',color:C.textSec,fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
          )}
          <h1 style={{color:C.text,fontSize:screen==='dashboard'?24:17,fontWeight:700,flex:1,letterSpacing:screen==='dashboard'?'-0.5px':'normal'}}>
            {TITLES[screen]||'Secretary AI'}
          </h1>
          {/* Sync indicator */}
          {syncing && (
            <div style={{display:'flex',alignItems:'center',gap:4,color:C.textMuted,fontSize:11}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:C.accent,animation:'pulse 1s infinite'}}/>
              syncing
            </div>
          )}
          <button onClick={()=>go('settings')} style={{background:C.surface,border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16}}>⚙️</button>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {/* Content */}
      <div style={{paddingTop:12,paddingBottom:80}}>
        <Screen/>
      </div>

      {/* FAB */}
      <button onClick={()=>go('addTask')} style={{position:'fixed',bottom:70,left:'50%',transform:'translateX(-50%)',width:56,height:56,borderRadius:'50%',background:`linear-gradient(135deg,${C.accent},${C.pink})`,border:'none',color:'#fff',fontSize:28,cursor:'pointer',boxShadow:`0 6px 24px rgba(108,99,255,0.5)`,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>+</button>

      {/* Bottom nav */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,background:`${C.surface}f8`,backdropFilter:'blur(12px)',borderTop:`1px solid ${C.border}`,display:'flex',height:60,zIndex:100}}>
        {TABS.map((tab,i) => {
          const active = screen === tab.k
          if (i===2) return <div key="gap" style={{flex:1}}/>
          return (
            <button key={tab.k} onClick={()=>go(tab.k)} style={{flex:1,background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,color:active?C.accent:C.textMuted,fontFamily:'Inter,sans-serif'}}>
              <span style={{fontSize:18}}>{tab.i}</span>
              <span style={{fontSize:10,fontWeight:active?600:400}}>{tab.l}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  return <StoreProvider><Shell/></StoreProvider>
}
