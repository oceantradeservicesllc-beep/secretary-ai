import { useState, useEffect, useCallback } from 'react'
import { useTrading, FUND_GROUPS, FUND_COLORS, TRADE_TYPES, ASSET_TYPES } from '../store/tradingStore.jsx'
import { fetchLivePrice, fetchPrices, formatPrice, isCryptoTicker } from '../services/marketData.js'
import { C } from '../utils/helpers.js'
import { Spin } from '../components/UI.jsx'

const TT_COLOR = { S:'#FF9F43', M:'#45B7D1', L:'#C984E0' }
const fmt$   = (n,d=2) => `$${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})}`
const fmtPnl = (n)     => `${n>=0?'+':'-'}${fmt$(n)}`
const fmtPct = (n)     => `${n>=0?'+':''}${parseFloat(n).toFixed(2)}%`
const fmtP   = (p,cr)  => formatPrice(p, cr)

export default function Trading() {
  const [tab, setTab] = useState('portfolio')
  return (
    <div style={{padding:'0 0 100px'}}>
      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`}}>
        {[['portfolio','Portfolio'],['add','+ Add'],['archive','History']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{flex:1,border:'none',borderBottom:`2px solid ${tab===k?C.accent:'transparent'}`,
              background:'transparent',color:tab===k?C.accent:C.textMuted,
              padding:'12px 4px',fontSize:13,fontWeight:tab===k?600:400,
              cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {l}
          </button>
        ))}
      </div>
      <div style={{padding:'0 16px'}}>
        {tab==='portfolio' && <Portfolio onAdd={()=>setTab('add')}/>}
        {tab==='add'       && <AddTrade  onDone={()=>setTab('portfolio')}/>}
        {tab==='archive'   && <Archive/>}
      </div>
    </div>
  )
}

// ── Portfolio ─────────────────────────────────────────────────────────────────
function Portfolio({ onAdd }) {
  const { positions, cashMap, setCash, deletePosition, closeTrade, editPosition } = useTrading()
  const [prices,     setPrices]     = useState({})
  const [loading,    setLoading]    = useState(false)
  const [priceErr,   setPriceErr]   = useState('')
  const [lastSync,   setLastSync]   = useState(null)
  const [sellModal,  setSellModal]  = useState(null)
  const [editModal,  setEditModal]  = useState(null)

  const active  = positions.filter(p=>!p.isClosed)
  const tickers = [...new Set(active.map(p=>p.ticker))]

  const refresh = useCallback(async () => {
    if (!tickers.length) return
    setLoading(true); setPriceErr('')
    const res = await fetchPrices(tickers)
    if (!Object.keys(res).length) setPriceErr('Live prices unavailable — showing cost basis')
    setPrices(res); setLastSync(new Date()); setLoading(false)
  }, [tickers.join(',')]) // eslint-disable-line

  useEffect(() => { refresh() }, [active.length]) // eslint-disable-line

  const totalCost = active.reduce((s,p)=>s+(p.avgPrice*p.totalQty), 0)
  const totalLive = active.reduce((s,p)=>s+((prices[p.ticker]?.price||p.avgPrice)*p.totalQty), 0)
  const totalPnL  = totalLive-totalCost
  const totalPct  = totalCost>0?(totalPnL/totalCost)*100:0
  const sources   = [...new Set(Object.values(prices).map(p=>p.source))].join(' · ')

  if (!active.length && !Object.values(cashMap).some(v=>v>0)) return (
    <div style={{textAlign:'center',padding:'60px 20px'}}>
      <div style={{fontSize:48,marginBottom:16}}>📊</div>
      <div style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:8}}>No positions yet</div>
      <div style={{color:C.textSec,fontSize:13,marginBottom:24}}>Track trades across all your accounts</div>
      <button onClick={onAdd} style={{background:C.accent,border:'none',borderRadius:12,padding:'12px 28px',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>+ Add First Trade</button>
    </div>
  )

  return (
    <div style={{paddingTop:16}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{color:C.textMuted,fontSize:12,marginBottom:4}}>Total portfolio (excl. cash)</div>
        <div style={{color:C.text,fontSize:28,fontWeight:700,letterSpacing:'-0.5px'}}>{fmt$(totalLive)}</div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
          <span style={{background:totalPnL>=0?'rgba(82,201,134,.15)':'rgba(255,94,94,.15)',
            color:totalPnL>=0?C.success:C.danger,fontSize:13,fontWeight:600,padding:'2px 8px',borderRadius:6}}>
            {fmtPnl(totalPnL)} ({fmtPct(totalPct)})
          </span>
          <span style={{color:C.textMuted,fontSize:11}}>all time</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
          {loading
            ? <><Spin size={12} color={C.textMuted}/><span style={{color:C.textMuted,fontSize:11}}>Fetching prices…</span></>
            : <span style={{color:C.textMuted,fontSize:11}}>
                {lastSync?`Updated ${lastSync.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`:''}{sources?` · ${sources}`:''}
              </span>
          }
          <button onClick={refresh} disabled={loading}
            style={{marginLeft:'auto',background:'none',border:`1px solid ${C.border}`,borderRadius:6,
              padding:'3px 10px',color:C.accent,fontSize:11,cursor:loading?'not-allowed':'pointer',fontFamily:'Inter,sans-serif'}}>
            ↻ Refresh
          </button>
        </div>
        {priceErr&&<div style={{color:C.warning,fontSize:11,marginTop:4}}>⚠️ {priceErr}</div>}
      </div>

      {/* By fund group */}
      {FUND_GROUPS.map(fg=>{
        const fps  = active.filter(p=>p.fundGroup===fg)
        const cash = cashMap[fg]||0
        if (!fps.length&&!cash) return null
        const inv  = fps.reduce((s,p)=>s+(p.avgPrice*p.totalQty),0)
        const live = fps.reduce((s,p)=>s+((prices[p.ticker]?.price||p.avgPrice)*p.totalQty),0)
        const pnl  = live-inv
        const pct  = inv>0?(pnl/inv)*100:0
        return (
          <div key={fg} style={{marginBottom:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:FUND_COLORS[fg]}}/>
                <span style={{color:C.text,fontSize:14,fontWeight:600}}>{fg}</span>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{color:C.text,fontSize:14,fontWeight:600}}>{fmt$(live+cash)}</div>
                {inv>0&&<div style={{color:pnl>=0?C.success:C.danger,fontSize:11}}>{fmtPnl(pnl)} ({fmtPct(pct)})</div>}
              </div>
            </div>
            {fps.map(p=>(
              <HoldingRow key={p.id} pos={p} priceData={prices[p.ticker]}
                onSell={()=>setSellModal(p)}
                onEdit={()=>setEditModal(p)}
                onDelete={()=>{ if(window.confirm(`Delete ${p.ticker}?`)) deletePosition(p.id) }}/>
            ))}
            <CashRow fg={fg} cash={cash} color={FUND_COLORS[fg]} onSet={amt=>setCash(fg,amt)}/>
          </div>
        )
      })}

      {sellModal&&(
        <SellModal pos={sellModal} priceData={prices[sellModal.ticker]}
          onClose={()=>setSellModal(null)}
          onConfirm={(sp,sq,sd)=>{ closeTrade(sellModal.id,sp,sq,sd,''); setSellModal(null) }}/>
      )}
      {editModal&&(
        <EditModal pos={editModal}
          onClose={()=>setEditModal(null)}
          onSave={(u)=>{ editPosition(editModal.id,u); setEditModal(null) }}/>
      )}
    </div>
  )
}

// ── Holding Row ───────────────────────────────────────────────────────────────
function HoldingRow({ pos, priceData, onSell, onEdit, onDelete }) {
  const [exp,setExp] = useState(false)
  const cr      = isCryptoTicker(pos.ticker)
  const lp      = priceData?.ok ? priceData.price : null
  const chgPct  = priceData?.changePct ?? null
  const pnl     = lp!=null ? (lp-pos.avgPrice)*pos.totalQty : null
  const pnlPct  = lp!=null ? ((lp-pos.avgPrice)/pos.avgPrice)*100 : null
  const nearStop= lp!=null && lp<=pos.stopLoss*1.02
  const tt      = TRADE_TYPES.find(t=>t.k===pos.tradeType)||TRADE_TYPES[0]

  return (
    <div style={{marginBottom:2}}>
      <div onClick={()=>setExp(!exp)}
        style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,padding:'10px 0',
          cursor:'pointer',borderBottom:exp?'none':`1px solid ${C.border}22`}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{width:38,height:38,borderRadius:10,
            background:nearStop?'rgba(255,94,94,.15)':'rgba(108,99,255,.12)',
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <span style={{color:nearStop?C.danger:C.accent,fontSize:10,fontWeight:700}}>
              {pos.ticker.slice(0,4)}
            </span>
          </div>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
              <span style={{color:C.text,fontSize:13,fontWeight:600}}>{pos.ticker}</span>
              <span style={{background:TT_COLOR[pos.tradeType]+'22',color:TT_COLOR[pos.tradeType],
                fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4}}>{tt.label}</span>
              {pos.purchases?.length>1&&
                <span style={{color:C.accent,fontSize:9}}>×{pos.purchases.length} avg</span>}
            </div>
            <div style={{color:C.textMuted,fontSize:11}}>
              {pos.totalQty} · avg {fmtP(pos.avgPrice,cr)}
              {lp!=null&&chgPct!=null&&
                <span style={{color:chgPct>=0?C.success:C.danger,marginLeft:6}}>
                  {fmtPct(chgPct)} today
                </span>}
              {priceData?.source&&
                <span style={{color:C.textMuted,fontSize:9,marginLeft:5}}>· {priceData.source}</span>}
            </div>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{color:C.text,fontSize:13,fontWeight:600}}>
            {lp!=null ? fmtP(lp,cr) : '—'}
          </div>
          {pnl!=null
            ? <div style={{color:pnl>=0?C.success:C.danger,fontSize:11}}>
                {fmtPnl(pnl)} ({fmtPct(pnlPct)})
              </div>
            : <div style={{color:C.textMuted,fontSize:11}}>cost {fmt$(pos.avgPrice*pos.totalQty)}</div>
          }
        </div>
      </div>

      {nearStop&&(
        <div style={{background:'rgba(255,94,94,.08)',borderRadius:6,padding:'4px 10px',
          margin:'2px 0',display:'flex',justifyContent:'space-between'}}>
          <span style={{color:C.danger,fontSize:11,fontWeight:600}}>⚠️ Near stop loss</span>
          <span style={{color:C.danger,fontSize:11}}>Stop: {fmtP(pos.stopLoss,cr)}</span>
        </div>
      )}

      {exp&&(
        <div style={{background:C.surface,borderRadius:10,padding:12,marginBottom:8}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
            {[
              ['Value',    lp!=null?fmt$(lp*pos.totalQty):fmt$(pos.avgPrice*pos.totalQty)],
              ['Stop',     fmtP(pos.stopLoss,cr)],
              ['Invested', fmt$(pos.avgPrice*pos.totalQty)],
            ].map(([l,v])=>(
              <div key={l}>
                <div style={{color:C.textMuted,fontSize:9,marginBottom:2}}>{l}</div>
                <div style={{color:C.text,fontSize:12,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>

          {pos.purchases?.length>1&&(
            <div style={{marginBottom:10}}>
              <div style={{color:C.textMuted,fontSize:10,marginBottom:4}}>
                Purchase history (averaged)
              </div>
              {pos.purchases.map((pu,i)=>(
                <div key={pu.id||i} style={{display:'flex',justifyContent:'space-between',
                  padding:'3px 0',borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:C.textMuted,fontSize:11}}>#{i+1} · {pu.date}</span>
                  <span style={{color:C.textSec,fontSize:11}}>{fmtP(pu.price,cr)} × {pu.qty}</span>
                </div>
              ))}
            </div>
          )}

          {pos.notes&&(
            <p style={{color:C.textSec,fontSize:11,marginBottom:10,fontStyle:'italic'}}>
              {pos.notes}
            </p>
          )}

          <div style={{display:'flex',gap:8}}>
            <button onClick={onEdit}
              style={{flex:1,background:C.accentSoft,border:`1px solid rgba(108,99,255,.3)`,
                borderRadius:8,padding:'9px',color:C.accent,fontSize:12,fontWeight:600,
                cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              ✏️ Edit
            </button>
            <button onClick={onSell}
              style={{flex:1,background:'rgba(82,201,134,.1)',border:`1px solid rgba(82,201,134,.3)`,
                borderRadius:8,padding:'9px',color:C.success,fontSize:12,fontWeight:600,
                cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              Sell
            </button>
            <button onClick={onDelete}
              style={{background:'rgba(255,94,94,.1)',border:`1px solid rgba(255,94,94,.2)`,
                borderRadius:8,padding:'9px 12px',color:C.danger,fontSize:12,
                cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              🗑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ pos, onClose, onSave }) {
  const cr = isCryptoTicker(pos.ticker)
  const [ticker,    setTicker]    = useState(pos.ticker)
  const [assetType, setAssetType] = useState(pos.assetType||'Stock')
  const [avgPrice,  setAvgPrice]  = useState(String(pos.avgPrice))
  const [totalQty,  setTotalQty]  = useState(String(pos.totalQty))
  const [stopLoss,  setStopLoss]  = useState(String(pos.stopLoss))
  const [fundGroup, setFundGroup] = useState(pos.fundGroup)
  const [tradeType, setTradeType] = useState(pos.tradeType)
  const [notes,     setNotes]     = useState(pos.notes||'')
  const [err,       setErr]       = useState('')

  // Auto-recalc stop loss at -5% when avg price changes
  useEffect(()=>{
    if (avgPrice&&parseFloat(avgPrice)>0)
      setStopLoss((parseFloat(avgPrice)*0.95).toFixed(cr?6:2))
  },[avgPrice,cr])

  function handleSave() {
    if (!ticker.trim()||!avgPrice||!totalQty) {
      setErr('Ticker, price and qty are required.'); return
    }
    onSave({
      ticker:    ticker.trim().toUpperCase(),
      assetType, fundGroup, tradeType, notes,
      avgPrice:  parseFloat(avgPrice),
      totalQty:  parseFloat(totalQty),
      stopLoss:  parseFloat(stopLoss),
    })
  }

  return (
    <div onClick={onClose}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,
        display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.card,borderRadius:'20px 20px 0 0',width:'100%',
          padding:20,maxHeight:'90vh',overflowY:'auto'}}>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <h3 style={{color:C.text,fontSize:18,fontWeight:700}}>Edit — {pos.ticker}</h3>
          <button onClick={onClose}
            style={{background:C.surface,border:'none',borderRadius:8,width:30,height:30,
              cursor:'pointer',color:C.textSec,fontSize:18}}>✕</button>
        </div>

        <div style={{background:'rgba(255,159,67,.08)',border:'1px solid rgba(255,159,67,.25)',
          borderRadius:9,padding:'8px 12px',marginBottom:14}}>
          <span style={{color:C.warning,fontSize:12}}>
            ⚠️ Editing corrects the record — does not adjust cash balance automatically.
          </span>
        </div>

        <MF label="Ticker" value={ticker} onChange={v=>setTicker(v.toUpperCase())} placeholder="AAPL"/>

        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Asset type</label>
          <div style={{display:'flex',gap:5}}>
            {ASSET_TYPES.map(t=>(
              <button key={t} onClick={()=>setAssetType(t)}
                style={{flex:1,border:`1px solid ${assetType===t?C.accent:C.border}`,borderRadius:7,
                  padding:'6px 4px',background:assetType===t?C.accentSoft:'transparent',
                  color:assetType===t?C.accent:C.textSec,fontSize:11,cursor:'pointer',
                  fontFamily:'Inter,sans-serif'}}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:0}}>
          <MF label="Avg price *" value={avgPrice} onChange={setAvgPrice} type="number" placeholder="0.00"/>
          <MF label="Quantity *"  value={totalQty} onChange={setTotalQty} type="number" placeholder="10"/>
        </div>

        <MF label="Stop loss (auto −5%)" value={stopLoss} onChange={setStopLoss} type="number" placeholder="0.00"/>

        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Account</label>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {FUND_GROUPS.map(fg=>(
              <button key={fg} onClick={()=>setFundGroup(fg)}
                style={{border:`1px solid ${fundGroup===fg?FUND_COLORS[fg]:C.border}`,borderRadius:7,
                  padding:'5px 10px',background:fundGroup===fg?FUND_COLORS[fg]+'18':'transparent',
                  color:fundGroup===fg?FUND_COLORS[fg]:C.textSec,fontSize:11,
                  fontWeight:fundGroup===fg?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                {fg}
              </button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Trade horizon</label>
          <div style={{display:'flex',gap:8}}>
            {TRADE_TYPES.map(tt=>(
              <button key={tt.k} onClick={()=>setTradeType(tt.k)}
                style={{flex:1,border:`1px solid ${tradeType===tt.k?tt.color:C.border}`,borderRadius:8,
                  padding:'8px 4px',background:tradeType===tt.k?tt.color+'18':'transparent',
                  cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'center'}}>
                <div style={{color:tt.color,fontSize:12,fontWeight:700}}>{tt.k}</div>
                <div style={{color:tradeType===tt.k?tt.color:C.textMuted,fontSize:9}}>{tt.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Notes</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
            style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,
              borderRadius:9,padding:'8px 12px',color:C.text,fontSize:12,
              fontFamily:'Inter,sans-serif',resize:'none',outline:'none'}}/>
        </div>

        {err&&<div style={{background:'rgba(255,94,94,.1)',borderRadius:8,padding:'8px 12px',
          color:C.danger,fontSize:12,marginBottom:10}}>{err}</div>}

        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose}
            style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,
              padding:12,color:C.textSec,fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            Cancel
          </button>
          <button onClick={handleSave}
            style={{flex:2,background:C.accent,border:'none',borderRadius:12,padding:12,
              color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Cash Row ──────────────────────────────────────────────────────────────────
function CashRow({ fg, cash, color, onSet }) {
  const [editing,setEditing] = useState(false)
  const [val,    setVal]     = useState(String(cash||''))
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      padding:'8px 0',borderBottom:`1px solid ${C.border}22`}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:38,height:38,borderRadius:10,background:color+'15',
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:18}}>
          💵
        </div>
        <div>
          <div style={{color:C.text,fontSize:13,fontWeight:600}}>Cash</div>
          <div style={{color:C.textMuted,fontSize:10}}>Excluded from P&L %</div>
        </div>
      </div>
      {editing
        ? <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <input type="number" value={val} onChange={e=>setVal(e.target.value)} autoFocus
              style={{width:90,background:C.card,border:`1px solid ${C.accent}`,borderRadius:7,
                padding:'5px 8px',color:C.text,fontSize:12,fontFamily:'Inter,sans-serif',outline:'none'}}/>
            <button onClick={()=>{onSet(parseFloat(val)||0);setEditing(false)}}
              style={{background:C.success,border:'none',borderRadius:7,padding:'5px 10px',
                color:'#fff',fontSize:12,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>✓</button>
            <button onClick={()=>setEditing(false)}
              style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,
                padding:'5px 8px',color:C.textSec,fontSize:12,cursor:'pointer',
                fontFamily:'Inter,sans-serif'}}>✕</button>
          </div>
        : <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{color:C.text,fontSize:13,fontWeight:600}}>{fmt$(cash||0)}</span>
            <button onClick={()=>{setVal(String(cash||''));setEditing(true)}}
              style={{background:'none',border:`1px solid ${C.border}`,borderRadius:6,
                padding:'3px 8px',color:C.textSec,fontSize:11,cursor:'pointer',
                fontFamily:'Inter,sans-serif'}}>Edit</button>
          </div>
      }
    </div>
  )
}

// ── Add Trade ─────────────────────────────────────────────────────────────────
function AddTrade({ onDone }) {
  const { addTrade, parseQuick } = useTrading()
  const [quick,       setQuick]       = useState('')
  const [ticker,      setTicker]      = useState('')
  const [assetType,   setAssetType]   = useState('Stock')
  const [price,       setPrice]       = useState('')
  const [qty,         setQty]         = useState('')
  const [fundGroup,   setFundGroup]   = useState('401k')
  const [tradeType,   setTradeType]   = useState('S')
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0])
  const [side,        setSide]        = useState('BUY')
  const [notes,       setNotes]       = useState('')
  const [err,         setErr]         = useState('')
  const [saved,       setSaved]       = useState(false)
  const [fetching,    setFetching]    = useState(false)
  const [priceSource, setPriceSource] = useState('')

  async function getLivePrice() {
    if (!ticker.trim()) return
    setFetching(true); setErr(''); setPriceSource('')
    const d = await fetchLivePrice(ticker.trim())
    if (d.ok) {
      setPrice(d.price.toFixed(isCryptoTicker(ticker)?4:2))
      setPriceSource(d.source)
    } else {
      setErr(`No live price found for ${ticker.toUpperCase()} — enter price manually`)
    }
    setFetching(false)
  }

  function applyQuick() {
    const r = parseQuick(quick)
    if (!r) { setErr('Format: TICKER / price / qty / dd/mm/yyyy / fund / S|M|L'); return }
    setTicker(r.ticker); setPrice(String(r.price)); setQty(String(r.qty))
    setFundGroup(r.fundGroup); setTradeType(r.tradeType); setDate(r.date); setErr('')
  }

  function handleSave() {
    if (!ticker.trim()||!price||!qty) { setErr('Ticker, price and qty are required.'); return }
    addTrade({ ticker, assetType, price, qty, fundGroup, tradeType, date, side, notes })
    setSaved(true); setTimeout(()=>{ setSaved(false); onDone() }, 1200)
  }

  const sl = price&&parseFloat(price)>0 ? parseFloat(price)*0.95 : null

  return (
    <div style={{paddingTop:16}}>
      {/* Quick entry */}
      <div style={{background:C.accentSoft,border:`1px solid rgba(108,99,255,.25)`,
        borderRadius:12,padding:12,marginBottom:16}}>
        <div style={{color:C.accent,fontSize:12,fontWeight:600,marginBottom:2}}>⚡ Quick entry</div>
        <div style={{color:C.textMuted,fontSize:10,marginBottom:8}}>
          TICKER / price / qty / dd/mm/yyyy / fund / S|M|L
        </div>
        <div style={{display:'flex',gap:8}}>
          <input value={quick} onChange={e=>setQuick(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&applyQuick()}
            placeholder="NVDA / 130.50 / 10 / 401k / S"
            style={{flex:1,background:'rgba(255,255,255,.06)',border:`1px solid ${C.border}`,
              borderRadius:8,padding:'8px 10px',color:C.text,fontSize:12,
              fontFamily:'Inter,sans-serif',outline:'none'}}/>
          <button onClick={applyQuick}
            style={{background:C.accent,border:'none',borderRadius:8,padding:'8px 14px',
              color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            Fill
          </button>
        </div>
      </div>

      {/* BUY / SELL */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {['BUY','SELL'].map(s=>(
          <button key={s} onClick={()=>setSide(s)}
            style={{flex:1,border:`2px solid ${side===s?(s==='BUY'?C.success:C.danger):C.border}`,
              borderRadius:10,padding:10,
              background:side===s?(s==='BUY'?'rgba(82,201,134,.1)':'rgba(255,94,94,.1)'):'transparent',
              color:side===s?(s==='BUY'?C.success:C.danger):C.textMuted,
              fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {s}
          </button>
        ))}
      </div>

      {/* Ticker + live price button */}
      <div style={{marginBottom:12}}>
        <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Ticker *</label>
        <div style={{display:'flex',gap:8}}>
          <input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL, BTC, NVDA…"
            style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
              padding:'9px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
          <button onClick={getLivePrice} disabled={fetching||!ticker.trim()}
            style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
              padding:'9px 12px',color:fetching?C.textMuted:C.accent,fontSize:12,fontWeight:600,
              cursor:fetching||!ticker.trim()?'not-allowed':'pointer',fontFamily:'Inter,sans-serif',
              whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:5}}>
            {fetching?<Spin size={12} color={C.accent}/>:'📈'} Get price
          </button>
        </div>
        {priceSource&&(
          <div style={{color:C.success,fontSize:10,marginTop:3}}>✓ Live from {priceSource}</div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        <MF label="Price *"    value={price} onChange={setPrice} type="number" placeholder="0.00"/>
        <MF label="Quantity *" value={qty}   onChange={setQty}   type="number" placeholder="10"/>
      </div>

      <div style={{marginBottom:12}}>
        <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Asset type</label>
        <div style={{display:'flex',gap:5}}>
          {ASSET_TYPES.map(t=>(
            <button key={t} onClick={()=>setAssetType(t)}
              style={{flex:1,border:`1px solid ${assetType===t?C.accent:C.border}`,borderRadius:7,
                padding:'6px 4px',background:assetType===t?C.accentSoft:'transparent',
                color:assetType===t?C.accent:C.textSec,fontSize:11,cursor:'pointer',
                fontFamily:'Inter,sans-serif'}}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Account</label>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {FUND_GROUPS.map(fg=>(
            <button key={fg} onClick={()=>setFundGroup(fg)}
              style={{border:`1px solid ${fundGroup===fg?FUND_COLORS[fg]:C.border}`,borderRadius:7,
                padding:'5px 10px',background:fundGroup===fg?FUND_COLORS[fg]+'18':'transparent',
                color:fundGroup===fg?FUND_COLORS[fg]:C.textSec,fontSize:11,
                fontWeight:fundGroup===fg?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
              {fg}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Trade horizon</label>
        <div style={{display:'flex',gap:8}}>
          {TRADE_TYPES.map(tt=>(
            <button key={tt.k} onClick={()=>setTradeType(tt.k)}
              style={{flex:1,border:`1px solid ${tradeType===tt.k?tt.color:C.border}`,borderRadius:8,
                padding:'8px 4px',background:tradeType===tt.k?tt.color+'18':'transparent',
                cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'center'}}>
              <div style={{color:tt.color,fontSize:12,fontWeight:700}}>{tt.k}</div>
              <div style={{color:tradeType===tt.k?tt.color:C.textMuted,fontSize:9}}>{tt.full}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Date</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
            padding:'8px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
      </div>

      <div style={{marginBottom:12}}>
        <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Notes</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
          placeholder="Strategy or reminder…"
          style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
            padding:'8px 12px',color:C.text,fontSize:12,fontFamily:'Inter,sans-serif',
            resize:'none',outline:'none'}}/>
      </div>

      {sl&&side==='BUY'&&(
        <div style={{background:'rgba(255,94,94,.06)',border:'1px solid rgba(255,94,94,.18)',
          borderRadius:9,padding:'8px 12px',marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span style={{color:C.danger,fontSize:12,fontWeight:600}}>Auto stop loss −5%</span>
            <span style={{color:C.danger,fontSize:13,fontWeight:700}}>
              {fmtP(sl,isCryptoTicker(ticker))}
            </span>
          </div>
          <div style={{color:C.textMuted,fontSize:10,marginTop:2}}>
            P1 reminder task · deadline {date}
          </div>
        </div>
      )}

      {err&&(
        <div style={{background:'rgba(255,94,94,.08)',borderRadius:8,padding:'8px 12px',
          color:C.danger,fontSize:12,marginBottom:10}}>{err}</div>
      )}

      <button onClick={handleSave}
        style={{width:'100%',background:saved?C.success:C.accent,border:'none',borderRadius:12,
          padding:13,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',
          fontFamily:'Inter,sans-serif',transition:'background .3s'}}>
        {saved?'✅ Registered!':'Register Trade'}
      </button>
    </div>
  )
}

// ── Archive ───────────────────────────────────────────────────────────────────
function Archive() {
  const { archived } = useTrading()
  const [filter,setFilter] = useState('all')
  const shown = archived.filter(p=>{
    if (filter==='wins')   return p.pnl>0
    if (filter==='losses') return p.pnl<0
    if (FUND_GROUPS.includes(filter)) return p.fundGroup===filter
    return true
  })
  const total  = archived.reduce((s,p)=>s+(p.pnl||0),0)
  const wins   = archived.filter(p=>p.pnl>0).length
  const winPct = archived.length?Math.round(wins/archived.length*100):0

  return (
    <div style={{paddingTop:16}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:16}}>
        {[
          ['Realized P&L', fmtPnl(total),             total>=0?C.success:C.danger],
          ['Trades',       String(archived.length),    C.text],
          ['Win rate',     `${winPct}%`,               C.success],
        ].map(([l,v,color])=>(
          <div key={l} style={{background:C.card,border:`0.5px solid ${C.border}`,
            borderRadius:10,padding:'10px 8px',textAlign:'center'}}>
            <div style={{color:C.textMuted,fontSize:10,marginBottom:3}}>{l}</div>
            <div style={{color,fontSize:14,fontWeight:700}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
        {['all',...FUND_GROUPS,'wins','losses'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{background:filter===f?C.accentSoft:'transparent',
              border:`1px solid ${filter===f?C.accent:C.border}`,borderRadius:20,
              padding:'4px 10px',color:filter===f?C.accent:C.textMuted,fontSize:11,
              fontWeight:filter===f?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {f==='all'?'All':f}
          </button>
        ))}
      </div>

      {shown.length===0
        ? <div style={{textAlign:'center',padding:'48px 20px'}}>
            <div style={{fontSize:44,marginBottom:12}}>📁</div>
            <p style={{color:C.textSec}}>No closed trades yet.</p>
          </div>
        : shown.map((p,i)=><ArchiveRow key={p.id||i} p={p}/>)
      }
    </div>
  )
}

function ArchiveRow({ p }) {
  const [exp,setExp] = useState(false)
  const isWin = p.pnl>=0
  const tt    = TRADE_TYPES.find(t=>t.k===p.tradeType)||TRADE_TYPES[0]
  return (
    <div style={{borderBottom:`1px solid ${C.border}`,paddingBottom:8,marginBottom:8}}>
      <div onClick={()=>setExp(!exp)} style={{display:'flex',justifyContent:'space-between',cursor:'pointer'}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
            <span style={{color:C.text,fontSize:13,fontWeight:600}}>{p.ticker}</span>
            <span style={{background:isWin?'rgba(82,201,134,.15)':'rgba(255,94,94,.15)',
              color:isWin?C.success:C.danger,fontSize:9,fontWeight:700,
              padding:'1px 6px',borderRadius:4}}>{isWin?'WIN':'LOSS'}</span>
            <span style={{background:TT_COLOR[p.tradeType]+'20',color:TT_COLOR[p.tradeType],
              fontSize:9,padding:'1px 4px',borderRadius:4}}>{tt.label}</span>
          </div>
          <div style={{color:C.textMuted,fontSize:11}}>
            {p.fundGroup} · {p.assetType} · qty {p.totalQty} · {p.daysHeld}d
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{color:isWin?C.success:C.danger,fontSize:13,fontWeight:600}}>
            {fmtPnl(p.pnl)}
          </div>
          <div style={{color:isWin?C.success:C.danger,fontSize:11}}>{fmtPct(p.pnlPct)}</div>
        </div>
      </div>
      {exp&&(
        <div style={{marginTop:8,background:C.surface,borderRadius:9,padding:10}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:6}}>
            {[['Avg buy',`$${p.avgPrice?.toFixed(2)}`],
              ['Sold',   `$${p.sellPrice?.toFixed(2)}`],
              ['Held',   `${p.daysHeld}d`],
            ].map(([l,v])=>(
              <div key={l}>
                <div style={{color:C.textMuted,fontSize:10}}>{l}</div>
                <div style={{color:C.text,fontSize:12,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{color:C.textMuted,fontSize:10}}>
            Bought {p.firstDate} · Sold {p.sellDate}
          </div>
          {!isWin&&p.pnlPct<=-5&&(
            <div style={{color:C.danger,fontSize:10,marginTop:2}}>Stop loss triggered</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sell Modal ────────────────────────────────────────────────────────────────
function SellModal({ pos, priceData, onClose, onConfirm }) {
  const cr = isCryptoTicker(pos.ticker)
  const [sp,setSp] = useState(
    priceData?.ok ? String(priceData.price.toFixed(cr&&priceData.price<10?4:2)) : ''
  )
  const [sq,setSq] = useState(String(pos.totalQty))
  const [sd,setSd] = useState(new Date().toISOString().split('T')[0])
  const pnl      = sp&&sq ? (parseFloat(sp)-pos.avgPrice)*parseFloat(sq) : null
  const pnlPct   = sp&&parseFloat(sp)>0 ? ((parseFloat(sp)-pos.avgPrice)/pos.avgPrice)*100 : null
  const proceeds = sp&&sq ? parseFloat(sp)*parseFloat(sq) : null

  return (
    <div onClick={onClose}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:1000,
        display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.card,borderRadius:'20px 20px 0 0',width:'100%',padding:20}}>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div>
            <h3 style={{color:C.text,fontSize:18,fontWeight:700}}>Sell {pos.ticker}</h3>
            <p style={{color:C.textMuted,fontSize:12,marginTop:2}}>
              Avg cost: {fmtP(pos.avgPrice,cr)} · {pos.totalQty} units
            </p>
          </div>
          <button onClick={onClose}
            style={{background:C.surface,border:'none',borderRadius:8,width:30,height:30,
              cursor:'pointer',color:C.textSec,fontSize:18}}>✕</button>
        </div>

        {priceData?.ok&&(
          <div style={{background:C.accentSoft,borderRadius:9,padding:'8px 12px',
            marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{color:C.accent,fontSize:12}}>Live · {priceData.source}</span>
            <span style={{color:C.text,fontSize:13,fontWeight:700}}>
              {fmtP(priceData.price,cr)}
            </span>
          </div>
        )}

        <MF label="Sell price *" value={sp} onChange={setSp} type="number" placeholder="0.00"/>
        <MF label="Quantity"     value={sq} onChange={setSq} type="number" placeholder={String(pos.totalQty)}/>

        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Sell date</label>
          <input type="date" value={sd} onChange={e=>setSd(e.target.value)}
            style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,
              padding:'8px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
        </div>

        {pnl!=null&&(
          <div style={{background:pnl>=0?'rgba(82,201,134,.1)':'rgba(255,94,94,.1)',
            border:`1px solid ${pnl>=0?'rgba(82,201,134,.25)':'rgba(255,94,94,.25)'}`,
            borderRadius:10,padding:'10px 14px',marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:C.textSec,fontSize:12}}>Realized P&L</span>
              <span style={{color:pnl>=0?C.success:C.danger,fontSize:14,fontWeight:700}}>
                {fmtPnl(pnl)} ({fmtPct(pnlPct)})
              </span>
            </div>
            {proceeds&&(
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{color:C.textMuted,fontSize:11}}>Proceeds → cash balance</span>
                <span style={{color:C.success,fontSize:12,fontWeight:600}}>+{fmt$(proceeds)}</span>
              </div>
            )}
          </div>
        )}

        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose}
            style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,
              padding:12,color:C.textSec,fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            Cancel
          </button>
          <button onClick={()=>sp&&onConfirm(sp,sq,sd)} disabled={!sp}
            style={{flex:2,background:sp?C.success:C.surface,border:'none',borderRadius:12,
              padding:12,color:sp?'#fff':C.textMuted,fontSize:13,fontWeight:600,
              cursor:sp?'pointer':'not-allowed',fontFamily:'Inter,sans-serif'}}>
            Confirm Sell → Cash
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared mini field ─────────────────────────────────────────────────────────
function MF({ label, value, onChange, placeholder, type }) {
  return (
    <div style={{marginBottom:10}}>
      {label&&(
        <label style={{color:'#9090A8',fontSize:11,display:'block',marginBottom:4}}>{label}</label>
      )}
      <input type={type||'text'} value={value}
        onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',background:'#1A1A24',border:'1px solid #2E2E3E',borderRadius:9,
          padding:'9px 12px',color:'#F0F0F5',fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
    </div>
  )
}
