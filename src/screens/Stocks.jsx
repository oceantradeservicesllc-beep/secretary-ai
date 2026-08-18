import { useState, useEffect } from 'react'
import { C } from '../utils/helpers.js'
import { Spin } from '../components/UI.jsx'

const SUPA_KEY = 'sb_publishable_-KsN5vI4j3YYkw14ursHuw_HC5H0j_O'

// Always-show market tickers
const MARKET_TICKERS = [
  { ticker:'XRP-USD',  label:'XRP',     type:'crypto' },
  { ticker:'BTC-USD',  label:'Bitcoin', type:'crypto' },
  { ticker:'VV',       label:'ETF VV',  type:'etf'    },
  { ticker:'SPY',      label:'ETF SPY', type:'etf'    },
]

async function fetchYahoo(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  ]
  for (const proxy of proxies) {
    try {
      const r = await fetch(proxy, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) continue
      const raw  = await r.text()
      const json = JSON.parse(raw)
      const body = json.contents ? JSON.parse(json.contents) : json
      const res  = body?.chart?.result?.[0]
      if (!res) continue
      const meta = res.meta
      const price = meta.regularMarketPrice || meta.previousClose
      if (!price) continue
      const prev    = meta.chartPreviousClose || meta.previousClose || price
      const chgPct  = prev ? ((price-prev)/prev)*100 : 0
      const chg     = price - prev
      const volume  = meta.regularMarketVolume || 0
      const high52  = meta.fiftyTwoWeekHigh||null
      const low52   = meta.fiftyTwoWeekLow||null
      return { price, chgPct, chg, volume, high52, low52, ok:true }
    } catch { continue }
  }
  return { ok:false }
}

async function fetchCoinGecko(id) {
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!r.ok) return null
    const data = await r.json()
    const d = data[id]
    if (!d?.usd) return null
    return { price:d.usd, chgPct:d.usd_24h_change||0, volume:d.usd_24h_vol||0, marketCap:d.usd_market_cap||0, ok:true }
  } catch { return null }
}

const fmt$ = (n,d=2) => `$${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})}`
const fmtPct = (n) => `${n>=0?'+':''}${parseFloat(n).toFixed(2)}%`
const fmtB = (n) => n>=1e9?`$${(n/1e9).toFixed(2)}B`:n>=1e6?`$${(n/1e6).toFixed(2)}M`:fmt$(n,0)

