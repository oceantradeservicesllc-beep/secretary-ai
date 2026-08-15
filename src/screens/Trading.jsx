import { useState, useEffect, useCallback } from 'react'
import { useTrading, FUND_GROUPS, FUND_COLORS, TRADE_TYPES, ASSET_TYPES } from '../store/tradingStore.jsx'
import { C } from '../utils/helpers.js'
import { Spin } from '../components/UI.jsx'

const TT_COLOR = {S:'#FF9F43',M:'#45B7D1',L:'#C984E0'}

const fmtMoney = (n) => {
  const abs = Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
  return n>=0 ? `+$${abs}` : `-$${abs}`
}
const fmtPct = (n) => `${n>=0?'+':''}${n.toFixed(2)}%`

const fmtPrice = (p, isCrypto=false) => {
  if (!p && p!==0) return 'N/A'
  if (isCrypto && p<1)   return `$${p.toFixed(6)}`
  if (isCrypto && p<100) return `$${p.toFixed(4)}`
  return `$${p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
}

const CRYPTO_LIST = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC','LINK','LTC']
const isCrypto = (ticker) => CRYPTO_LIST.includes(ticker.toUpperCase()) || ticker.includes('-USD')

// ── Live price fetcher using corsproxy.io ─────────────────────────────────────
async function fetchPrice(ticker) {
  const sym = ticker.toUpperCase()
  const yahooSym = isCrypto(sym) ? `${sym}-USD` : sym
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSym}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketPreviousClose`

  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  ]

  for (const proxy of proxies) {
    try {
      const r = await fetch(proxy, { signal: AbortSignal.timeout(6000) })
      if (!r.ok) continue
      const text = await r.text()
      const json = JSON.parse(text)
      const data = json.contents ? JSON.parse(json.contents) : json
      const q = data?.quoteResponse?.result?.[0]
      if (q?.regularMarketPrice) {
        return {
          price:     q.regularMarketPrice,
          prevClose: q.regularMarketPreviousClose,
          changePct: q.regularMarketChangePercent,
          hasData:   true,
        }
      }
    } catch { continue }
  }
  return { hasData: false }
}

export default function Trading() {
  const [tab, setTab] = useState('portfolio')
  return(
    <div style={{padding:'0 16px 100px'}}>
      <div style={{display:'flex',background:C.card,borderRadius:12,marginBottom:14,overflow:'hidden'}}>
        {[['portfolio','📊 Portfolio'],['add','+ Trade'],['archive','📁 Archive']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,border:'none',background:tab===k?C.accentSoft:'transparent',color:tab===k?C.accent:C.textMuted,padding:'11px 4px',fontSize:12,fontWeight:tab===k?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{l}</button>
        ))}
      </div>
      {tab==='portfolio' && <Portfolio/>}
      {tab==='add'       && <AddTrade onDone={()=>setTab('portfolio')}/>}
      {tab==='archive'   && <Archive/>}
    </div>
  )
}

