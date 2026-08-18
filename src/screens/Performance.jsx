import { useState } from 'react'
import { useTrading, FUND_GROUPS, FUND_COLORS } from '../store/tradingStore.jsx'
import { C } from '../utils/helpers.js'

const fmt$ = (n,dec=2) => `$${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec})}`
const fmtPnl = (n) => `${n>=0?'+':'-'}${fmt$(n)}`
const fmtPct = (n) => `${n>=0?'+':''}${parseFloat(n).toFixed(2)}%`

const PERIODS = [
  { k:'1W',  label:'1W',  days:7 },
  { k:'1M',  label:'1M',  days:30 },
  { k:'3M',  label:'3M',  days:90 },
  { k:'6M',  label:'6M',  days:180 },
  { k:'1Y',  label:'1Y',  days:365 },
  { k:'YTD', label:'YTD', isYTD:true },
  { k:'ALL', label:'All', days:null },
]

function ytdDays() {
  const now=new Date(), start=new Date(now.getFullYear(),0,1)
  return Math.ceil((now-start)/86400000)
}

function calcPeriod(archived, positions, fg, days, isYTD) {
  const d = isYTD ? ytdDays() : days
  const cutoff = d ? new Date(Date.now()-d*86400000) : null
  const closed = archived.filter(p=>{
    if (fg&&p.fundGroup!==fg) return false
    if (!cutoff) return true
    return new Date(p.closedAt)>=cutoff
  })
  const realized = closed.reduce((s,p)=>s+(p.pnl||0),0)
  const wins     = closed.filter(p=>p.pnl>0).length
  const active   = positions.filter(p=>(!fg||p.fundGroup===fg)&&!p.isClosed)
  const invested = active.reduce((s,p)=>s+(p.avgPrice*p.totalQty),0)
  const pnlPct   = invested>0?(realized/invested)*100:0
  const best     = closed.length?closed.reduce((a,b)=>a.pnl>b.pnl?a:b,closed[0]):null
  const worst    = closed.length?closed.reduce((a,b)=>a.pnl<b.pnl?a:b,closed[0]):null
  return { realized, invested, count:closed.length, wins, losses:closed.length-wins, winRate:closed.length?wins/closed.length*100:0, pnlPct, best, worst, closed }
}

function calcYear(archived, fg, year) {
  const closed = archived.filter(p=>{
    if (fg&&p.fundGroup!==fg) return false
    return new Date(p.closedAt).getFullYear()===year
  })
  const realized = closed.reduce((s,p)=>s+(p.pnl||0),0)
  const invested = closed.reduce((s,p)=>s+Math.abs((p.avgPrice||0)*((p.sellQty||0)||(p.totalQty||0))),0)
  const wins     = closed.filter(p=>p.pnl>0).length
  return { realized, pnlPct:invested>0?(realized/invested)*100:0, count:closed.length, wins }
}