export default function Stocks() {
  const [marketData, setMarketData] = useState({})
  const [aiPicks,    setAiPicks]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [picksLoading,setPicksLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [apiKey,     setApiKeyLocal] = useState(()=>localStorage.getItem('sai_key')||'')

  useEffect(()=>{ fetchMarketData() },[])

  async function fetchMarketData() {
    setLoading(true)
    const results = {}

    // XRP + BTC via CoinGecko
    const [xrp, btc] = await Promise.all([
      fetchCoinGecko('ripple'),
      fetchCoinGecko('bitcoin'),
    ])
    if(xrp) results['XRP-USD'] = xrp
    if(btc) results['BTC-USD'] = btc

    // VV + SPY via Yahoo
    for (const t of ['VV','SPY']) {
      await new Promise(r=>setTimeout(r,300))
      const d = await fetchYahoo(t)
      if(d.ok) results[t] = d
    }

    setMarketData(results)
    setLastUpdate(new Date())
    setLoading(false)
  }

  async function fetchAIPicks() {
    const key = apiKey || localStorage.getItem('sai_key')
    if(!key) { alert('Set your Anthropic API key in Settings first'); return }
    setPicksLoading(true)
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
        body:JSON.stringify({
          model:'claude-sonnet-4-6', max_tokens:800,
          messages:[{role:'user',content:`You are a stock market analyst. List exactly 5 penny stocks (under $10/share) that:
1. Had 5-10% price movement in the last 3 days, OR
2. Have strong technical indicators suggesting 90%+ probability of price increase in next 7 days

For each stock provide a JSON array with fields: ticker, price (estimated current USD), change_pct (3-day %), reason (one sentence), confidence (0-100).

Respond ONLY with valid JSON array, no markdown, no explanation. Example format:
[{"ticker":"ABCD","price":2.45,"change_pct":7.2,"reason":"Breaking out of resistance with high volume","confidence":87}]`}]
        })
      })
      const data = await r.json()
      const text = data.content?.[0]?.text||'[]'
      const clean = text.replace(/```json|```/g,'').trim()
      const picks = JSON.parse(clean)
      setAiPicks(Array.isArray(picks)?picks.slice(0,5):[])
    } catch(e) {
      console.error(e)
      setAiPicks([])
    }
    setPicksLoading(false)
  }

  return (
    <div style={{padding:'0 16px 100px',paddingTop:12}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <div style={{color:C.textMuted,fontSize:11}}>
            {lastUpdate?`Updated ${lastUpdate.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`:loading?'Loading…':''}
          </div>
        </div>
        <button onClick={fetchMarketData} disabled={loading}
          style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,
            padding:'5px 12px',color:C.accent,fontSize:12,cursor:loading?'not-allowed':'pointer',
            fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',gap:5}}>
          {loading?<Spin size={12} color={C.accent}/>:'↻'} Refresh
        </button>
      </div>

      {/* Always-on market tickers */}
      <div style={{marginBottom:20}}>
        <div style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:12}}>Markets</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {MARKET_TICKERS.map(({ticker,label,type})=>{
            const d = marketData[ticker]
            const up = (d?.chgPct||0)>=0
            return (
              <div key={ticker} style={{background:C.card,border:`0.5px solid ${C.border}`,
                borderRadius:14,padding:'14px 14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div>
                    <div style={{color:C.text,fontSize:13,fontWeight:700}}>{label}</div>
                    <div style={{color:C.textMuted,fontSize:10}}>{ticker}</div>
                  </div>
                  <div style={{background:type==='crypto'?'rgba(108,99,255,.12)':'rgba(69,183,209,.12)',
                    borderRadius:5,padding:'2px 6px'}}>
                    <span style={{color:type==='crypto'?C.accent:'#45B7D1',fontSize:9,fontWeight:700}}>
                      {type==='crypto'?'CRYPTO':'ETF'}
                    </span>
                  </div>
                </div>
                {d?.ok
                  ? <>
                      <div style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:3}}>
                        {ticker.includes('USD')&&d.price<100?`$${d.price.toFixed(4)}`:fmt$(d.price)}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{background:up?'rgba(82,201,134,.15)':'rgba(255,94,94,.15)',
                          color:up?C.success:C.danger,fontSize:11,fontWeight:600,
                          padding:'2px 6px',borderRadius:5}}>
                          {fmtPct(d.chgPct)}
                        </span>
                        <span style={{color:C.textMuted,fontSize:10}}>24h</span>
                      </div>
                      {d.high52&&(
                        <div style={{color:C.textMuted,fontSize:10,marginTop:6}}>
                          52w {fmt$(d.low52)} – {fmt$(d.high52)}
                        </div>
                      )}
                      {d.volume>0&&(
                        <div style={{color:C.textMuted,fontSize:10}}>Vol {fmtB(d.volume)}</div>
                      )}
                    </>
                  : <div style={{color:C.textMuted,fontSize:13}}>{loading?'Loading…':'—'}</div>
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Penny Stock Picks */}
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div>
            <div style={{color:C.text,fontSize:14,fontWeight:700}}>AI Penny Stock Picks</div>
            <div style={{color:C.textMuted,fontSize:11}}>5 picks · 5–10% move or 90%+ upside probability</div>
          </div>
          <button onClick={fetchAIPicks} disabled={picksLoading}
            style={{background:picksLoading?C.surface:C.accent,border:'none',borderRadius:9,
              padding:'7px 12px',color:picksLoading?C.textMuted:'#fff',fontSize:11,fontWeight:600,
              cursor:picksLoading?'not-allowed':'pointer',fontFamily:'Inter,sans-serif',
              display:'flex',alignItems:'center',gap:5}}>
            {picksLoading?<Spin size={11} color={C.textMuted}/>:'✨'} {picksLoading?'Analyzing…':'Get picks'}
          </button>
        </div>

        {aiPicks.length===0&&!picksLoading&&(
          <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,
            padding:'20px',textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>🤖</div>
            <div style={{color:C.textSec,fontSize:13,marginBottom:4}}>
              Tap "Get picks" for AI-powered penny stock analysis
            </div>
            <div style={{color:C.textMuted,fontSize:11}}>
              Stocks with 5–10% recent moves or high upside probability
            </div>
          </div>
        )}

        {picksLoading&&(
          <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,
            padding:'24px',textAlign:'center'}}>
            <Spin size={24} color={C.accent}/>
            <div style={{color:C.textSec,fontSize:13,marginTop:12}}>Analyzing market data…</div>
          </div>
        )}

        {aiPicks.map((p,i)=>{
          const conf = p.confidence||0
          const confColor = conf>=85?C.success:conf>=70?C.warning:C.danger
          return (
            <div key={i} style={{background:C.card,border:`0.5px solid ${C.border}`,
              borderRadius:12,padding:'12px 14px',marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                    <span style={{color:C.text,fontSize:15,fontWeight:700}}>{p.ticker}</span>
                    <span style={{background:'rgba(108,99,255,.12)',color:C.accent,
                      fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4}}>PENNY</span>
                  </div>
                  <div style={{color:C.textMuted,fontSize:11}}>Est. price: {fmt$(p.price||0)}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{color:p.change_pct>=0?C.success:C.danger,fontSize:14,fontWeight:700}}>
                    {p.change_pct>=0?'+':''}{(p.change_pct||0).toFixed(1)}%
                  </div>
                  <div style={{color:C.textMuted,fontSize:10}}>3-day move</div>
                </div>
              </div>
              <div style={{color:C.textSec,fontSize:12,marginBottom:8,lineHeight:1.4}}>{p.reason}</div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{flex:1,background:C.surface,borderRadius:4,height:6,overflow:'hidden'}}>
                  <div style={{background:confColor,height:'100%',width:`${conf}%`,borderRadius:4}}/>
                </div>
                <span style={{color:confColor,fontSize:11,fontWeight:600,minWidth:40}}>{conf}% conf</span>
              </div>
            </div>
          )
        })}

        <div style={{background:'rgba(255,159,67,.06)',border:'1px solid rgba(255,159,67,.2)',
          borderRadius:10,padding:'8px 12px',marginTop:8}}>
          <div style={{color:C.warning,fontSize:11}}>⚠️ AI picks are for informational purposes only. Not financial advice. Always do your own research before investing.</div>
        </div>
      </div>
    </div>
  )
}
