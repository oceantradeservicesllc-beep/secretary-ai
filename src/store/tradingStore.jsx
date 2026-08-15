import { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)
const load = (k,fb) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb}catch{return fb} }
const save = (k,v)  => { try{localStorage.setItem(k,JSON.stringify(v))}catch{} }
const uid  = () => Math.random().toString(36).slice(2)+Date.now().toString(36)

export const FUND_GROUPS = ['401k','Roth IRA','Perso','Emcy Fund']
export const FUND_COLORS = {'401k':'#6C63FF','Roth IRA':'#52C986','Perso':'#45B7D1','Emcy Fund':'#FF9F43'}
export const TRADE_TYPES = [
  {k:'S',label:'Short',full:'Short (1–7 days)',  color:'#FF9F43'},
  {k:'M',label:'Mid',  full:'Mid (1–3 months)', color:'#45B7D1'},
  {k:'L',label:'Long', full:'Long (6–12 months)',color:'#C984E0'},
]
export const ASSET_TYPES = ['Stock','Crypto','Futures','Contract']

export function TradingProvider({children}) {
  const [positions, setPositionsRaw] = useState(()=>load('sai_pos',[]))
  const [archived,  setArchivedRaw]  = useState(()=>load('sai_arch',[]))
  const [cashMap,   setCashMapRaw]   = useState(()=>load('sai_cash',{}))

  const setPositions = useCallback(v=>{setPositionsRaw(v);save('sai_pos',v)},[])
  const setArchived  = useCallback(v=>{setArchivedRaw(v); save('sai_arch',v)},[])
  const setCashMap   = useCallback(v=>{setCashMapRaw(v);  save('sai_cash',v)},[])

  // ── Add trade / average into existing ────────────────────────────────────
  const addTrade = useCallback((trade)=>{
    const {ticker,assetType,price,qty,fundGroup,tradeType,date,side,notes} = trade
    const sym = ticker.toUpperCase().trim()
    const bp  = parseFloat(price)
    const q   = parseFloat(qty)
    const d   = date||new Date().toISOString().split('T')[0]
    const sl  = parseFloat((bp*0.95).toFixed(6))
    let result = {ticker:sym, stopLoss:sl, tradeDate:d}

    setPositions(prev=>{
      const idx = prev.findIndex(p=>p.ticker===sym&&p.fundGroup===fundGroup&&!p.isClosed)
      if(idx>=0 && side==='BUY'){
        const ex=prev[idx]
        const tq=ex.totalQty+q
        const avg=((ex.avgPrice*ex.totalQty)+(bp*q))/tq
        const newSl=parseFloat((avg*0.95).toFixed(6))
        result.stopLoss=newSl
        const updated={...ex,avgPrice:parseFloat(avg.toFixed(6)),totalQty:tq,stopLoss:newSl,
          purchases:[...ex.purchases,{id:uid(),price:bp,qty:q,date:d}],updatedAt:new Date().toISOString()}
        const next=[...prev]; next[idx]=updated; return next
      }
      return [{id:uid(),ticker:sym,assetType:assetType||'Stock',side:side||'BUY',fundGroup,
        tradeType,avgPrice:bp,totalQty:q,stopLoss:sl,
        purchases:[{id:uid(),price:bp,qty:q,date:d}],firstDate:d,
        notes:notes||'',isClosed:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
      },...prev]
    })
    return result
  },[setPositions])

  // ── Close / sell ──────────────────────────────────────────────────────────
  const closeTrade = useCallback((posId,sellPrice,sellQty,sellDate,notes)=>{
    setPositions(prev=>{
      const pos=prev.find(p=>p.id===posId); if(!pos) return prev
      const sp=parseFloat(sellPrice), sq=parseFloat(sellQty)||pos.totalQty
      const sd=sellDate||new Date().toISOString().split('T')[0]
      const pnl=(sp-pos.avgPrice)*sq
      const pnlPct=((sp-pos.avgPrice)/pos.avgPrice)*100
      const daysHeld=Math.round((new Date(sd)-new Date(pos.firstDate))/86400000)
      setArchived(a=>[{...pos,sellPrice:sp,sellQty:sq,sellDate:sd,
        pnl:parseFloat(pnl.toFixed(2)),pnlPct:parseFloat(pnlPct.toFixed(2)),daysHeld,
        sellNotes:notes||'',isClosed:true,closedAt:new Date().toISOString()},...a])
      if(sq<pos.totalQty) return prev.map(p=>p.id===posId?{...p,totalQty:p.totalQty-sq,updatedAt:new Date().toISOString()}:p)
      return prev.filter(p=>p.id!==posId)
    })
  },[setPositions,setArchived])

  const deletePosition = useCallback(id=>setPositions(prev=>prev.filter(p=>p.id!==id)),[setPositions])
  const setCash = useCallback((fg,amt)=>setCashMap(prev=>({...prev,[fg]:parseFloat(amt)||0})),[setCashMap])

  // ── Performance — cash always excluded from % ─────────────────────────────
  const calcPerf = useCallback((fg,days)=>{
    const cutoff = days?new Date(Date.now()-days*86400000):null
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
    return{realized,invested,count:closed.length,wins,losses:closed.length-wins,winRate:closed.length?wins/closed.length*100:0,closed,best,worst}
  },[positions,archived])

  // ── Parse "CMBT / 15.05 / 30 / 21/07/2026 / 401k / S" ───────────────────
  const parseQuick = useCallback(str=>{
    const parts=str.split('/').map(s=>s.trim())
    if(parts.length<3) return null
    const [ticker,price,qty,datePart,fund,type]=parts
    const fg=fund?FUND_GROUPS.find(f=>f.toLowerCase().includes(fund.toLowerCase()))||'401k':'401k'
    const tt=type?TRADE_TYPES.find(t=>t.k.toLowerCase()===type.trim()[0].toLowerCase())||TRADE_TYPES[0]:TRADE_TYPES[0]
    let d=new Date().toISOString().split('T')[0]
    if(datePart&&/\d/.test(datePart)){
      const p=datePart.trim().split(/[\/\-]/)
      if(p.length===3&&p[2].length===4) d=`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
    }
    return{ticker:ticker.toUpperCase(),price:parseFloat(price),qty:parseFloat(qty),fundGroup:fg,tradeType:tt.k,date:d}
  },[])

  return(
    <Ctx.Provider value={{positions,archived,cashMap,addTrade,closeTrade,deletePosition,setCash,calcPerf,parseQuick}}>
      {children}
    </Ctx.Provider>
  )
}
export const useTrading = ()=>useContext(Ctx)
