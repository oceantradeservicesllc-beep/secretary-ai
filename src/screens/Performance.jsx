import { useState } from 'react'
import { useTrading, FUND_GROUPS, FUND_COLORS } from '../store/tradingStore.jsx'
import { C } from '../utils/helpers.js'

const PERIODS = [
  {k:'1W', label:'1W',  days:7},
  {k:'1M', label:'1M',  days:30},
  {k:'3M', label:'3M',  days:90},
  {k:'6M', label:'6M',  days:180},
  {k:'1Y', label:'1Y',  days:365},
  {k:'YTD',label:'YTD', days:null, isYTD:true},
  {k:'ALL',label:'All', days:null},
]

const fmtMoney = (n,compact=false) => {
  const abs=Math.abs(n)
  const str=compact&&abs>=1000?`$${(abs/1000).toFixed(1)}K`:`$${abs.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
  return n>=0?`+${str}`:`-${str}`
}
const fmtPct = (n) => `${n>=0?'+':''}${n.toFixed(1)}%`

function getYTDDays() {
  const now=new Date(), start=new Date(now.getFullYear(),0,1)
  return Math.ceil((now-start)/86400000)
}

function getYearRange(archived) {
  if(!archived.length) return []
  const years=new Set(archived.map(p=>new Date(p.closedAt).getFullYear()))
  return [...years].sort((a,b)=>b-a)
}

function calcForPeriod(archived,positions,fg,days,isYTD) {
  const effectiveDays = isYTD?getYTDDays():days
  const cutoff = effectiveDays?new Date(Date.now()-effectiveDays*86400000):null
  const closed = archived.filter(p=>{
    if(fg&&p.fundGroup!==fg) return false
    if(!cutoff) return true
    return new Date(p.closedAt)>=cutoff
  })
  const realized = closed.reduce((s,p)=>s+(p.pnl||0),0)
  const wins     = closed.filter(p=>p.pnl>0).length
  const active   = positions.filter(p=>(!fg||p.fundGroup===fg)&&!p.isClosed)
  const invested = active.reduce((s,p)=>s+(p.avgPrice*p.totalQty),0)
  const best     = closed.length?closed.reduce((a,b)=>a.pnl>b.pnl?a:b,closed[0]):null
  const worst    = closed.length?closed.reduce((a,b)=>a.pnl<b.pnl?a:b,closed[0]):null
  const pnlPct   = invested>0?(realized/invested)*100:0
  return{realized,invested,count:closed.length,wins,losses:closed.length-wins,winRate:closed.length?wins/closed.length*100:0,best,worst,pnlPct,closed}
}

function calcForYear(archived,fg,year) {
  const closed=archived.filter(p=>{
    if(fg&&p.fundGroup!==fg) return false
    return new Date(p.closedAt).getFullYear()===year
  })
  const invested=closed.reduce((s,p)=>s+Math.abs(p.avgPrice*(p.sellQty||p.totalQty)),0)
  const realized=closed.reduce((s,p)=>s+(p.pnl||0),0)
  const pnlPct=invested>0?(realized/invested)*100:0
  const wins=closed.filter(p=>p.pnl>0).length
  return{realized,pnlPct,count:closed.length,wins,invested}
}

export default function Performance() {
  const {archived,positions,cashMap} = useTrading()
  const [period,   setPeriod]   = useState('3M')
  const [selFund,  setSelFund]  = useState(null) // null = all
  const [view,     setView]     = useState('overview') // overview | drilldown | annual

  const per      = PERIODS.find(p=>p.k===period)||PERIODS[2]
  const allPerf  = calcForPeriod(archived,positions,selFund,per.days,per.isYTD)
  const years    = getYearRange(archived)
  const thisYear = new Date().getFullYear()

  // Monthly bars for chart (last N months based on period)
  const monthCount = per.days?Math.min(Math.ceil(per.days/30),12):12
  const monthlyPnL = []
  for(let i=monthCount-1;i>=0;i--) {
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i)
    const y=d.getFullYear(),m=d.getMonth()
    const mo=archived.filter(p=>{
      if(selFund&&p.fundGroup!==selFund) return false
      const pd=new Date(p.closedAt)
      return pd.getFullYear()===y&&pd.getMonth()===m
    })
    const pnl=mo.reduce((s,p)=>s+(p.pnl||0),0)
    monthlyPnL.push({label:d.toLocaleDateString('en-US',{month:'short'}),pnl})
  }
  const maxAbs=Math.max(...monthlyPnL.map(m=>Math.abs(m.pnl)),1)

  return(
    <div style={{padding:'0 16px 100px'}}>

      {/* View toggle */}
      <div style={{display:'flex',background:C.card,borderRadius:12,marginBottom:12,overflow:'hidden'}}>
        {[['overview','📊 Overview'],['drilldown','🔍 By Account'],['annual','📅 Annual']].map(([k,l])=>(
          <button key={k} onClick={()=>setView(k)} style={{flex:1,border:'none',background:view===k?C.accentSoft:'transparent',color:view===k?C.accent:C.textMuted,padding:'10px 2px',fontSize:10,fontWeight:view===k?700:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{l}</button>
        ))}
      </div>

      {/* Period selector */}
      <div style={{display:'flex',gap:5,marginBottom:14,flexWrap:'wrap'}}>
        {PERIODS.map(p=>(
          <button key={p.k} onClick={()=>setPeriod(p.k)} style={{flex:1,minWidth:32,background:period===p.k?C.accent:C.card,border:`0.5px solid ${period===p.k?C.accent:C.border}`,borderRadius:8,padding:'5px 2px',color:period===p.k?'#fff':C.textMuted,fontSize:10,fontWeight:period===p.k?700:400,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'center'}}>{p.label}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {view==='overview'&&(
        <div>
          {/* All accounts summary */}
          <div style={{background:`linear-gradient(135deg,rgba(108,99,255,.12),rgba(82,201,134,.06))`,border:`1px solid rgba(108,99,255,.22)`,borderRadius:16,padding:14,marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{color:C.textMuted,fontSize:10}}>All accounts · {per.label} · excl. cash</div>
                <div style={{color:allPerf.realized>=0?C.success:C.danger,fontSize:20,fontWeight:800}}>{fmtMoney(allPerf.realized)}</div>
                <div style={{color:allPerf.pnlPct>=0?C.success:C.danger,fontSize:12}}>{fmtPct(allPerf.pnlPct)} return on invested capital</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{color:C.textMuted,fontSize:10}}>Trades</div>
                <div style={{color:C.text,fontSize:18,fontWeight:700}}>{allPerf.count}</div>
                <div style={{color:C.textMuted,fontSize:10,marginTop:2}}>Win rate</div>
                <div style={{color:C.success,fontSize:13,fontWeight:600}}>{allPerf.winRate.toFixed(0)}%</div>
              </div>
            </div>

            {/* Monthly bar chart */}
            {monthlyPnL.length>0&&<>
              <div style={{color:C.textMuted,fontSize:10,marginBottom:4}}>Monthly P&L (excl. cash)</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:3,height:44,marginBottom:3}}>
                {monthlyPnL.map((m,i)=>{
                  const h=Math.max((Math.abs(m.pnl)/maxAbs)*100,4)
                  return(
                    <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
                      <div style={{width:'100%',height:`${h}%`,background:m.pnl>=0?C.success:C.danger,borderRadius:'2px 2px 0 0',minHeight:4}}/>
                    </div>
                  )
                })}
              </div>
              <div style={{display:'flex',gap:3}}>
                {monthlyPnL.map((m,i)=>(
                  <div key={i} style={{flex:1,color:C.textMuted,fontSize:7,textAlign:'center'}}>{m.label}</div>
                ))}
              </div>
            </>}
          </div>

          {/* Per account */}
          <div style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:8}}>By account</div>
          {FUND_GROUPS.map(fg=>{
            const perf=calcForPeriod(archived,positions,fg,per.days,per.isYTD)
            const cash=cashMap[fg]||0
            return(
              <div key={fg} onClick={()=>{setSelFund(fg);setView('drilldown')}} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'10px 14px',marginBottom:8,cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <div style={{width:9,height:9,borderRadius:'50%',background:FUND_COLORS[fg]}}/>
                    <span style={{color:C.text,fontSize:13,fontWeight:700}}>{fg}</span>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:perf.realized>=0?C.success:C.danger,fontSize:12,fontWeight:700}}>{fmtMoney(perf.realized,true)}</div>
                    <div style={{color:perf.pnlPct>=0?C.success:C.danger,fontSize:10}}>{fmtPct(perf.pnlPct)}</div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:5}}>
                  {[['Invested',`$${perf.invested.toLocaleString('en-US',{maximumFractionDigits:0})}`],['Cash (excl)',`$${cash.toLocaleString('en-US',{maximumFractionDigits:0})}`],['Trades',perf.count],['Win rate',`${perf.winRate.toFixed(0)}%`]].map(([l,v])=>(
                    <div key={l} style={{background:C.surface,borderRadius:7,padding:'4px 5px',textAlign:'center'}}>
                      <div style={{color:C.textMuted,fontSize:8}}>{l}</div>
                      <div style={{color:l==='Cash (excl)'?C.textMuted:C.text,fontSize:9,fontWeight:600}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{textAlign:'right',marginTop:4}}>
                  <span style={{color:C.accent,fontSize:10}}>Tap for details →</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── DRILLDOWN ── */}
      {view==='drilldown'&&(
        <div>
          {/* Fund selector */}
          <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
            <button onClick={()=>setSelFund(null)} style={{border:`1px solid ${!selFund?C.accent:C.border}`,borderRadius:8,padding:'5px 10px',background:!selFund?C.accentSoft:C.card,color:!selFund?C.accent:C.textMuted,fontSize:11,fontWeight:!selFund?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>All</button>
            {FUND_GROUPS.map(fg=>(
              <button key={fg} onClick={()=>setSelFund(fg)} style={{border:`1px solid ${selFund===fg?FUND_COLORS[fg]:C.border}`,borderRadius:8,padding:'5px 10px',background:selFund===fg?FUND_COLORS[fg]+'20':C.card,color:selFund===fg?FUND_COLORS[fg]:C.textMuted,fontSize:11,fontWeight:selFund===fg?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{fg}</button>
            ))}
          </div>

          {/* Selected account header */}
          <div style={{background:`${selFund?FUND_COLORS[selFund]:'#6C63FF'}12`,border:`1px solid ${selFund?FUND_COLORS[selFund]:'#6C63FF'}30`,borderRadius:14,padding:14,marginBottom:14}}>
            <div style={{color:selFund?FUND_COLORS[selFund]:C.accent,fontSize:11,fontWeight:700,marginBottom:4}}>
              {selFund||'All accounts'} · {per.label} · excl. cash
            </div>
            <div style={{color:allPerf.realized>=0?C.success:C.danger,fontSize:20,fontWeight:800}}>{fmtMoney(allPerf.realized)}</div>
            <div style={{color:allPerf.pnlPct>=0?C.success:C.danger,fontSize:12,marginBottom:8}}>{fmtPct(allPerf.pnlPct)} on invested capital</div>
            {/* Bar chart */}
            {monthlyPnL.length>0&&<>
              <div style={{color:C.textMuted,fontSize:10,marginBottom:4}}>Monthly P&L</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:3,height:40,marginBottom:3}}>
                {monthlyPnL.map((m,i)=>{
                  const h=Math.max((Math.abs(m.pnl)/maxAbs)*100,4)
                  return <div key={i} style={{flex:1,height:`${h}%`,background:m.pnl>=0?C.success:C.danger,borderRadius:'2px 2px 0 0',minHeight:4}}/>
                })}
              </div>
              <div style={{display:'flex',gap:3}}>
                {monthlyPnL.map((m,i)=><div key={i} style={{flex:1,color:C.textMuted,fontSize:7,textAlign:'center'}}>{m.label}</div>)}
              </div>
            </>}
          </div>

          {/* All periods table */}
          <div style={{color:C.text,fontSize:12,fontWeight:700,marginBottom:8}}>All periods (excl. cash)</div>
          <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'8px 10px',marginBottom:12}}>
            <div style={{display:'grid',gridTemplateColumns:'40px 1fr 48px 36px',gap:3,padding:'2px 0',borderBottom:`1px solid ${C.border}`,marginBottom:4}}>
              {['Period','P&L','Return','Trades'].map(h=><div key={h} style={{color:C.textMuted,fontSize:9,textAlign:h!=='Period'?'right':'left'}}>{h}</div>)}
            </div>
            {PERIODS.map(p=>{
              const perf=calcForPeriod(archived,positions,selFund||null,p.days,p.isYTD)
              const isCur=p.k===period
              return(
                <div key={p.k} onClick={()=>setPeriod(p.k)} style={{display:'grid',gridTemplateColumns:'40px 1fr 48px 36px',gap:3,padding:'4px 0',borderBottom:`1px solid ${C.border}`,background:isCur?C.accentSoft:'transparent',cursor:'pointer',borderRadius:isCur?6:0}}>
                  <div style={{color:isCur?C.accent:C.textSec,fontSize:10,fontWeight:isCur?700:400}}>{p.label}</div>
                  <div style={{color:perf.realized>=0?C.success:C.danger,fontSize:10,fontWeight:600,textAlign:'right'}}>{perf.count?fmtMoney(perf.realized,true):'—'}</div>
                  <div style={{color:perf.realized>=0?C.success:C.danger,fontSize:10,textAlign:'right'}}>{perf.count?fmtPct(perf.pnlPct):'—'}</div>
                  <div style={{color:isCur?C.accent:C.textMuted,fontSize:10,textAlign:'right'}}>{perf.count||'—'}</div>
                </div>
              )
            })}
          </div>

          {/* Best / Worst */}
          {(allPerf.best||allPerf.worst)&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            {allPerf.best&&<div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:11,padding:'10px 12px'}}>
              <div style={{color:C.textMuted,fontSize:9,marginBottom:3}}>Best trade ({per.label})</div>
              <div style={{color:C.text,fontSize:13,fontWeight:700}}>{allPerf.best.ticker}</div>
              <div style={{color:C.success,fontSize:11,fontWeight:700}}>{fmtMoney(allPerf.best.pnl)}</div>
              <div style={{color:C.success,fontSize:10}}>{fmtPct(allPerf.best.pnlPct)}</div>
            </div>}
            {allPerf.worst&&<div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:11,padding:'10px 12px'}}>
              <div style={{color:C.textMuted,fontSize:9,marginBottom:3}}>Worst trade ({per.label})</div>
              <div style={{color:C.text,fontSize:13,fontWeight:700}}>{allPerf.worst.ticker}</div>
              <div style={{color:C.danger,fontSize:11,fontWeight:700}}>{fmtMoney(allPerf.worst.pnl)}</div>
              <div style={{color:C.danger,fontSize:10}}>{fmtPct(allPerf.worst.pnlPct)}</div>
            </div>}
          </div>}

          {/* Win rate bar */}
          <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:11,padding:'10px 12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
              <span style={{color:C.textSec,fontSize:11}}>Win rate ({per.label})</span>
              <span style={{color:C.success,fontSize:12,fontWeight:700}}>{allPerf.winRate.toFixed(0)}% ({allPerf.wins}/{allPerf.count})</span>
            </div>
            <div style={{background:C.surface,borderRadius:3,height:6,overflow:'hidden'}}>
              <div style={{background:C.success,height:'100%',width:`${allPerf.winRate}%`,borderRadius:3}}/>
            </div>
          </div>
        </div>
      )}

      {/* ── ANNUAL ── */}
      {view==='annual'&&(
        <div>
          <div style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:4}}>Year by year · all accounts · excl. cash</div>
          <div style={{color:C.textMuted,fontSize:10,marginBottom:12}}>Cash positions excluded from all P&L % calculations</div>

          {/* Annual bar chart */}
          {years.length>0&&(
            <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:12,marginBottom:14}}>
              <div style={{color:C.textMuted,fontSize:10,marginBottom:6}}>Annual P&L · all accounts</div>
              {(() => {
                const annuals=years.map(y=>({y,pnl:FUND_GROUPS.reduce((s,fg)=>s+calcForYear(archived,fg,y).realized,0)}))
                const mx=Math.max(...annuals.map(a=>Math.abs(a.pnl)),1)
                return(
                  <>
                    <div style={{display:'flex',alignItems:'flex-end',gap:5,height:60,marginBottom:4}}>
                      {annuals.map(a=>{
                        const h=Math.max((Math.abs(a.pnl)/mx)*100,4)
                        const isCur=a.y===thisYear
                        return(
                          <div key={a.y} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                            <div style={{color:a.pnl>=0?C.success:C.danger,fontSize:8,fontWeight:isCur?700:400}}>{a.pnl>=0?'+':''}{(a.pnl/1000).toFixed(1)}K</div>
                            <div style={{width:'100%',height:`${h}%`,background:isCur?C.accent:a.pnl>=0?C.success:C.danger,borderRadius:'2px 2px 0 0',minHeight:4}}/>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{display:'flex',gap:5}}>
                      {annuals.map(a=><div key={a.y} style={{flex:1,color:a.y===thisYear?C.accent:C.textMuted,fontSize:8,textAlign:'center',fontWeight:a.y===thisYear?700:400}}>{a.y}</div>)}
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* Per account per year grid */}
          {years.map(y=>(
            <div key={y} style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{color:y===thisYear?C.accent:C.text,fontSize:13,fontWeight:700}}>{y} {y===thisYear?'(current)':''}</span>
                <span style={{color:C.textMuted,fontSize:10}}>excl. cash</span>
              </div>
              {FUND_GROUPS.map(fg=>{
                const perf=calcForYear(archived,fg,y)
                if(!perf.count) return null
                return(
                  <div key={fg} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'8px 12px',marginBottom:5}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:FUND_COLORS[fg]}}/>
                        <span style={{color:C.text,fontSize:12,fontWeight:600}}>{fg}</span>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <span style={{color:perf.realized>=0?C.success:C.danger,fontSize:12,fontWeight:700}}>{fmtMoney(perf.realized,true)}</span>
                        <span style={{color:perf.pnlPct>=0?C.success:C.danger,fontSize:10,marginLeft:8}}>{fmtPct(perf.pnlPct)}</span>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:5}}>
                      <div style={{flex:1,background:C.surface,borderRadius:6,padding:'3px 5px',textAlign:'center'}}>
                        <div style={{color:C.textMuted,fontSize:8}}>Trades</div>
                        <div style={{color:C.text,fontSize:9,fontWeight:600}}>{perf.count}</div>
                      </div>
                      <div style={{flex:1,background:C.surface,borderRadius:6,padding:'3px 5px',textAlign:'center'}}>
                        <div style={{color:C.textMuted,fontSize:8}}>Wins</div>
                        <div style={{color:C.success,fontSize:9,fontWeight:600}}>{perf.wins}</div>
                      </div>
                      <div style={{flex:1,background:C.surface,borderRadius:6,padding:'3px 5px',textAlign:'center'}}>
                        <div style={{color:C.textMuted,fontSize:8}}>Win rate</div>
                        <div style={{color:C.success,fontSize:9,fontWeight:600}}>{perf.count?Math.round(perf.wins/perf.count*100):0}%</div>
                      </div>
                      <div style={{flex:1,background:C.surface,borderRadius:6,padding:'3px 5px',textAlign:'center'}}>
                        <div style={{color:C.textMuted,fontSize:8}}>Cash</div>
                        <div style={{color:C.textMuted,fontSize:9,fontWeight:600}}>excl.</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {years.length===0&&(
            <div style={{textAlign:'center',padding:'40px 20px'}}>
              <div style={{fontSize:44,marginBottom:12}}>📅</div>
              <p style={{color:C.textSec,fontSize:14}}>No closed trades yet.</p>
              <p style={{color:C.textMuted,fontSize:12,marginTop:4}}>Close a position to see annual performance.</p>
            </div>
          )}

          {/* YTD summary box */}
          {years.includes(thisYear)&&(
            <div style={{background:`linear-gradient(135deg,rgba(108,99,255,.1),rgba(82,201,134,.06))`,border:`1px solid rgba(108,99,255,.2)`,borderRadius:14,padding:14,marginTop:4}}>
              <div style={{color:C.accent,fontSize:11,fontWeight:700,marginBottom:8}}>{thisYear} YTD · all accounts · excl. cash</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[['Total P&L',fmtMoney(FUND_GROUPS.reduce((s,fg)=>s+calcForYear(archived,fg,thisYear).realized,0)),'green'],
                  ['Best account',FUND_GROUPS.reduce((a,fg)=>{ const p=calcForYear(archived,fg,thisYear); return p.pnlPct>=(a.pct||0)?{name:fg,pct:p.pnlPct}:a },{}).name||'—','accent']
                ].map(([l,v,color])=>(
                  <div key={l} style={{background:C.card,borderRadius:10,padding:'8px 10px',textAlign:'center'}}>
                    <div style={{color:C.textMuted,fontSize:9,marginBottom:3}}>{l}</div>
                    <div style={{color:color==='green'?C.success:C.accent,fontSize:13,fontWeight:700}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