export default function Performance() {
  const { archived, positions, cashMap } = useTrading()
  const [period,  setPeriod]  = useState('3M')
  const [selFund, setSelFund] = useState(null)
  const [view,    setView]    = useState('overview')

  const per    = PERIODS.find(p=>p.k===period)||PERIODS[2]
  const perf   = calcPeriod(archived, positions, selFund, per.days, per.isYTD)
  const years  = [...new Set(archived.map(p=>new Date(p.closedAt).getFullYear()))].sort((a,b)=>b-a)
  const thisYr = new Date().getFullYear()

  // Monthly bars
  const mCount = per.days ? Math.min(Math.ceil(per.days/30),12) : Math.max(years.length*2,6)
  const monthly = Array.from({length:mCount},(_,i)=>{
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-(mCount-1-i))
    const y=d.getFullYear(), m=d.getMonth()
    const mo=archived.filter(p=>{
      if(selFund&&p.fundGroup!==selFund) return false
      const pd=new Date(p.closedAt)
      return pd.getFullYear()===y&&pd.getMonth()===m
    })
    return { label:d.toLocaleDateString('en-US',{month:'short'}), pnl:mo.reduce((s,p)=>s+(p.pnl||0),0) }
  })
  const maxAbs = Math.max(...monthly.map(m=>Math.abs(m.pnl)),1)

  if (!archived.length && !positions.filter(p=>!p.isClosed).length) {
    return (
      <div style={{padding:'60px 20px',textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:16}}>📊</div>
        <div style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:8}}>No data yet</div>
        <div style={{color:C.textSec,fontSize:13}}>Add trades in the Trading tab to see performance</div>
      </div>
    )
  }

  return (
    <div style={{padding:'0 16px 100px',paddingTop:16}}>

      {/* View tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
        {[['overview','Overview'],['account','By account'],['annual','Annual']].map(([k,l])=>(
          <button key={k} onClick={()=>setView(k)} style={{marginRight:16,border:'none',borderBottom:`2px solid ${view===k?C.accent:'transparent'}`,background:'transparent',color:view===k?C.accent:C.textMuted,padding:'8px 0',fontSize:13,fontWeight:view===k?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {l}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:C.surface,borderRadius:10,padding:4}}>
        {PERIODS.map(p=>(
          <button key={p.k} onClick={()=>setPeriod(p.k)} style={{flex:1,background:period===p.k?C.card:'transparent',border:period===p.k?`1px solid ${C.border}`:'1px solid transparent',borderRadius:7,padding:'5px 2px',color:period===p.k?C.text:C.textMuted,fontSize:11,fontWeight:period===p.k?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'center'}}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {view==='overview'&&(
        <div>
          {/* Big P&L number — CoinGecko style */}
          <div style={{marginBottom:20}}>
            <div style={{color:C.textMuted,fontSize:12,marginBottom:4}}>Realized P&L · {per.label} · cash excluded</div>
            <div style={{color:perf.realized>=0?C.success:C.danger,fontSize:32,fontWeight:700,letterSpacing:'-0.5px'}}>{fmtPnl(perf.realized)}</div>
            <div style={{color:perf.pnlPct>=0?C.success:C.danger,fontSize:14,marginTop:4}}>{fmtPct(perf.pnlPct)} on invested capital</div>
            <div style={{display:'flex',gap:16,marginTop:10}}>
              <span style={{color:C.textSec,fontSize:12}}>{perf.count} trades</span>
              <span style={{color:C.success,fontSize:12}}>{perf.wins} wins</span>
              <span style={{color:C.danger,fontSize:12}}>{perf.losses} losses</span>
              <span style={{color:C.accent,fontSize:12}}>{perf.winRate.toFixed(0)}% win rate</span>
            </div>
          </div>

          {/* Bar chart */}
          {monthly.some(m=>m.pnl!==0)&&(
            <div style={{marginBottom:20}}>
              <div style={{color:C.textMuted,fontSize:11,marginBottom:8}}>Monthly P&L (cash excluded)</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:3,height:64}}>
                {monthly.map((m,i)=>{
                  const h = Math.max(Math.abs(m.pnl)/maxAbs*100, m.pnl!==0?4:1)
                  return (
                    <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                      <div style={{width:'100%',height:`${h}%`,background:m.pnl>=0?C.success:C.danger,borderRadius:'3px 3px 0 0',minHeight:m.pnl!==0?3:1,opacity:m.pnl===0?.2:1}}/>
                    </div>
                  )
                })}
              </div>
              <div style={{display:'flex',gap:3,marginTop:4}}>
                {monthly.map((m,i)=><div key={i} style={{flex:1,color:C.textMuted,fontSize:8,textAlign:'center'}}>{m.label}</div>)}
              </div>
            </div>
          )}

          {/* Best / worst */}
          {(perf.best||perf.worst)&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              {perf.best&&(
                <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'12px'}}>
                  <div style={{color:C.textMuted,fontSize:10,marginBottom:4}}>Best trade ({per.label})</div>
                  <div style={{color:C.text,fontSize:14,fontWeight:700}}>{perf.best.ticker}</div>
                  <div style={{color:C.success,fontSize:12,fontWeight:600}}>{fmtPnl(perf.best.pnl)}</div>
                  <div style={{color:C.success,fontSize:11}}>{fmtPct(perf.best.pnlPct)}</div>
                </div>
              )}
              {perf.worst&&(
                <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'12px'}}>
                  <div style={{color:C.textMuted,fontSize:10,marginBottom:4}}>Worst trade ({per.label})</div>
                  <div style={{color:C.text,fontSize:14,fontWeight:700}}>{perf.worst.ticker}</div>
                  <div style={{color:C.danger,fontSize:12,fontWeight:600}}>{fmtPnl(perf.worst.pnl)}</div>
                  <div style={{color:C.danger,fontSize:11}}>{fmtPct(perf.worst.pnlPct)}</div>
                </div>
              )}
            </div>
          )}

          {/* Per account summary */}
          <div style={{color:C.textSec,fontSize:12,fontWeight:600,marginBottom:10}}>By account</div>
          {FUND_GROUPS.map(fg=>{
            const p = calcPeriod(archived, positions, fg, per.days, per.isYTD)
            const cash = cashMap[fg]||0
            const active = positions.filter(x=>x.fundGroup===fg&&!x.isClosed)
            if (!p.count && !active.length && !cash) return null
            return (
              <div key={fg} onClick={()=>{setSelFund(fg);setView('account')}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:32,height:32,borderRadius:8,background:FUND_COLORS[fg]+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:FUND_COLORS[fg]}}/>
                  </div>
                  <div>
                    <div style={{color:C.text,fontSize:13,fontWeight:600}}>{fg}</div>
                    <div style={{color:C.textMuted,fontSize:11}}>{p.count} trades · {p.winRate.toFixed(0)}% win rate</div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{color:p.realized>=0?C.success:C.danger,fontSize:13,fontWeight:600}}>{p.count?fmtPnl(p.realized):'—'}</div>
                  <div style={{color:p.realized>=0?C.success:C.danger,fontSize:11}}>{p.count?fmtPct(p.pnlPct):'no trades'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── BY ACCOUNT ── */}
      {view==='account'&&(
        <div>
          {/* Account selector */}
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:16}}>
            <button onClick={()=>setSelFund(null)} style={{border:`1px solid ${!selFund?C.accent:C.border}`,borderRadius:20,padding:'5px 12px',background:!selFund?C.accentSoft:'transparent',color:!selFund?C.accent:C.textMuted,fontSize:12,fontWeight:!selFund?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>All</button>
            {FUND_GROUPS.map(fg=>(
              <button key={fg} onClick={()=>setSelFund(fg)} style={{border:`1px solid ${selFund===fg?FUND_COLORS[fg]:C.border}`,borderRadius:20,padding:'5px 12px',background:selFund===fg?FUND_COLORS[fg]+'18':'transparent',color:selFund===fg?FUND_COLORS[fg]:C.textMuted,fontSize:12,fontWeight:selFund===fg?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{fg}</button>
            ))}
          </div>

          {/* Big number */}
          <div style={{marginBottom:20}}>
            <div style={{color:C.textMuted,fontSize:12,marginBottom:4}}>{selFund||'All accounts'} · {per.label} · cash excluded</div>
            <div style={{color:perf.realized>=0?C.success:C.danger,fontSize:28,fontWeight:700}}>{fmtPnl(perf.realized)}</div>
            <div style={{color:perf.pnlPct>=0?C.success:C.danger,fontSize:13,marginTop:3}}>{fmtPct(perf.pnlPct)} return on capital</div>
          </div>

          {/* Bar chart */}
          {monthly.some(m=>m.pnl!==0)&&(
            <div style={{marginBottom:20}}>
              <div style={{color:C.textMuted,fontSize:11,marginBottom:8}}>Monthly P&L</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:3,height:56}}>
                {monthly.map((m,i)=>{
                  const h=Math.max(Math.abs(m.pnl)/maxAbs*100,m.pnl!==0?4:1)
                  return <div key={i} style={{flex:1,height:`${h}%`,background:m.pnl>=0?C.success:C.danger,borderRadius:'3px 3px 0 0',minHeight:m.pnl!==0?3:1,opacity:m.pnl===0?.2:1}}/>
                })}
              </div>
              <div style={{display:'flex',gap:3,marginTop:4}}>
                {monthly.map((m,i)=><div key={i} style={{flex:1,color:C.textMuted,fontSize:8,textAlign:'center'}}>{m.label}</div>)}
              </div>
            </div>
          )}

          {/* All periods table */}
          <div style={{color:C.textSec,fontSize:12,fontWeight:600,marginBottom:10}}>All periods</div>
          <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,overflow:'hidden',marginBottom:16}}>
            {PERIODS.map((p,i)=>{
              const pf = calcPeriod(archived, positions, selFund, p.days, p.isYTD)
              const isCur = p.k===period
              return (
                <div key={p.k} onClick={()=>setPeriod(p.k)} style={{display:'grid',gridTemplateColumns:'44px 1fr 60px 40px',gap:8,padding:'11px 14px',borderBottom:i<PERIODS.length-1?`1px solid ${C.border}`:'none',background:isCur?C.accentSoft:'transparent',cursor:'pointer',alignItems:'center'}}>
                  <span style={{color:isCur?C.accent:C.textSec,fontSize:12,fontWeight:isCur?700:400}}>{p.label}</span>
                  <div style={{display:'flex',alignItems:'center'}}>
                    {pf.count>0&&<div style={{height:4,borderRadius:2,background:pf.realized>=0?C.success:C.danger,width:`${Math.min(Math.abs(pf.pnlPct)*3,100)}%`,maxWidth:80,minWidth:pf.count?4:0}}/>}
                  </div>
                  <span style={{color:pf.realized>=0?C.success:C.danger,fontSize:12,fontWeight:600,textAlign:'right'}}>{pf.count?fmtPnl(pf.realized):'—'}</span>
                  <span style={{color:C.textMuted,fontSize:11,textAlign:'right'}}>{pf.count||'—'}</span>
                </div>
              )
            })}
          </div>

          {/* Win rate */}
          {perf.count>0&&(
            <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:14}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{color:C.textSec,fontSize:12}}>Win rate ({per.label})</span>
                <span style={{color:C.success,fontSize:12,fontWeight:600}}>{perf.winRate.toFixed(0)}% · {perf.wins}/{perf.count}</span>
              </div>
              <div style={{background:C.surface,borderRadius:3,height:6,overflow:'hidden'}}>
                <div style={{background:C.success,height:'100%',width:`${perf.winRate}%`,borderRadius:3}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                <span style={{color:C.success,fontSize:11}}>{perf.wins} wins</span>
                <span style={{color:C.danger,fontSize:11}}>{perf.losses} losses</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ANNUAL ── */}
      {view==='annual'&&(
        <div>
          <div style={{color:C.textMuted,fontSize:12,marginBottom:16}}>Year by year · all accounts · cash excluded from all %</div>

          {years.length===0?(
            <div style={{textAlign:'center',padding:'40px 20px'}}>
              <div style={{fontSize:44,marginBottom:12}}>📅</div>
              <p style={{color:C.textSec}}>Close some trades to see annual performance.</p>
            </div>
          ):(
            <>
              {/* Annual bar chart */}
              <div style={{marginBottom:24}}>
                <div style={{color:C.textMuted,fontSize:11,marginBottom:8}}>Annual P&L · all accounts</div>
                <div style={{display:'flex',alignItems:'flex-end',gap:8,height:80}}>
                  {years.slice().reverse().map(y=>{
                    const pnl=FUND_GROUPS.reduce((s,fg)=>s+calcYear(archived,fg,y).realized,0)
                    const mx=Math.max(...years.map(yr=>Math.abs(FUND_GROUPS.reduce((s,fg)=>s+calcYear(archived,fg,yr).realized,0))),1)
                    const h=Math.max(Math.abs(pnl)/mx*100,4)
                    const isCur=y===thisYr
                    return (
                      <div key={y} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                        <div style={{color:pnl>=0?C.success:C.danger,fontSize:9,fontWeight:isCur?700:400}}>{pnl>=0?'+':''}{(pnl/1000).toFixed(1)}K</div>
                        <div style={{width:'100%',height:`${h}%`,background:isCur?C.accent:pnl>=0?C.success:C.danger,borderRadius:'3px 3px 0 0'}}/>
                      </div>
                    )
                  })}
                </div>
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  {years.slice().reverse().map(y=>(
                    <div key={y} style={{flex:1,color:y===thisYr?C.accent:C.textMuted,fontSize:9,textAlign:'center',fontWeight:y===thisYr?700:400}}>{y}</div>
                  ))}
                </div>
              </div>

              {/* Per year + per account */}
              {years.map(y=>(
                <div key={y} style={{marginBottom:20}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${C.border}`}}>
                    <span style={{color:y===thisYr?C.accent:C.text,fontSize:14,fontWeight:600}}>{y} {y===thisYr?'(current)':''}</span>
                    <span style={{color:C.textMuted,fontSize:11}}>cash excluded</span>
                  </div>
                  {FUND_GROUPS.map(fg=>{
                    const p=calcYear(archived,fg,y)
                    if(!p.count) return null
                    return (
                      <div key={fg} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}22`}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:6,height:6,borderRadius:'50%',background:FUND_COLORS[fg]}}/>
                          <span style={{color:C.text,fontSize:12}}>{fg}</span>
                          <span style={{color:C.textMuted,fontSize:11}}>{p.count} trades · {p.count?Math.round(p.wins/p.count*100):0}% win</span>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <span style={{color:p.realized>=0?C.success:C.danger,fontSize:12,fontWeight:600}}>{fmtPnl(p.realized)}</span>
                          <span style={{color:p.realized>=0?C.success:C.danger,fontSize:11,marginLeft:6}}>{fmtPct(p.pnlPct)}</span>
                        </div>
                      </div>
                    )
                  })}
                  {/* Year total */}
                  <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',marginTop:2}}>
                    <span style={{color:C.textSec,fontSize:12,fontWeight:600}}>Total {y}</span>
                    {(()=>{
                      const tot=FUND_GROUPS.reduce((s,fg)=>s+calcYear(archived,fg,y).realized,0)
                      return <span style={{color:tot>=0?C.success:C.danger,fontSize:12,fontWeight:700}}>{fmtPnl(tot)}</span>
                    })()}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
