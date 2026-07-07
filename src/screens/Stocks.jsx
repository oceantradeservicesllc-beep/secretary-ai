import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/store.jsx'
import { C } from '../utils/helpers.js'
import { Spin } from '../components/UI.jsx'
import { fetchLiveData, isCryptoTicker, formatPrice, formatMarketCap, formatVolume } from '../services/marketData.js'

const ANALYSIS_KEY    = 'sai_stock_analysis'
const LAST_RUN_KEY    = 'sai_stock_last_run'
const SEARCH_HIST_KEY = 'sai_search_hist'

const load = (k,fb) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fb } catch { return fb } }
const save = (k,v)  => { try { localStorage.setItem(k,JSON.stringify(v)) } catch {} }

function msUntil(h,m) {
  const now=new Date(), t=new Date(now); t.setHours(h,m,0,0)
  let d=t-now; if(d<0) d+=86400000; return d
}
function scheduleNotif(title,body,ms) {
  if (!('Notification' in window)||Notification.permission!=='granted') return
  setTimeout(()=>new Notification(title,{body}),ms)
}

export default function Stocks() {
  const { apiKey } = useStore()
  const [analysis,     setAnalysis]     = useState(()=>load(ANALYSIS_KEY,null))
  const [loading,      setLoading]      = useState(false)
  const [lastRun,      setLastRun]      = useState(()=>load(LAST_RUN_KEY,null))
  const [notifPerm,    setNotifPerm]    = useState(()=>'Notification' in window?Notification.permission:'unsupported')
  const [tab,          setTab]          = useState('picks')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching,    setSearching]    = useState(false)
  const [searchError,  setSearchError]  = useState('')
  const [searchHistory,setSearchHistory]= useState(()=>load(SEARCH_HIST_KEY,[]))
  const [activeView,   setActiveView]   = useState('market')
  const [liveData,     setLiveData]     = useState({})
  const [loadingLive,  setLoadingLive]  = useState(false)

  useEffect(()=>{
    if(notifPerm!=='granted') return
    scheduleNotif('📈 Pre-Market Analysis Ready','Secretary AI stock picks — 30min before NYSE open.',msUntil(8,30))
    scheduleNotif('📊 Mid-Morning Update','11 AM CDT market update available.',msUntil(11,0))
    scheduleNotif('📉 Afternoon Outlook','2 PM CDT afternoon analysis ready.',msUntil(14,0))
  },[notifPerm])

  async function requestNotif() {
    if(!('Notification' in window)) return
    setNotifPerm(await Notification.requestPermission())
  }

  // ── Fetch live prices for top picks ──────────────────────────────────────
  async function loadLivePrices(tickers) {
    if(!tickers?.length) return
    setLoadingLive(true)
    const results = {}
    await Promise.allSettled(tickers.map(async (t) => {
      const data = await fetchLiveData(t)
      if(data?.hasLiveData) results[t] = data
    }))
    setLiveData(results)
    setLoadingLive(false)
  }

  // ── Market-wide AI analysis using live data ───────────────────────────────
  const runAnalysis = useCallback(async (timeSlot='morning') => {
    if(!apiKey) return
    setLoading(true)

    // First fetch live market data for key indices proxies
    const marketTickers = ['SPY','QQQ','VV','AAPL','NVDA','XRP-USD','SOL-USD','MSFT']
    const liveResults = {}
    await Promise.allSettled(marketTickers.slice(0,6).map(async t => {
      const d = await fetchLiveData(t)
      if(d?.hasLiveData) liveResults[t] = d
    }))

    const liveContext = Object.entries(liveResults).map(([t,d])=>{
      const label = t==='SPY'?'S&P500 ETF (SPY)':t==='QQQ'?'NASDAQ ETF (QQQ)':t==='VV'?'Vanguard Large-Cap ETF (VV)':t==='XRP-USD'?'XRP Crypto':t==='SOL-USD'?'Solana Crypto':t
      return `${label}: $${d.currentPrice?.toFixed(4)} (${d.changePercent?.toFixed(2)}% today), RSI:${d.rsi?.toFixed(0)||'N/A'}, MACD:${d.macdSignal||'N/A'}, Vol:${formatVolume(d.volume)}`
    }).join('\n')

    const newsSentiment = Object.values(liveResults).flatMap(d=>d.newsSentiment||[]).slice(0,6)
    const newsContext = newsSentiment.map(n=>`- ${n.headline} [${n.sentiment}] (${n.source})`).join('\n')

    const timeLabels = {morning:'Pre-Market (30min before NYSE open)',midmorning:'Mid-Morning 11AM CDT',afternoon:'Afternoon 2PM CDT'}

    const prompt = `You are an elite Wall Street quantitative analyst with 20+ years experience.
Today: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
Time slot: ${timeLabels[timeSlot]}

LIVE MARKET DATA (use these EXACT prices in your analysis):
${liveContext || 'Live data temporarily unavailable - use your best knowledge'}

LIVE NEWS SENTIMENT:
${newsContext || 'No live news available'}

Based on this REAL live data, provide professional stock analysis.
Use the EXACT current prices shown above. Do NOT fabricate prices.

Return ONLY valid JSON:
{
  "marketSentiment":"Bullish|Bearish|Neutral|Cautious",
  "sentimentScore":0-100,
  "marketSummary":"2-3 sentences using the live data above",
  "topPicks":[
    {
      "ticker":"AAPL",
      "company":"Apple Inc",
      "sector":"Technology",
      "signal":"BUY|SELL|HOLD|WATCH|STRONG BUY|STRONG SELL",
      "probabilityUp":0-100,
      "expectedMoveShort":"+X.X% (1-7 days)",
      "expectedMoveMedium":"+X.X% (1-3 months)",
      "expectedMoveLong":"+X.X% (6-12 months)",
      "catalysts":["catalyst1","catalyst2"],
      "risk":"Low|Medium|High",
      "reasoning":"reasoning based on live data"
    }
  ],
  "politicalTrades":[
    {"politician":"Name","party":"R|D","ticker":"TICKER","action":"BUY|SELL","amount":"$50K-$100K","date":"recent date","significance":"why this matters"}
  ],
  "sectorOutlook":[
    {"sector":"Technology","signal":"Bullish|Bearish|Neutral","reason":"brief reason"}
  ],
  "keyLevels":{
    "sp500":{"support":0,"resistance":0,"trend":"Uptrend|Downtrend|Sideways","current":0},
    "nasdaq":{"support":0,"resistance":0,"trend":"Uptrend|Downtrend|Sideways","current":0}
  },
  "newsDrivers":["news1","news2","news3"],
  "riskFactors":["risk1","risk2"],
  "timeSlot":"${timeSlot}",
  "generatedAt":"${new Date().toISOString()}"
}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:2000,system:'You are a professional stock analyst. Use the live data provided. Return only valid JSON.',messages:[{role:'user',content:prompt}]}),
      })
      const data = await res.json()
      const parsed = JSON.parse(data.content?.[0]?.text.replace(/```json|```/g,'').trim())
      setAnalysis(parsed); save(ANALYSIS_KEY,parsed)
      const now=new Date().toISOString(); setLastRun(now); save(LAST_RUN_KEY,now)
      // Fetch live prices for the picks
      // Load live prices for picks + always include VV, XRP, SOL
      const extraTickers = ['VV','XRP','SOL']
      const allTickers = [...new Set([...(parsed.topPicks?.map(p=>p.ticker)||[]), ...extraTickers])]
      loadLivePrices(allTickers)
    } catch(e) {
      console.warn('Analysis error:',e)
    }
    setLoading(false)
  },[apiKey])

  // ── Deep search with live data ────────────────────────────────────────────
  const runSearch = useCallback(async (query) => {
    if(!query.trim()) return
    if(!apiKey) { setSearchError('Add your Anthropic API key in ⚙️ Settings first.'); return }
    setSearching(true); setSearchError(''); setSearchResult(null); setActiveView('search')

    const sym = query.trim().toUpperCase()
    const isCrypto = isCryptoTicker(sym)

    // Fetch real live data first
    let live = null
    try { live = await fetchLiveData(sym) } catch {}

    const liveCtx = live?.hasLiveData ? `
LIVE REAL-TIME DATA for ${sym}:
Current Price: ${formatPrice(live.currentPrice, live.isCrypto)}
Previous Close: ${formatPrice(live.prevClose, live.isCrypto)}
Change: ${live.changePercent?.toFixed(2)}%
Volume: ${formatVolume(live.volume)}
Market Cap: ${formatMarketCap(live.marketCap)}
52-Week High: ${formatPrice(live.high52, live.isCrypto)}
52-Week Low: ${formatPrice(live.low52, live.isCrypto)}
RSI (14): ${live.rsi?.toFixed(2) || 'N/A'}
MACD Signal: ${live.macdSignal || 'N/A'}
${live.fundamentals?.pe ? `P/E Ratio: ${live.fundamentals.pe}` : ''}
${live.fundamentals?.eps ? `EPS: $${live.fundamentals.eps}` : ''}
${live.fundamentals?.beta ? `Beta: ${live.fundamentals.beta}` : ''}
${live.fundamentals?.analystTarget ? `Analyst Price Target: $${live.fundamentals.analystTarget}` : ''}
${live.fundamentals?.earningsDate ? `Next Earnings: ${live.fundamentals.earningsDate}` : ''}

LIVE NEWS SENTIMENT (last 5 articles):
${live.newsSentiment?.map(n=>`- ${n.headline} [${n.sentiment}]`).join('\n') || 'No recent news'}
` : `Note: Live data temporarily unavailable for ${sym}. Use your best knowledge.`

    const prompt = `You are an elite ${isCrypto?'crypto analyst':'Wall Street quantitative analyst'}.
Analyze: ${sym} — ${live?.name || sym}
Date: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}

${liveCtx}

Provide three-horizon analysis using the EXACT live prices above.
Do NOT fabricate prices — use only what is provided.

Return ONLY valid JSON:
{
  "ticker":"${sym}",
  "name":"${live?.name || sym}",
  "type":"${isCrypto?'Crypto':'Stock'}",
  "sector":"${live?.fundamentals?.sector || (isCrypto?'Cryptocurrency':'Unknown')}",
  "currentPrice":${live?.currentPrice || 0},
  "prevClose":${live?.prevClose || 0},
  "changePercent":${live?.changePercent?.toFixed(2) || 0},
  "volume":"${formatVolume(live?.volume)}",
  "marketCap":"${formatMarketCap(live?.marketCap)}",
  "high52":${live?.high52 || 0},
  "low52":${live?.low52 || 0},
  "rsi":${live?.rsi?.toFixed(2) || 'null'},
  "macdSignal":"${live?.macdSignal || 'N/A'}",
  "overallSignal":"BUY|SELL|HOLD|WATCH|STRONG BUY|STRONG SELL",
  "overallScore":0-100,
  "shortTerm":{
    "horizon":"1-7 days",
    "signal":"BUY|SELL|HOLD|WATCH",
    "probabilityUp":0-100,
    "targetPrice":0.00,
    "expectedMove":"+X.X%",
    "reasoning":"reasoning based on live technical data",
    "keyLevel":0.00,
    "stopLoss":0.00
  },
  "mediumTerm":{
    "horizon":"1-3 months",
    "signal":"BUY|SELL|HOLD|WATCH",
    "probabilityUp":0-100,
    "targetPrice":0.00,
    "expectedMove":"+X.X%",
    "reasoning":"reasoning based on fundamentals and trend",
    "catalysts":["catalyst1","catalyst2"]
  },
  "longTerm":{
    "horizon":"6-12 months",
    "signal":"BUY|SELL|HOLD|WATCH",
    "probabilityUp":0-100,
    "targetPrice":0.00,
    "expectedMove":"+X.X%",
    "reasoning":"long term investment thesis",
    "catalysts":["catalyst1","catalyst2"]
  },
  "technicals":{
    "trend":"Uptrend|Downtrend|Sideways",
    "rsiSignal":"Overbought|Oversold|Neutral",
    "macd":"${live?.macdSignal || 'N/A'}",
    "support1":0.00,
    "support2":0.00,
    "resistance1":0.00,
    "resistance2":0.00,
    "volumeSignal":"Above average|Below average|Normal"
  },
  "fundamentals":{
    ${isCrypto
      ? '"dominance":"X.X%","correlation":"BTC correlation description","onChainActivity":"High|Medium|Low","developerActivity":"High|Medium|Low","defiTVL":"N/A"'
      : `"pe":${live?.fundamentals?.pe||'null'},"eps":"${live?.fundamentals?.eps||'N/A'}","beta":${live?.fundamentals?.beta||'null'},"analystTarget":"${live?.fundamentals?.analystTarget?'$'+live.fundamentals.analystTarget:'N/A'}","profitMargin":"${live?.fundamentals?.profitMargin?((live.fundamentals.profitMargin)*100).toFixed(1)+'%':'N/A'}","dividendYield":"${live?.fundamentals?.dividendYield?((live.fundamentals.dividendYield)*100).toFixed(2)+'%':'None'}","earningsDate":"${live?.fundamentals?.earningsDate||'N/A'}"`
    }
  },
  "newsSentiment":"${live?.newsSentimentScore>0.2?'Bullish':live?.newsSentimentScore<-0.2?'Bearish':'Neutral'}",
  "newsHighlights":["headline1","headline2"],
  "risks":["risk1","risk2"],
  "verdict":"One powerful investment thesis sentence"
}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:2000,system:'You are a professional financial analyst. Use the EXACT live prices provided. Return only valid JSON.',messages:[{role:'user',content:prompt}]}),
      })
      const data = await res.json()
      const parsed = JSON.parse(data.content?.[0]?.text.replace(/```json|```/g,'').trim())
      // Inject live data directly to ensure accuracy
      if(live?.hasLiveData) {
        parsed.currentPrice = live.currentPrice
        parsed.prevClose    = live.prevClose
        parsed.changePercent= live.changePercent
        parsed.high52       = live.high52
        parsed.low52        = live.low52
        parsed.rsi          = live.rsi
        parsed.liveNews     = live.newsSentiment
      }
      setSearchResult(parsed)
      const hist = [sym,...searchHistory.filter(h=>h!==sym)].slice(0,8)
      setSearchHistory(hist); save(SEARCH_HIST_KEY,hist)
    } catch(e) {
      setSearchError('Analysis failed. Check your API key or try again.')
    }
    setSearching(false)
  },[apiKey,searchHistory])

  useEffect(()=>{ if(!analysis&&apiKey) runAnalysis('morning') },[apiKey]) // eslint-disable-line

  const sigColor = (s) => {
    if(!s) return C.textMuted
    if(s.includes('BUY'))  return C.success
    if(s.includes('SELL')) return C.danger
    if(s==='HOLD')         return C.warning
    return C.accent
  }
  const fmtTime = (iso) => iso?new Date(iso).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):''
  const sentColor = (s) => s==='Bullish'?C.success:s==='Bearish'?C.danger:s==='Cautious'||s==='Volatile'?C.warning:C.textSec

  return (
    <div style={{padding:'0 16px 100px'}}>

      {/* Search bar */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:12,marginBottom:14}}>
        <div style={{display:'flex',gap:8,marginBottom:searchHistory.length>0&&activeView==='market'?8:0}}>
          <div style={{flex:1,display:'flex',alignItems:'center',gap:8,background:C.surface,borderRadius:10,padding:'8px 12px'}}>
            <span style={{fontSize:16}}>🔍</span>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch(searchQuery)}
              placeholder="AAPL, NVDA, BTC, ETH... (live prices)"
              style={{flex:1,background:'none',border:'none',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}/>
            {searchQuery&&<button onClick={()=>{setSearchQuery('');setSearchResult(null);setActiveView('market')}} style={{background:'none',border:'none',color:C.textMuted,cursor:'pointer',fontSize:14,padding:0}}>✕</button>}
          </div>
          <button onClick={()=>runSearch(searchQuery)} disabled={searching||!searchQuery.trim()} style={{background:searching?C.surface:C.accent,border:'none',borderRadius:10,padding:'8px 14px',color:searching?C.textMuted:'#fff',fontSize:13,fontWeight:600,cursor:searching||!searchQuery.trim()?'not-allowed':'pointer',fontFamily:'Inter,sans-serif',flexShrink:0}}>
            {searching?<Spin size={14}/>:'Analyze'}
          </button>
        </div>
        {searchHistory.length>0&&activeView==='market'&&(
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {searchHistory.map(h=>(
              <button key={h} onClick={()=>{setSearchQuery(h);runSearch(h)}} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:'3px 10px',color:C.textSec,fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{h}</button>
            ))}
          </div>
        )}
      </div>

      {searchError&&<div style={{background:'rgba(255,94,94,0.1)',border:'1px solid rgba(255,94,94,0.3)',borderRadius:10,padding:'10px 14px',color:C.danger,fontSize:13,marginBottom:12}}>{searchError}</div>}

      {/* ── SEARCH VIEW ── */}
      {activeView==='search'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <h3 style={{color:C.text,fontSize:15,fontWeight:700}}>Live Analysis</h3>
            <button onClick={()=>{setActiveView('market');setSearchResult(null);setSearchQuery('')}} style={{background:C.accentSoft,border:'none',borderRadius:8,padding:'5px 12px',color:C.accent,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>← Market</button>
          </div>
          {searching&&(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 20px',gap:14}}>
              <Spin size={36} color={C.accent}/>
              <div style={{textAlign:'center'}}>
                <p style={{color:C.textSec,fontSize:13,marginBottom:4}}>Fetching live market data for {searchQuery.toUpperCase()}...</p>
                <p style={{color:C.textMuted,fontSize:11}}>Real-time prices · Fundamentals · News sentiment · AI analysis</p>
              </div>
            </div>
          )}
          {searchResult&&!searching&&<SearchResultCard result={searchResult} sigColor={sigColor}/>}
        </div>
      )}

      {/* ── MARKET VIEW ── */}
      {activeView==='market'&&(
        <>
          {/* Header */}
          <div style={{background:'linear-gradient(135deg,rgba(82,201,134,.15),rgba(69,183,209,.08))',border:'1px solid rgba(82,201,134,.3)',borderRadius:16,padding:14,marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div>
                <div style={{color:C.success,fontSize:13,fontWeight:700,marginBottom:2}}>📈 Live AI Market Intelligence</div>
                <div style={{color:C.textMuted,fontSize:11}}>{lastRun?`Updated: ${fmtTime(lastRun)} • Live prices via Yahoo & Alpha Vantage`:'Tap a time slot to run live analysis'}</div>
              </div>
              {analysis&&<div style={{textAlign:'right'}}>
                <div style={{color:sentColor(analysis.marketSentiment),fontSize:13,fontWeight:700}}>{analysis.marketSentiment}</div>
                <div style={{color:C.textMuted,fontSize:10}}>AI Sentiment</div>
              </div>}
            </div>
            {analysis&&<>
              <div style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{color:C.textMuted,fontSize:10}}>Sentiment Score</span>
                  <span style={{color:sentColor(analysis.marketSentiment),fontSize:10,fontWeight:700}}>{analysis.sentimentScore}/100</span>
                </div>
                <div style={{background:'rgba(255,255,255,0.1)',borderRadius:3,height:5,overflow:'hidden'}}>
                  <div style={{background:sentColor(analysis.marketSentiment),height:'100%',width:`${analysis.sentimentScore}%`,borderRadius:3}}/>
                </div>
              </div>
              {analysis.marketSummary&&<p style={{color:C.text,fontSize:12,lineHeight:1.6,marginBottom:10}}>{analysis.marketSummary}</p>}
            </>}
            <div style={{display:'flex',gap:6}}>
              {['morning','midmorning','afternoon'].map((slot,i)=>{
                const labels=['🌅 Pre-Mkt','☀️ 11 AM','🌆 2 PM']
                return <button key={slot} onClick={()=>runAnalysis(slot)} disabled={loading||!apiKey} style={{flex:1,background:loading?C.surface:'rgba(82,201,134,0.2)',border:'1px solid rgba(82,201,134,0.4)',borderRadius:9,padding:'7px 2px',color:loading?C.textMuted:C.success,fontSize:10,fontWeight:600,cursor:loading||!apiKey?'not-allowed':'pointer',fontFamily:'Inter,sans-serif'}}>{labels[i]}</button>
              })}
            </div>
            {!apiKey&&<p style={{color:C.warning,fontSize:11,marginTop:8,textAlign:'center'}}>⚠️ Add your Anthropic API key in ⚙️ Settings</p>}
          </div>

          {/* Notif permission */}
          {notifPerm!=='granted'&&notifPerm!=='unsupported'&&(
            <div style={{background:'rgba(255,159,67,0.1)',border:'1px solid rgba(255,159,67,0.3)',borderRadius:12,padding:10,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{color:C.warning,fontSize:12}}>🔔 Enable market alert notifications</span>
              <button onClick={requestNotif} style={{background:C.warning,border:'none',borderRadius:8,padding:'5px 10px',color:'#fff',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Enable</button>
            </div>
          )}

          {loading&&<div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'32px 20px',gap:12}}>
            <Spin size={32} color={C.success}/>
            <div style={{textAlign:'center'}}>
              <p style={{color:C.textSec,fontSize:13,marginBottom:3}}>Fetching live market data...</p>
              <p style={{color:C.textMuted,fontSize:11}}>Yahoo Finance + Alpha Vantage + AI Analysis</p>
            </div>
          </div>}

          {analysis&&!loading&&(
            <>
              <div style={{display:'flex',background:C.card,borderRadius:12,marginBottom:12,overflow:'hidden'}}>
                {[['picks','🎯 Picks'],['political','🏛️ Political'],['news','📰 News'],['sectors','📊 Sectors']].map(([k,l])=>(
                  <button key={k} onClick={()=>setTab(k)} style={{flex:1,border:'none',background:tab===k?C.accentSoft:'transparent',color:tab===k?C.accent:C.textMuted,padding:'10px 2px',fontSize:10,fontWeight:tab===k?700:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{l}</button>
                ))}
              </div>

              {/* PICKS TAB */}
              {tab==='picks'&&(
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <h3 style={{color:C.text,fontSize:14,fontWeight:700}}>Today's AI Picks</h3>
                    {loadingLive&&<div style={{display:'flex',alignItems:'center',gap:5}}><Spin size={12} color={C.success}/><span style={{color:C.textMuted,fontSize:10}}>Loading live prices...</span></div>}
                  </div>
                  {analysis.topPicks?.map((pick,i)=>(
                    <PickCard key={i} pick={pick} live={liveData[pick.ticker]} sigColor={sigColor} onSearch={(t)=>{setSearchQuery(t);runSearch(t)}}/>
                  ))}
                  {analysis.keyLevels&&(
                    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginTop:4}}>
                      <h4 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>📐 Key Market Levels</h4>
                      {[['S&P 500',analysis.keyLevels.sp500],['NASDAQ',analysis.keyLevels.nasdaq]].map(([name,data])=>data&&(
                        <div key={name} style={{marginBottom:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{color:C.textSec,fontSize:12,fontWeight:600}}>{name} {data.current?`(${data.current.toLocaleString()})`:''}</span>
                            <span style={{color:data.trend==='Uptrend'?C.success:data.trend==='Downtrend'?C.danger:C.warning,fontSize:11,fontWeight:700}}>
                              {data.trend==='Uptrend'?'↑':data.trend==='Downtrend'?'↓':'→'} {data.trend}
                            </span>
                          </div>
                          <div style={{display:'flex',gap:8}}>
                            <div style={{flex:1,background:'rgba(82,201,134,0.1)',borderRadius:8,padding:'6px 10px',textAlign:'center'}}>
                              <div style={{color:C.success,fontSize:12,fontWeight:700}}>{data.support?.toLocaleString()}</div>
                              <div style={{color:C.textMuted,fontSize:10}}>Support</div>
                            </div>
                            <div style={{flex:1,background:'rgba(255,94,94,0.1)',borderRadius:8,padding:'6px 10px',textAlign:'center'}}>
                              <div style={{color:C.danger,fontSize:12,fontWeight:700}}>{data.resistance?.toLocaleString()}</div>
                              <div style={{color:C.textMuted,fontSize:10}}>Resistance</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* POLITICAL TAB */}
              {tab==='political'&&(
                <div>
                  <div style={{background:'rgba(108,99,255,0.08)',border:'1px solid rgba(108,99,255,0.2)',borderRadius:12,padding:10,marginBottom:12}}>
                    <p style={{color:C.textSec,fontSize:12,lineHeight:1.5}}>🏛️ <strong style={{color:C.text}}>STOCK Act</strong> — Politicians report trades within 45 days. Often signal legislative direction.</p>
                  </div>
                  {analysis.politicalTrades?.map((trade,i)=>(
                    <div key={i} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:12,marginBottom:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:7}}>
                        <div style={{width:34,height:34,borderRadius:'50%',background:trade.party==='R'?'rgba(255,94,94,0.2)':'rgba(69,183,209,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>{trade.party==='R'?'🔴':'🔵'}</div>
                        <div style={{flex:1}}>
                          <div style={{color:C.text,fontSize:12,fontWeight:600}}>{trade.politician}</div>
                          <div style={{color:C.textMuted,fontSize:10}}>{trade.date}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{background:trade.action==='BUY'?'rgba(82,201,134,0.15)':'rgba(255,94,94,0.15)',color:trade.action==='BUY'?C.success:C.danger,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:7}}>{trade.action} {trade.ticker}</div>
                          <div style={{color:C.textMuted,fontSize:9,marginTop:2}}>{trade.amount}</div>
                          <button onClick={()=>{setSearchQuery(trade.ticker);runSearch(trade.ticker)}} style={{background:C.accentSoft,border:'none',borderRadius:5,padding:'2px 7px',color:C.accent,fontSize:9,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:3}}>Live Analysis →</button>
                        </div>
                      </div>
                      <p style={{color:C.textSec,fontSize:11,lineHeight:1.5}}>💡 {trade.significance}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* NEWS TAB */}
              {tab==='news'&&(
                <div>
                  <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:10}}>
                    <h4 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>🚀 Market Catalysts</h4>
                    {analysis.newsDrivers?.map((news,i)=>(
                      <div key={i} style={{display:'flex',gap:10,marginBottom:10,padding:'7px 0',borderBottom:i<analysis.newsDrivers.length-1?`1px solid ${C.border}`:'none'}}>
                        <div style={{width:22,height:22,borderRadius:'50%',background:C.accentSoft,color:C.accent,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</div>
                        <p style={{color:C.text,fontSize:12,lineHeight:1.5}}>{news}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{background:'rgba(255,94,94,0.05)',border:'1px solid rgba(255,94,94,0.2)',borderRadius:14,padding:14}}>
                    <h4 style={{color:C.danger,fontSize:13,fontWeight:700,marginBottom:10}}>⚠️ Risk Factors</h4>
                    {analysis.riskFactors?.map((risk,i)=>(
                      <div key={i} style={{display:'flex',gap:10,marginBottom:7}}><span style={{color:C.danger}}>•</span><p style={{color:C.textSec,fontSize:12,lineHeight:1.5}}>{risk}</p></div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTORS TAB */}
              {tab==='sectors'&&(
                <div>
                  <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:10}}>Sector Outlook</h3>
                  {analysis.sectorOutlook?.map((s,i)=>(
                    <div key={i} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:12,marginBottom:8,display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:7,height:38,borderRadius:4,background:s.signal==='Bullish'?C.success:s.signal==='Bearish'?C.danger:C.warning,flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                          <span style={{color:C.text,fontSize:13,fontWeight:600}}>{s.sector}</span>
                          <span style={{background:(s.signal==='Bullish'?C.success:s.signal==='Bearish'?C.danger:C.warning)+'20',color:s.signal==='Bullish'?C.success:s.signal==='Bearish'?C.danger:C.warning,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:6}}>
                            {s.signal==='Bullish'?'↑':s.signal==='Bearish'?'↓':'→'} {s.signal}
                          </span>
                        </div>
                        <p style={{color:C.textSec,fontSize:11,lineHeight:1.4}}>{s.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!analysis&&!loading&&(
            <div style={{textAlign:'center',padding:'48px 20px'}}>
              <div style={{fontSize:52,marginBottom:14}}>📈</div>
              <h3 style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:6}}>Live Market Intelligence</h3>
              <p style={{color:C.textSec,fontSize:13,marginBottom:6}}>{apiKey?'Tap Pre-Mkt, 11 AM, or 2 PM for live AI analysis.':'Add your Anthropic API key in ⚙️ Settings.'}</p>
              <p style={{color:C.textMuted,fontSize:11}}>Powered by Yahoo Finance + Alpha Vantage + Claude AI</p>
            </div>
          )}
        </>
      )}

      <div style={{background:C.surface,borderRadius:10,padding:10,marginTop:12}}>
        <p style={{color:C.textMuted,fontSize:10,lineHeight:1.5,textAlign:'center'}}>⚠️ For informational purposes only. Not financial advice. Always do your own research before investing.</p>
      </div>
    </div>
  )
}

// ── Pick Card with live price ─────────────────────────────────────────────────
function PickCard({ pick, live, sigColor, onSearch }) {
  const [exp, setExp] = useState(false)
  const hasLive = live?.hasLiveData
  const price = hasLive ? live.currentPrice : null
  const chg   = hasLive ? live.changePercent : null
  const isUp  = chg >= 0

  return (
    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:12,marginBottom:8}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
        <div style={{background:sigColor(pick.signal)+'20',borderRadius:9,padding:'6px 8px',minWidth:46,textAlign:'center',flexShrink:0}}>
          <div style={{color:sigColor(pick.signal),fontSize:12,fontWeight:800}}>{pick.ticker}</div>
          <div style={{color:sigColor(pick.signal),fontSize:8,fontWeight:700}}>{pick.signal}</div>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:C.text,fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pick.company||pick.ticker}</div>
          <div style={{color:C.textMuted,fontSize:10,marginTop:1}}>{pick.sector}</div>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          {hasLive
            ? <>
                <div style={{color:C.text,fontSize:14,fontWeight:800}}>{formatPrice(price)}</div>
                <div style={{color:isUp?C.success:C.danger,fontSize:11,fontWeight:600}}>{isUp?'+':''}{chg?.toFixed(2)}% today</div>
              </>
            : <div style={{color:C.textMuted,fontSize:11}}>Loading...</div>
          }
          <button onClick={e=>{e.stopPropagation();onSearch(pick.ticker)}} style={{background:C.accentSoft,border:'none',borderRadius:6,padding:'2px 7px',color:C.accent,fontSize:9,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:2}}>Deep →</button>
        </div>
      </div>

      {/* 3 time horizons */}
      <div style={{display:'flex',gap:5,marginBottom:8}}>
        {[['Short','1-7d',pick.expectedMoveShort],['Medium','1-3m',pick.expectedMoveMedium],['Long','6-12m',pick.expectedMoveLong]].map(([label,period,move])=>{
          const up = move?.startsWith('+')
          return <div key={label} style={{flex:1,background:C.surface,borderRadius:8,padding:'5px 6px',textAlign:'center'}}>
            <div style={{color:C.textMuted,fontSize:9}}>{label} ({period})</div>
            <div style={{color:up?C.success:C.danger,fontSize:11,fontWeight:700,marginTop:1}}>{move||'—'}</div>
          </div>
        })}
      </div>

      {/* Probability bar */}
      <div onClick={()=>setExp(!exp)} style={{cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
          <span style={{color:C.textMuted,fontSize:10}}>Probability of upward move</span>
          <span style={{color:pick.probabilityUp>=65?C.success:pick.probabilityUp>=50?C.warning:C.danger,fontSize:10,fontWeight:700}}>{pick.probabilityUp}%</span>
        </div>
        <div style={{background:C.surface,borderRadius:3,height:5,overflow:'hidden',marginBottom:exp?8:0}}>
          <div style={{background:pick.probabilityUp>=65?C.success:pick.probabilityUp>=50?C.warning:C.danger,height:'100%',width:`${pick.probabilityUp}%`,borderRadius:3}}/>
        </div>
        {exp&&<div style={{paddingTop:8,borderTop:`1px solid ${C.border}`}}>
          {hasLive&&<div style={{display:'flex',gap:6,marginBottom:7}}>
            <div style={{flex:1,background:C.surface,borderRadius:7,padding:'5px',textAlign:'center'}}>
              <div style={{color:C.text,fontSize:10,fontWeight:700}}>RSI {live.rsi?.toFixed(0)||'—'}</div>
              <div style={{color:C.textMuted,fontSize:9}}>{live.rsi>70?'Overbought':live.rsi<30?'Oversold':'Neutral'}</div>
            </div>
            <div style={{flex:1,background:C.surface,borderRadius:7,padding:'5px',textAlign:'center'}}>
              <div style={{color:C.text,fontSize:10,fontWeight:700}}>{formatPrice(live.high52)}</div>
              <div style={{color:C.textMuted,fontSize:9}}>52w High</div>
            </div>
            <div style={{flex:1,background:C.surface,borderRadius:7,padding:'5px',textAlign:'center'}}>
              <div style={{color:C.text,fontSize:10,fontWeight:700}}>{formatPrice(live.low52)}</div>
              <div style={{color:C.textMuted,fontSize:9}}>52w Low</div>
            </div>
          </div>}
          {pick.catalysts?.length>0&&<div style={{marginBottom:6}}>{pick.catalysts.map((c,i)=><div key={i} style={{color:C.text,fontSize:11,marginBottom:3}}>✓ {c}</div>)}</div>}
          {pick.reasoning&&<p style={{color:C.textSec,fontSize:11,lineHeight:1.5,fontStyle:'italic'}}>{pick.reasoning}</p>}
        </div>}
        <div style={{textAlign:'center',marginTop:4}}><span style={{color:C.textMuted,fontSize:9}}>{exp?'▲ Less':'▼ More details'}</span></div>
      </div>
    </div>
  )
}

// ── Search Result with 3 horizons ─────────────────────────────────────────────
function SearchResultCard({ result, sigColor }) {
  const isUp = result.changePercent >= 0

  return (
    <div>
      {/* Live price header */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <div style={{width:52,height:52,borderRadius:14,background:sigColor(result.overallSignal)+'20',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <div style={{textAlign:'center'}}>
              <div style={{color:sigColor(result.overallSignal),fontSize:13,fontWeight:800}}>{result.ticker}</div>
              <div style={{color:result.type==='Crypto'?'#FFB347':'#45B7D1',fontSize:8,fontWeight:600}}>{result.type}</div>
            </div>
          </div>
          <div style={{flex:1}}>
            <div style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:2}}>{result.name}</div>
            <div style={{color:C.textMuted,fontSize:11}}>{result.sector}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{color:C.text,fontSize:20,fontWeight:800}}>{formatPrice(result.currentPrice, result.type==='Crypto')}</div>
            <div style={{color:isUp?C.success:C.danger,fontSize:13,fontWeight:600}}>{isUp?'+':''}{result.changePercent?.toFixed(2)}% today</div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:12}}>
          {[
            ['Prev Close', formatPrice(result.prevClose, result.type==='Crypto')],
            ['Volume',     result.volume],
            ['Mkt Cap',    result.marketCap],
            ['52w High',   formatPrice(result.high52, result.type==='Crypto')],
            ['52w Low',    formatPrice(result.low52, result.type==='Crypto')],
            ['RSI (14)',   result.rsi?`${result.rsi}`:'N/A'],
          ].map(([l,v])=>(
            <div key={l} style={{background:C.surface,borderRadius:8,padding:'6px 8px',textAlign:'center'}}>
              <div style={{color:C.textMuted,fontSize:9}}>{l}</div>
              <div style={{color:C.text,fontSize:11,fontWeight:600,marginTop:1}}>{v||'N/A'}</div>
            </div>
          ))}
        </div>

        {/* Overall signal + score */}
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{background:sigColor(result.overallSignal)+'20',borderRadius:10,padding:'8px 16px'}}>
            <div style={{color:sigColor(result.overallSignal),fontSize:14,fontWeight:800}}>{result.overallSignal}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
              <span style={{color:C.textMuted,fontSize:10}}>Overall AI Score</span>
              <span style={{color:result.overallScore>=70?C.success:result.overallScore>=50?C.warning:C.danger,fontSize:11,fontWeight:700}}>{result.overallScore}/100</span>
            </div>
            <div style={{background:C.surface,borderRadius:3,height:6,overflow:'hidden'}}>
              <div style={{background:result.overallScore>=70?C.success:result.overallScore>=50?C.warning:C.danger,height:'100%',width:`${result.overallScore}%`,borderRadius:3,transition:'width 1s'}}/>
            </div>
          </div>
        </div>

        {result.verdict&&<div style={{marginTop:10,padding:'8px 12px',background:C.accentSoft,borderRadius:10,color:C.accent,fontSize:12,fontWeight:600,fontStyle:'italic'}}>💡 {result.verdict}</div>}
      </div>

      {/* 3 Time Horizons */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:10}}>
        <h4 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:12}}>⏱️ Multi-Horizon Analysis</h4>
        {[result.shortTerm,result.mediumTerm,result.longTerm].filter(Boolean).map((horizon,i)=>{
          const colors=['#FFB347','#45B7D1','#C984E0']
          const labels=['Short Term','Medium Term','Long Term']
          const isUp2 = horizon.expectedMove?.startsWith('+')
          return (
            <div key={i} style={{background:C.surface,borderRadius:12,padding:12,marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div>
                  <span style={{background:colors[i]+'20',color:colors[i],fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:6}}>{labels[i]}</span>
                  <span style={{color:C.textMuted,fontSize:10,marginLeft:6}}>{horizon.horizon}</span>
                </div>
                <div style={{textAlign:'right'}}>
                  <span style={{background:sigColor(horizon.signal)+'20',color:sigColor(horizon.signal),fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,marginRight:6}}>{horizon.signal}</span>
                  <span style={{color:isUp2?C.success:C.danger,fontSize:13,fontWeight:800}}>{horizon.expectedMove}</span>
                </div>
              </div>
              <div style={{display:'flex',gap:8,marginBottom:6}}>
                <div style={{flex:1,background:C.card,borderRadius:8,padding:'5px 8px',textAlign:'center'}}>
                  <div style={{color:isUp2?C.success:C.danger,fontSize:12,fontWeight:700}}>{formatPrice(horizon.targetPrice, result.type==='Crypto')}</div>
                  <div style={{color:C.textMuted,fontSize:9}}>Target</div>
                </div>
                <div style={{flex:1,background:C.card,borderRadius:8,padding:'5px 8px',textAlign:'center'}}>
                  <div style={{color:horizon.probabilityUp>=65?C.success:horizon.probabilityUp>=50?C.warning:C.danger,fontSize:12,fontWeight:700}}>{horizon.probabilityUp}%</div>
                  <div style={{color:C.textMuted,fontSize:9}}>Probability ↑</div>
                </div>
                {horizon.stopLoss&&<div style={{flex:1,background:C.card,borderRadius:8,padding:'5px 8px',textAlign:'center'}}>
                  <div style={{color:C.danger,fontSize:12,fontWeight:700}}>{formatPrice(horizon.stopLoss, result.type==='Crypto')}</div>
                  <div style={{color:C.textMuted,fontSize:9}}>Stop Loss</div>
                </div>}
              </div>
              <div style={{background:C.card,borderRadius:3,height:4,overflow:'hidden',marginBottom:6}}>
                <div style={{background:colors[i],height:'100%',width:`${horizon.probabilityUp}%`,borderRadius:3}}/>
              </div>
              <p style={{color:C.textSec,fontSize:11,lineHeight:1.5}}>{horizon.reasoning}</p>
              {horizon.catalysts&&<div style={{marginTop:5}}>{horizon.catalysts.map((c,j)=><div key={j} style={{color:C.text,fontSize:11,marginBottom:2}}>✓ {c}</div>)}</div>}
            </div>
          )
        })}
      </div>

      {/* Technicals */}
      {result.technicals&&(
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:10}}>
          <h4 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>📊 Technical Analysis</h4>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
            {[
              ['Trend',   result.technicals.trend,  result.technicals.trend==='Uptrend'?C.success:result.technicals.trend==='Downtrend'?C.danger:C.warning],
              ['RSI',     result.technicals.rsiSignal, result.technicals.rsiSignal==='Oversold'?C.success:result.technicals.rsiSignal==='Overbought'?C.danger:C.warning],
              ['MACD',    result.technicals.macd,   result.technicals.macd?.includes('Bullish')?C.success:C.danger],
              ['Volume',  result.technicals.volumeSignal, C.textSec],
            ].map(([l,v,color])=>(
              <div key={l} style={{background:C.surface,borderRadius:9,padding:'8px 10px'}}>
                <div style={{color:C.textMuted,fontSize:10,marginBottom:2}}>{l}</div>
                <div style={{color:color,fontSize:12,fontWeight:700}}>{v||'N/A'}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:6}}>
            {[['Support 1',result.technicals.support1,C.success],['Support 2',result.technicals.support2,C.success],['Resist 1',result.technicals.resistance1,C.danger],['Resist 2',result.technicals.resistance2,C.danger]].map(([l,v,color])=>(
              <div key={l} style={{flex:1,background:color+'10',borderRadius:7,padding:'5px 4px',textAlign:'center'}}>
                <div style={{color:color,fontSize:10,fontWeight:700}}>{formatPrice(v,result.type==='Crypto')}</div>
                <div style={{color:C.textMuted,fontSize:8}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* News Sentiment */}
      {result.liveNews?.length>0&&(
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:10}}>
          <h4 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>📰 Live News Sentiment</h4>
          {result.liveNews.slice(0,4).map((n,i)=>(
            <div key={i} style={{display:'flex',gap:10,marginBottom:8,padding:'6px 0',borderBottom:i<3?`1px solid ${C.border}`:'none'}}>
              <span style={{fontSize:14,flexShrink:0}}>{n.sentiment==='Bullish'?'🟢':n.sentiment==='Bearish'?'🔴':'🟡'}</span>
              <div style={{flex:1}}>
                <p style={{color:C.text,fontSize:11,lineHeight:1.4,marginBottom:2}}>{n.headline}</p>
                <span style={{color:C.textMuted,fontSize:10}}>{n.source}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fundamentals */}
      {result.fundamentals&&Object.keys(result.fundamentals).length>0&&(
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:10}}>
          <h4 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>💰 {result.type==='Crypto'?'On-Chain':'Fundamental'} Data</h4>
          {Object.entries(result.fundamentals).filter(([,v])=>v&&v!=='null'&&v!==null).map(([k,v])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.textMuted,fontSize:12}}>{k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}</span>
              <span style={{color:C.text,fontSize:12,fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
      <div style={{background:'rgba(255,94,94,0.05)',border:'1px solid rgba(255,94,94,0.15)',borderRadius:14,padding:14}}>
        <h4 style={{color:C.danger,fontSize:12,fontWeight:700,marginBottom:8}}>⚠️ Key Risks</h4>
        {result.risks?.map((r,i)=><div key={i} style={{color:C.textSec,fontSize:12,marginBottom:4}}>• {r}</div>)}
      </div>
    </div>
  )
}
