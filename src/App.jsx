import { StoreProvider, useStore } from './store/store.jsx'
import { TradingProvider } from './store/tradingStore.jsx'
import { HabitProvider } from './store/habitStore.jsx'
import { CalendarProvider } from './store/calendarStore.jsx'
import Dashboard from './screens/Dashboard.jsx'
import AddTask from './screens/AddTask.jsx'
import TaskDetail from './screens/TaskDetail.jsx'
import Tasks, { CategoryDetail, PriorityDetail } from './screens/Tasks.jsx'
import Projects, { ProjectDetail } from './screens/Projects.jsx'
import Review from './screens/Review.jsx'
import Settings from './screens/Settings.jsx'
import Stocks from './screens/Stocks.jsx'
import Trading from './screens/Trading.jsx'
import Performance from './screens/Performance.jsx'
import Habits from './screens/Habits.jsx'
import Calendar from './screens/Calendar.jsx'
import { C } from './utils/helpers.js'

const TABS = [
  { k:'dashboard', i:'⊞', l:'Home'    },
  { k:'tasks',     i:'☑', l:'Tasks'   },
  { k:'habits',    i:'🎯',l:'Habits'  },
  { k:'calendar',  i:'📅',l:'Cal.'    },
  { k:'stocks',    i:'📈',l:'Stocks'  },
  { k:'trading',   i:'💼',l:'Trading' },
  { k:'perf',      i:'📊',l:'Perf.'   },
]

const TITLES = {
  dashboard:'Secretary AI', tasks:'All Tasks', addTask:'New Task',
  task:'Task Detail', projects:'Projects', project:'Project',
  review:'Weekly Review', settings:'Settings',
  category:'Category', priority:'Priority',
  stocks:'Stock Intelligence', trading:'Active Trading',
  perf:'Performance', habits:'Habits', calendar:'Calendar',
}

const BACK = {
  task:'tasks', addTask:'dashboard', project:'projects',
  category:'dashboard', priority:'dashboard', settings:'dashboard',
}

function Shell() {
  const { screen, go, syncing } = useStore()
  const isTab = TABS.some(t=>t.k===screen)

  const Screen = {
    dashboard: Dashboard, tasks: Tasks, addTask: AddTask,
    task: TaskDetail, projects: Projects, project: ProjectDetail,
    review: Review, settings: Settings, category: CategoryDetail,
    priority: PriorityDetail, stocks: Stocks, trading: Trading,
    perf: Performance, habits: Habits, calendar: Calendar,
  }[screen] || Dashboard

  return (
    <div style={{maxWidth:480,margin:'0 auto',minHeight:'100vh',background:C.bg,position:'relative'}}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

      {/* Top bar */}
      <div style={{position:'sticky',top:0,zIndex:100,background:`${C.bg}ee`,
        backdropFilter:'blur(12px)',borderBottom:`1px solid ${C.border}`,
        padding:'12px 16px 10px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {!isTab&&(
            <button onClick={()=>go(BACK[screen]||'dashboard')}
              style={{background:C.surface,border:'none',borderRadius:8,width:32,height:32,
                cursor:'pointer',color:C.textSec,fontSize:20,display:'flex',
                alignItems:'center',justifyContent:'center'}}>‹</button>
          )}
          <h1 style={{color:C.text,fontSize:screen==='dashboard'?22:17,fontWeight:700,flex:1}}>
            {TITLES[screen]||'Secretary AI'}
          </h1>
          {syncing&&(
            <div style={{display:'flex',alignItems:'center',gap:4,color:C.textMuted,fontSize:11}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:C.accent,animation:'pulse 1s infinite'}}/>
              syncing
            </div>
          )}
          <button onClick={()=>go('settings')}
            style={{background:C.surface,border:'none',borderRadius:8,width:32,height:32,
              cursor:'pointer',fontSize:16}}>⚙️</button>
        </div>
      </div>

      {/* Content */}
      <div style={{paddingBottom:68}}>
        <Screen/>
      </div>

      {/* FAB */}
      {['dashboard','tasks'].includes(screen)&&(
        <button onClick={()=>go('addTask')}
          style={{position:'fixed',bottom:72,left:'50%',transform:'translateX(-50%)',
            width:52,height:52,borderRadius:'50%',
            background:`linear-gradient(135deg,${C.accent},${C.pink})`,
            border:'none',color:'#fff',fontSize:26,cursor:'pointer',
            boxShadow:`0 6px 20px rgba(108,99,255,0.45)`,zIndex:200,
            display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
      )}

      {/* Bottom nav — scrollable for 7 tabs */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',
        width:'100%',maxWidth:480,background:`${C.surface}f8`,
        backdropFilter:'blur(12px)',borderTop:`1px solid ${C.border}`,
        display:'flex',height:58,zIndex:100,overflowX:'auto'}}>
        {TABS.map(tab=>{
          const active=screen===tab.k
          return (
            <button key={tab.k} onClick={()=>go(tab.k)}
              style={{flex:'0 0 calc(100%/7)',minWidth:52,background:'none',border:'none',
                cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',
                justifyContent:'center',gap:2,
                color:active?C.accent:C.textMuted,fontFamily:'Inter,sans-serif'}}>
              <span style={{fontSize:16}}>{tab.i}</span>
              <span style={{fontSize:9,fontWeight:active?600:400}}>{tab.l}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HabitProvider>
        <CalendarProvider>
          <TradingProvider>
            <Shell/>
          </TradingProvider>
        </CalendarProvider>
      </HabitProvider>
    </StoreProvider>
  )
}