// ── Portfolio ─────────────────────────────────────────────────────────────────
function Portfolio() {
  const {positions, cashMap, setCash, deletePosition, closeTrade} = useTrading()
  const [prices,    setPrices]    = useState({})
  const [loading,   setLoading]   = useState(false)
  const [sellModal, setSellModal] = useState(null)
  const [lastUpdate,setLastUpdate]= useState(null)

  const active = positions.filter(p=>!p.isClosed)

  const fetchAllPrices = useCallback(async () => {
    if (!active.length) return
    setLoading(true)
    const tickers = [...new Set(active.map(p=>p.ticker))]
    const results = {}
    for (const t of tickers) {
      const data = await fetchPrice(t)
      if (data.hasData) results[t] = data
      await new Promise(r=>setTimeout(r,300))
    }
    setPrices(results)
    setLastUpdate(new Date())
    setLoading(false)
  }, [active.length]) // eslint-disable-line

  useEffect(() => { fetchAllPrices() }, [active.length]) // eslint-disable-line

  const totalInvested = active.reduce((s,p)=>s+(p.avgPrice*p.totalQty), 0)
  const totalLive     = active.reduce((s,p)=>s+((prices[p.ticker]?.price||p.avgPrice)*p.totalQty), 0)
  const totalPnL      = totalLive - totalInvested
  const totalPnLPct   = totalInvested>0 ? (totalPnL/totalInvested)*100 : 0

  return(
    <div>
      {/* Header summary */}
      <div style={{background:'linear-gradient(135deg,rgba(108,99,255,.14),rgba(82,201,134,.07))',border:'1px solid rgba(108,99,255,.25)',borderRadius:16,padding:14,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
          <div>
            <div style={{color:C.textMuted,fontSize:11}}>Total Portfolio (excl. cash)</div>
            <div style={{color:C.text,fontSize:22,fontWeight:800}}>${totalLive.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <div style={{color:totalPnL>=0?C.success:C.danger,fontSize:12,marginTop:2}}>{fmtMoney(totalPnL)} · {fmtPct(totalPnLPct)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            {loading
              ? <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}><Spin size={14} color={C.success}/><span style={{color:C.textMuted,fontSize:11}}>Fetching…</span></div>
              : lastUpdate && <div style={{color:C.textMuted,fontSize:10,marginTop:4}}>{lastUpdate.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
            }
            <button onClick={fetchAllPrices} disabled={loading} style={{marginTop:8,background:'none',border:'1px solid rgba(108,99,255,.3)',borderRadius:8,padding:'4px 12px',color:C.accent,fontSize:11,cursor:loading?'not-allowed':'pointer',fontFamily:'Inter,sans-serif'}}>↻ Refresh</button>
          </div>
        </div>

        {/* Fund group pills */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {FUND_GROUPS.map(fg=>{
            const fps  = active.filter(p=>p.fundGroup===fg)
            const live = fps.reduce((s,p)=>s+((prices[p.ticker]?.price||p.avgPrice)*p.totalQty), 0)
            const cash = cashMap[fg]||0
            if (!fps.length && !cash) return null
            return(
              <div key={fg} style={{background:'rgba(0,0,0,.2)',borderRadius:8,padding:'4px 10px',textAlign:'center'}}>
                <div style={{color:FUND_COLORS[fg],fontSize:10,fontWeight:700}}>{fg}</div>
                <div style={{color:C.text,fontSize:11,fontWeight:600}}>${(live+cash).toLocaleString('en-US',{maximumFractionDigits:0})}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Live ticker strip */}
      {active.length>0 && (
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'8px 12px',marginBottom:14,overflowX:'auto'}}>
          <div style={{display:'flex',gap:10,minWidth:'max-content'}}>
            {[...new Set(active.map(p=>p.ticker))].map(ticker=>{
              const pd = prices[ticker]
              const isUp = pd?.changePct>=0
              return(
                <div key={ticker} style={{textAlign:'center',minWidth:56}}>
                  <div style={{color:C.text,fontSize:11,fontWeight:700}}>{ticker}</div>
                  <div style={{color:pd?.hasData?C.text:C.textMuted,fontSize:11,fontWeight:600}}>
                    {pd?.hasData ? fmtPrice(pd.price,isCrypto(ticker)) : loading?'…':'—'}
                  </div>
                  {pd?.hasData && <div style={{color:isUp?C.success:C.danger,fontSize:9}}>{fmtPct(pd.changePct)}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* By fund group */}
      {FUND_GROUPS.map(fg=>{
        const fps  = active.filter(p=>p.fundGroup===fg)
        const cash = cashMap[fg]||0
        const inv  = fps.reduce((s,p)=>s+(p.avgPrice*p.totalQty), 0)
        const live = fps.reduce((s,p)=>s+((prices[p.ticker]?.price||p.avgPrice)*p.totalQty), 0)
        const pnl  = live - inv
        if (!fps.length && !cash) return null
        return(
          <div key={fg} style={{marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',gap:7}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:FUND_COLORS[fg]}}/>
                <span style={{color:C.text,fontSize:14,fontWeight:700}}>{fg}</span>
              </div>
              <div style={{textAlign:'right'}}>
                <span style={{color:pnl>=0?C.success:C.danger,fontSize:12,fontWeight:700}}>{fmtMoney(pnl)}</span>
                <span style={{color:C.textMuted,fontSize:11,marginLeft:6}}>{inv>0?fmtPct((pnl/inv)*100):''}</span>
              </div>
            </div>

            {fps.map(p=>(
              <PositionRow key={p.id} pos={p} priceData={prices[p.ticker]}
                onSell={()=>setSellModal(p)}
                onDelete={()=>{ if(window.confirm(`Delete ${p.ticker}?`)) deletePosition(p.id) }}/>
            ))}

            <CashRow fg={fg} cash={cash} onSet={amt=>setCash(fg,amt)}/>
          </div>
        )
      })}

      {active.length===0&&(
        <div style={{textAlign:'center',padding:'40px 20px'}}>
          <div style={{fontSize:44,marginBottom:12}}>📊</div>
          <p style={{color:C.textSec,fontSize:14}}>No open positions yet.</p>
          <p style={{color:C.textMuted,fontSize:12,marginTop:4}}>Tap "+ Trade" to add your first trade.</p>
        </div>
      )}

      {sellModal&&(
        <SellModal pos={sellModal} priceData={prices[sellModal.ticker]}
          onClose={()=>setSellModal(null)}
          onConfirm={(sp,sq,sd)=>{ closeTrade(sellModal.id,sp,sq,sd,''); setSellModal(null) }}/>
      )}
    </div>
  )
}

// ── Position Row ──────────────────────────────────────────────────────────────
function PositionRow({pos, priceData, onSell, onDelete}) {
  const [exp,setExp] = useState(false)
  const crypto       = isCrypto(pos.ticker)
  const livePrice    = priceData?.hasData ? priceData.price : null
  const changePct    = priceData?.changePct || null
  const pnl          = livePrice ? (livePrice-pos.avgPrice)*pos.totalQty : null
  const pnlPct       = livePrice ? ((livePrice-pos.avgPrice)/pos.avgPrice)*100 : null
  const nearStop     = livePrice && livePrice <= pos.stopLoss*1.02
  const tt           = TRADE_TYPES.find(t=>t.k===pos.tradeType)||TRADE_TYPES[0]

  return(
    <div style={{background:C.card,border:`0.5px solid ${nearStop?'rgba(255,94,94,.5)':C.border}`,borderRadius:12,padding:'10px 12px',marginBottom:6}}>

      {/* Main row */}
      <div style={{display:'grid',gridTemplateColumns:'44px 1fr 64px 50px 28px',gap:4,alignItems:'center',marginBottom:6}}>
        {/* Ticker */}
        <div>
          <div style={{color:C.text,fontSize:12,fontWeight:700}}>{pos.ticker}</div>
          <div style={{color:C.textMuted,fontSize:9}}>{pos.assetType}</div>
        </div>

        {/* Live price + avg */}
        <div>
          {livePrice
            ? <>
                <div style={{color:C.text,fontSize:13,fontWeight:700}}>{fmtPrice(livePrice,crypto)}</div>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <span style={{color:changePct>=0?C.success:C.danger,fontSize:9,fontWeight:600}}>{changePct!=null?fmtPct(changePct):''}</span>
                  <span style={{color:C.textMuted,fontSize:9}}>avg {fmtPrice(pos.avgPrice,crypto)}</span>
                </div>
              </>
            : <>
                <div style={{color:C.textMuted,fontSize:12}}>Loading…</div>
                <div style={{color:C.textMuted,fontSize:9}}>avg {fmtPrice(pos.avgPrice,crypto)}</div>
              </>
          }
          {pos.purchases?.length>1&&<div style={{color:C.accent,fontSize:9}}>×{pos.purchases.length} purchases avg</div>}
        </div>

        {/* P&L */}
        <div style={{textAlign:'right'}}>
          {pnl!==null
            ? <>
                <div style={{color:pnl>=0?C.success:C.danger,fontSize:11,fontWeight:700}}>{fmtMoney(pnl)}</div>
                <div style={{color:pnl>=0?C.success:C.danger,fontSize:9}}>{fmtPct(pnlPct)}</div>
              </>
            : <div style={{color:C.textMuted,fontSize:10}}>—</div>
          }
        </div>

        {/* Stop loss */}
        <div style={{textAlign:'right'}}>
          <div style={{color:C.danger,fontSize:10,fontWeight:600}}>{fmtPrice(pos.stopLoss,crypto)}</div>
          <div style={{color:C.textMuted,fontSize:8}}>stop</div>
        </div>

        {/* Trade type */}
        <div style={{textAlign:'center'}}>
          <span style={{background:TT_COLOR[pos.tradeType]+'20',color:TT_COLOR[pos.tradeType],fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:5}}>{pos.tradeType}</span>
        </div>
      </div>

      {/* Near stop warning */}
      {nearStop&&(
        <div style={{background:'rgba(255,94,94,.1)',borderRadius:6,padding:'3px 8px',marginBottom:6}}>
          <span style={{color:C.danger,fontSize:10,fontWeight:700}}>⚠️ Near stop loss — {fmtPrice(pos.stopLoss,crypto)}</span>
        </div>
      )}

      {/* P&L progress bar */}
      {pnlPct!==null&&(
        <div style={{background:'rgba(255,255,255,.07)',borderRadius:3,height:4,overflow:'hidden',marginBottom:6}}>
          <div style={{background:pnlPct>=0?C.success:C.danger,height:'100%',width:`${Math.min(Math.abs(pnlPct),50)*2}%`,borderRadius:3}}/>
        </div>
      )}

      {/* Action buttons */}
      <div style={{display:'flex',gap:6}}>
        <button onClick={()=>setExp(!exp)} style={{flex:1,background:C.surface,border:'none',borderRadius:7,padding:'5px 8px',color:C.textSec,fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{exp?'▲ Less':'▼ Details'}</button>
        <button onClick={onSell} style={{flex:1,background:'rgba(82,201,134,.12)',border:'none',borderRadius:7,padding:'5px 8px',color:C.success,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Sell</button>
        <button onClick={onDelete} style={{background:'rgba(255,94,94,.1)',border:'none',borderRadius:7,padding:'5px 8px',color:C.danger,fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>🗑</button>
      </div>

      {/* Expanded details */}
      {exp&&(
        <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:8}}>
            {[
              ['Qty',        pos.totalQty],
              ['Invested',   `$${(pos.avgPrice*pos.totalQty).toLocaleString('en-US',{maximumFractionDigits:0})}`],
              ['Trade type', tt.label],
            ].map(([l,v])=>(
              <div key={l} style={{background:C.surface,borderRadius:8,padding:'6px 8px',textAlign:'center'}}>
                <div style={{color:C.textMuted,fontSize:9}}>{l}</div>
                <div style={{color:C.text,fontSize:11,fontWeight:600}}>{v}</div>
              </div>
            ))}
          </div>
          {livePrice&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:8}}>
              {[
                ['Live price',    fmtPrice(livePrice,crypto)],
                ['Today',         changePct!=null?fmtPct(changePct):'—'],
                ['vs Buy',        pnlPct!=null?fmtPct(pnlPct):'—'],
              ].map(([l,v])=>(
                <div key={l} style={{background:C.surface,borderRadius:8,padding:'6px 8px',textAlign:'center'}}>
                  <div style={{color:C.textMuted,fontSize:9}}>{l}</div>
                  <div style={{color:C.text,fontSize:11,fontWeight:600}}>{v}</div>
                </div>
              ))}
            </div>
          )}
          {pos.purchases?.length>1&&(
            <div style={{marginBottom:6}}>
              <div style={{color:C.textMuted,fontSize:10,marginBottom:4}}>Purchase history — averaged</div>
              {pos.purchases.map((pu,i)=>(
                <div key={pu.id} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:C.textMuted,fontSize:10}}>#{i+1} · {pu.date}</span>
                  <span style={{color:C.textSec,fontSize:10}}>{fmtPrice(pu.price,crypto)} × {pu.qty}</span>
                </div>
              ))}
            </div>
          )}
          {pos.notes&&<p style={{color:C.textSec,fontSize:11,marginTop:4,fontStyle:'italic'}}>{pos.notes}</p>}
          <div style={{color:C.textMuted,fontSize:10,marginTop:4}}>First buy: {pos.firstDate}</div>
        </div>
      )}
    </div>
  )
}

// ── Cash Row ──────────────────────────────────────────────────────────────────
function CashRow({fg, cash, onSet}) {
  const [editing,setEditing] = useState(false)
  const [val,    setVal]     = useState(String(cash||''))
  return(
    <div style={{background:C.surface,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
      <div>
        <div style={{color:C.textSec,fontSize:12,fontWeight:600}}>💵 Cash</div>
        <div style={{color:C.textMuted,fontSize:10}}>Excluded from P&L %</div>
      </div>
      {editing
        ? <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <input type="number" value={val} onChange={e=>setVal(e.target.value)}
              style={{width:80,background:C.card,border:`1px solid ${C.accent}`,borderRadius:7,padding:'4px 8px',color:C.text,fontSize:12,fontFamily:'Inter,sans-serif',outline:'none'}}/>
            <button onClick={()=>{onSet(parseFloat(val)||0);setEditing(false)}} style={{background:C.success,border:'none',borderRadius:7,padding:'4px 8px',color:'#fff',fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>✓</button>
          </div>
        : <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{color:C.text,fontSize:13,fontWeight:700}}>${(cash||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
            <button onClick={()=>{setVal(String(cash||''));setEditing(true)}} style={{background:C.accentSoft,border:'none',borderRadius:7,padding:'4px 8px',color:C.accent,fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Edit</button>
          </div>
      }
    </div>
  )
}

// ── Add Trade ─────────────────────────────────────────────────────────────────
function AddTrade({onDone}) {
  const {addTrade, parseQuick} = useTrading()
  const [quick,     setQuick]     = useState('')
  const [ticker,    setTicker]    = useState('')
  const [assetType, setAssetType] = useState('Stock')
  const [price,     setPrice]     = useState('')
  const [qty,       setQty]       = useState('')
  const [fundGroup, setFundGroup] = useState('401k')
  const [tradeType, setTradeType] = useState('S')
  const [date,      setDate]      = useState(new Date().toISOString().split('T')[0])
  const [side,      setSide]      = useState('BUY')
  const [notes,     setNotes]     = useState('')
  const [err,       setErr]       = useState('')
  const [saved,     setSaved]     = useState(false)
  const [fetching,  setFetching]  = useState(false)

  // Auto-fetch current price when ticker is entered
  async function autoFetchPrice() {
    if (!ticker.trim()) return
    setFetching(true)
    const data = await fetchPrice(ticker.trim())
    if (data.hasData) setPrice(data.price.toFixed(data.price<10?4:2))
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
    addTrade({ticker,assetType,price,qty,fundGroup,tradeType,date,side,notes})
    setSaved(true)
    setTimeout(()=>{ setSaved(false); onDone() },1200)
  }

  const stopLossPreview = price ? parseFloat((parseFloat(price)*0.95).toFixed(6)) : null

  return(
    <div>
      {/* Quick entry */}
      <div style={{background:C.card,border:'1px solid rgba(108,99,255,.3)',borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{color:C.accent,fontSize:12,fontWeight:700,marginBottom:3}}>⚡ Quick Entry</div>
        <div style={{color:C.textMuted,fontSize:10,marginBottom:8}}>TICKER / price / qty / dd/mm/yyyy / fund / S|M|L</div>
        <div style={{display:'flex',gap:8}}>
          <input value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>e.key==='Enter'&&applyQuick()}
            placeholder="CMBT / 15.05 / 30 / 21/07/2026 / 401k / S"
            style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 12px',color:C.text,fontSize:12,fontFamily:'Inter,sans-serif',outline:'none'}}/>
          <button onClick={applyQuick} style={{background:C.accent,border:'none',borderRadius:10,padding:'9px 14px',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Fill</button>
        </div>
      </div>

      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:12}}>Manual Entry</div>

        {/* BUY / SELL */}
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          {['BUY','SELL'].map(s=>(
            <button key={s} onClick={()=>setSide(s)} style={{flex:1,border:'none',borderRadius:10,padding:10,background:side===s?(s==='BUY'?C.success:C.danger):C.surface,color:side===s?'#fff':C.textMuted,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{s}</button>
          ))}
        </div>

        {/* Ticker + auto-fetch */}
        <div style={{marginBottom:10}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Ticker *</label>
          <div style={{display:'flex',gap:8}}>
            <input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} placeholder="AAPL"
              style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:'9px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
            <button onClick={autoFetchPrice} disabled={fetching||!ticker.trim()} style={{background:fetching?C.surface:C.accentSoft,border:'none',borderRadius:9,padding:'9px 12px',color:fetching?C.textMuted:C.accent,fontSize:11,fontWeight:600,cursor:fetching||!ticker.trim()?'not-allowed':'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>
              {fetching?<Spin size={12} color={C.accent}/>:'📈 Get Price'}
            </button>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div>
            <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Asset type</label>
            <select value={assetType} onChange={e=>setAssetType(e.target.value)} style={{width:'100%',background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 10px',color:C.text,fontSize:12,outline:'none'}}>
              {ASSET_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <SField label="Price *" value={price} onChange={setPrice} placeholder="15.05" type="number"/>
          <SField label="Quantity *" value={qty} onChange={setQty} placeholder="30" type="number"/>
          <div>
            <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:'100%',background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 10px',color:C.text,fontSize:12,fontFamily:'Inter,sans-serif',outline:'none'}}/>
          </div>
        </div>

        {/* Fund group */}
        <div style={{marginBottom:10}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:5}}>Fund group</label>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {FUND_GROUPS.map(fg=>(
              <button key={fg} onClick={()=>setFundGroup(fg)} style={{border:`1px solid ${fundGroup===fg?FUND_COLORS[fg]:C.border}`,borderRadius:8,padding:'5px 10px',background:fundGroup===fg?FUND_COLORS[fg]+'20':C.surface,color:fundGroup===fg?FUND_COLORS[fg]:C.textSec,fontSize:11,fontWeight:fundGroup===fg?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{fg}</button>
            ))}
          </div>
        </div>

        {/* Trade type */}
        <div style={{marginBottom:10}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:5}}>Trade type</label>
          <div style={{display:'flex',gap:8}}>
            {TRADE_TYPES.map(tt=>(
              <button key={tt.k} onClick={()=>setTradeType(tt.k)} style={{flex:1,border:'none',borderRadius:9,padding:'8px 4px',background:tradeType===tt.k?tt.color+'25':C.surface,cursor:'pointer',fontFamily:'Inter,sans-serif',textAlign:'center'}}>
                <div style={{color:tt.color,fontSize:13,fontWeight:700}}>{tt.k}</div>
                <div style={{color:tradeType===tt.k?tt.color:C.textMuted,fontSize:9}}>{tt.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Notes (optional)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Strategy or reminder…"
            style={{width:'100%',background:C.surface,border:'none',borderRadius:9,padding:'8px 12px',color:C.text,fontSize:12,fontFamily:'Inter,sans-serif',resize:'none',outline:'none'}}/>
        </div>

        {/* Stop loss preview */}
        {stopLossPreview&&side==='BUY'&&(
          <div style={{background:'rgba(255,94,94,.07)',border:'1px solid rgba(255,94,94,.2)',borderRadius:10,padding:'8px 12px',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{color:C.danger,fontSize:12,fontWeight:700}}>⚠️ Auto stop loss (−5%)</span>
              <span style={{color:C.danger,fontSize:13,fontWeight:800}}>{fmtPrice(stopLossPreview,assetType==='Crypto')}</span>
            </div>
            <div style={{color:C.textMuted,fontSize:10,marginTop:3}}>P1 task reminder · deadline {date}</div>
          </div>
        )}

        {err&&<div style={{background:'rgba(255,94,94,.1)',border:'1px solid rgba(255,94,94,.3)',borderRadius:8,padding:'8px 12px',color:C.danger,fontSize:12,marginBottom:10}}>{err}</div>}

        <button onClick={handleSave} style={{width:'100%',background:saved?C.success:C.accent,border:'none',borderRadius:12,padding:12,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',transition:'background .3s'}}>
          {saved?'✅ Saved!':'Register Trade'}
        </button>
      </div>
    </div>
  )
}

// ── Archive ───────────────────────────────────────────────────────────────────
function Archive() {
  const {archived} = useTrading()
  const [filter,setFilter] = useState('all')

  const shown = archived.filter(p=>{
    if (filter==='wins')   return p.pnl>0
    if (filter==='losses') return p.pnl<0
    if (FUND_GROUPS.includes(filter)) return p.fundGroup===filter
    return true
  })

  const totalRealized = archived.reduce((s,p)=>s+(p.pnl||0), 0)
  const wins = archived.filter(p=>p.pnl>0).length

  return(
    <div>
      {/* Summary */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <div>
            <div style={{color:C.textMuted,fontSize:10}}>Total realized P&L</div>
            <div style={{color:totalRealized>=0?C.success:C.danger,fontSize:18,fontWeight:800}}>{fmtMoney(totalRealized)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{color:C.textMuted,fontSize:10}}>Trades closed</div>
            <div style={{color:C.text,fontSize:18,fontWeight:800}}>{archived.length}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {[[C.success,`${wins} wins`],[C.danger,`${archived.length-wins} losses`],[C.accent,`${archived.length?Math.round(wins/archived.length*100):0}% win rate`]].map(([color,label])=>(
            <div key={label} style={{flex:1,background:color+'10',borderRadius:8,padding:'5px',textAlign:'center'}}>
              <div style={{color,fontSize:11,fontWeight:700}}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
        {['all',...FUND_GROUPS,'wins','losses'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?C.accentSoft:C.card,border:`1px solid ${filter===f?C.accent:C.border}`,borderRadius:16,padding:'4px 10px',color:filter===f?C.accent:C.textMuted,fontSize:11,fontWeight:filter===f?600:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
            {f==='all'?'All':f}
          </button>
        ))}
      </div>

      {shown.length===0
        ? <div style={{textAlign:'center',padding:'40px 20px'}}>
            <div style={{fontSize:44,marginBottom:12}}>📁</div>
            <p style={{color:C.textSec,fontSize:14}}>No closed trades yet.</p>
          </div>
        : shown.map(p=><ArchivedRow key={p.closedAt+p.ticker} p={p}/>)
      }
    </div>
  )
}

function ArchivedRow({p}) {
  const [exp,setExp] = useState(false)
  const isWin = p.pnl>=0
  return(
    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'10px 12px',marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
            <span style={{color:C.text,fontSize:13,fontWeight:700}}>{p.ticker}</span>
            <span style={{background:isWin?'rgba(82,201,134,.15)':'rgba(255,94,94,.15)',color:isWin?C.success:C.danger,fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:4}}>SOLD</span>
            <span style={{background:TT_COLOR[p.tradeType]+'20',color:TT_COLOR[p.tradeType],fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4}}>{p.tradeType}</span>
          </div>
          <div style={{color:C.textMuted,fontSize:10}}>{p.fundGroup} · {p.assetType} · qty {p.totalQty}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{color:isWin?C.success:C.danger,fontSize:13,fontWeight:700}}>{fmtMoney(p.pnl)}</div>
          <div style={{color:isWin?C.success:C.danger,fontSize:10}}>{fmtPct(p.pnlPct)}</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:6}}>
        {[['Avg buy',`$${p.avgPrice?.toFixed(2)}`,''],['Sold at',`$${p.sellPrice?.toFixed(2)}`,isWin?C.success:C.danger],['Held',`${p.daysHeld}d`,'']].map(([l,v,color])=>(
          <div key={l} style={{background:C.surface,borderRadius:7,padding:'5px 6px',textAlign:'center'}}>
            <div style={{color:C.textMuted,fontSize:9}}>{l}</div>
            <div style={{color:color||C.text,fontSize:10,fontWeight:600}}>{v}</div>
          </div>
        ))}
      </div>

      {!isWin&&p.pnlPct<=-5&&<div style={{background:'rgba(255,94,94,.07)',borderRadius:6,padding:'2px 8px',marginBottom:5}}>
        <span style={{color:C.danger,fontSize:10}}>Stop loss triggered</span>
      </div>}

      <div style={{color:C.textMuted,fontSize:9,marginBottom:5}}>Bought {p.firstDate} · Sold {p.sellDate}</div>
      <button onClick={()=>setExp(!exp)} style={{background:C.surface,border:'none',borderRadius:7,padding:'4px 10px',color:C.textSec,fontSize:10,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{exp?'▲ Less':'▼ Details'}</button>

      {exp&&p.purchases?.length>1&&(
        <div style={{marginTop:8}}>
          <div style={{color:C.textMuted,fontSize:10,marginBottom:4}}>Purchase history</div>
          {p.purchases.map((pu,i)=>(
            <div key={pu.id} style={{display:'flex',justifyContent:'space-between',padding:'2px 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.textMuted,fontSize:9}}>#{i+1} · {pu.date}</span>
              <span style={{color:C.textSec,fontSize:9}}>${pu.price.toFixed(2)} × {pu.qty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sell Modal ────────────────────────────────────────────────────────────────
function SellModal({pos, priceData, onClose, onConfirm}) {
  const crypto  = isCrypto(pos.ticker)
  const [sp,setSp] = useState(priceData?.hasData ? String(priceData.price.toFixed(crypto&&priceData.price<10?4:2)) : '')
  const [sq,setSq] = useState(String(pos.totalQty))
  const [sd,setSd] = useState(new Date().toISOString().split('T')[0])
  const pnl    = sp&&sq ? (parseFloat(sp)-pos.avgPrice)*parseFloat(sq) : null
  const pnlPct = sp ? ((parseFloat(sp)-pos.avgPrice)/pos.avgPrice)*100 : null

  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:'20px 20px 0 0',width:'100%',padding:20}}>
        <h3 style={{color:C.text,fontSize:17,fontWeight:700,marginBottom:4}}>Sell {pos.ticker}</h3>
        <p style={{color:C.textMuted,fontSize:12,marginBottom:14}}>Avg buy: {fmtPrice(pos.avgPrice,crypto)} · Qty: {pos.totalQty}</p>

        {priceData?.hasData&&(
          <div style={{background:C.accentSoft,border:`1px solid rgba(108,99,255,.3)`,borderRadius:10,padding:'8px 12px',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{color:C.accent,fontSize:12}}>Live price</span>
              <span style={{color:C.text,fontSize:13,fontWeight:700}}>{fmtPrice(priceData.price,crypto)}</span>
            </div>
          </div>
        )}

        <SField label="Sell price *" value={sp} onChange={setSp} placeholder="Current price" type="number"/>
        <SField label="Qty to sell" value={sq} onChange={setSq} placeholder={String(pos.totalQty)} type="number"/>
        <div style={{marginBottom:12}}>
          <label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>Sell date</label>
          <input type="date" value={sd} onChange={e=>setSd(e.target.value)} style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:'8px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
        </div>

        {pnl!==null&&(
          <div style={{background:pnl>=0?'rgba(82,201,134,.1)':'rgba(255,94,94,.1)',border:`1px solid ${pnl>=0?'rgba(82,201,134,.3)':'rgba(255,94,94,.3)'}`,borderRadius:10,padding:'10px 14px',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{color:C.textSec,fontSize:12}}>Realized P&L</span>
              <span style={{color:pnl>=0?C.success:C.danger,fontSize:14,fontWeight:700}}>{fmtMoney(pnl)} ({fmtPct(pnlPct)})</span>
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,background:C.surface,border:'none',borderRadius:12,padding:12,color:C.textSec,fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Cancel</button>
          <button onClick={()=>sp&&onConfirm(sp,sq,sd)} disabled={!sp} style={{flex:2,background:sp?C.success:C.surface,border:'none',borderRadius:12,padding:12,color:sp?'#fff':C.textMuted,fontSize:13,fontWeight:600,cursor:sp?'pointer':'not-allowed',fontFamily:'Inter,sans-serif'}}>Confirm Sell</button>
        </div>
      </div>
    </div>
  )
}

function SField({label,value,onChange,placeholder,type}) {
  return(
    <div style={{marginBottom:10}}>
      {label&&<label style={{color:C.textSec,fontSize:11,display:'block',marginBottom:4}}>{label}</label>}
      <input type={type||'text'} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:'9px 12px',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
    </div>
  )
}
