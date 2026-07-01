import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/store.jsx'
import { C } from '../utils/helpers.js'
import { Spin } from '../components/UI.jsx'

const ANALYSIS_KEY = 'sai_stock_analysis'
const LAST_RUN_KEY = 'sai_stock_last_run'
const SEARCH_HISTORY_KEY = 'sai_search_history'

const load = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

function scheduleNotification(title, body, delayMs) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  setTimeout(() => { new Notification(title, { body, icon: '/favicon.ico' }) }, delayMs)
}

function msUntilTime(hour, minute) {
  const now = new Date()
  const target = new Date(now)
  target.setHours(hour, minute, 0, 0)
  let diff = target - now
  if (diff < 0) diff += 86400000
  return diff
}

export default function Stocks() {
  const { apiKey } = useStore()
  const [analysis,     setAnalysis]     = useState(() => load(ANALYSIS_KEY, null))
  const [loading,      setLoading]      = useState(false)
  const [lastRun,      setLastRun]      = useState(() => load(LAST_RUN_KEY, null))
  const [notifPerm,    setNotifPerm]    = useState(() => 'Notification' in window ? Notification.permission : 'unsupported')
  const [tab,          setTab]          = useState('picks')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching,    setSearching]    = useState(false)
  const [searchError,  setSearchError]  = useState('')
  const [searchHistory,setSearchHistory]= useState(() => load(SEARCH_HISTORY_KEY, []))
  const [activeView,   setActiveView]   = useState('market') // market | search

  useEffect(() => {
    if (notifPerm !== 'granted') return
    scheduleNotification('📈 Pre-Market Analysis Ready', 'Secretary AI stock picks — 30 min before open.', msUntilTime(8, 30))
    scheduleNotification('📊 Mid-Morning Update', '11 AM CDT analysis update available.', msUntilTime(11, 0))
    scheduleNotification('📉 Afternoon Outlook', '2 PM CDT trading analysis ready.', msUntilTime(14, 0))
  }, [notifPerm])

  async function requestNotif() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  // ── Market-wide analysis ──────────────────────────────────────────────────
  const runAnalysis = useCallback(async (timeSlot = 'morning') => {
    if (!apiKey) return
    setLoading(true)
    const timeLabels = { morning:'Pre-Market (30min before NYSE open)', midmorning:'Mid-Morning (11 AM CDT)', afternoon:'Afternoon (2 PM CDT)' }
    const prompt = `You are an elite Wall Street quantitative analyst. Today: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}. Time: ${timeLabels[timeSlot]}.

Provide professional market analysis using knowledge of: macro conditions, Fed policy, earnings, geopolitics, sector rotations, STOCK Act disclosures, pre-market futures, technicals.

Return ONLY valid JSON:
{
  "marketSentiment":"Bullish|Bearish|Neutral|Cautious",
  "sentimentScore":0-100,
  "marketSummary":"2-3 sentence overview",
  "topPicks":[{"ticker":"AAPL","company":"Apple Inc","sector":"Technology","currentPrice":185.50,"targetPrice":192.00,"probabilityUp":78,"expectedMove":"+3.5%","timeframe":"Today","signal":"BUY|SELL|HOLD|WATCH","catalysts":["catalyst1","catalyst2"],"risk":"Low|Medium|High","reasoning":"brief reasoning"}],
  "politicalTrades":[{"politician":"Name","party":"R|D","ticker":"TICKER","action":"BUY|SELL","amount":"$50K-$100K","date":"recent date","significance":"why this matters"}],
  "sectorOutlook":[{"sector":"Technology","signal":"Bullish|Bearish|Neutral","reason":"brief reason"}],
  "keyLevels":{"sp500":{"support":5100,"resistance":5300,"trend":"Uptrend|Downtrend|Sideways"},"nasdaq":{"support":18000,"resistance":19500,"trend":"Uptrend|Downtrend|Sideways"}},
  "newsDrivers":["news1","news2","news3"],
  "riskFactors":["risk1","risk2"],
  "timeSlot":"${timeSlot}",
  "generatedAt":"${new Date().toISOString()}"
}`
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:2000,system:'You are a professional stock trader. Return only valid JSON.',messages:[{role:'user',content:prompt}]}),
      })
      const data = await res.json()
      const parsed = JSON.parse(data.content?.[0]?.text.replace(/```json|```/g,'').trim())
      setAnalysis(parsed); save(ANALYSIS_KEY, parsed)
      const now = new Date().toISOString(); setLastRun(now); save(LAST_RUN_KEY, now)
    } catch { setAnalysis(DEMO_DATA); save(ANALYSIS_KEY, DEMO_DATA) }
    setLoading(false)
  }, [apiKey])

  // ── Search: stock or crypto analysis ─────────────────────────────────────
  const runSearch = useCallback(async (query) => {
    if (!query.trim()) return
    if (!apiKey) { setSearchError('Add your Anthropic API key in ⚙️ Settings first.'); return }
    setSearching(true); setSearchError(''); setSearchResult(null); setActiveView('search')

    const q = query.trim().toUpperCase()
    const isCrypto = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC','LINK','LTC','BCH','SHIB','UNI','ATOM','ALGO','FTM','NEAR','SAND','MANA','AXS','USDT','USDC','DAI'].includes(q) || query.toLowerCase().includes('coin') || query.toLowerCase().includes('crypto') || query.toLowerCase().includes('token')

    const prompt = `You are an elite ${isCrypto ? 'crypto analyst and blockchain expert' : 'Wall Street quantitative analyst'}.

Analyze: ${query.toUpperCase()} ${isCrypto ? '(cryptocurrency)' : '(stock)'}
Date: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}

Provide deep analysis using: ${isCrypto
  ? 'blockchain fundamentals, on-chain metrics, DeFi ecosystem, whale movements, regulatory environment, market cap, volume, correlation with BTC, technical levels, upcoming catalysts'
  : 'fundamentals, earnings, valuation multiples, institutional ownership, options flow, technical analysis, sector comparison, analyst ratings, insider trading, upcoming catalysts'
}.

Return ONLY valid JSON:
{
  "ticker":"${q}",
  "name":"Full name",
  "type":"${isCrypto ? 'Crypto' : 'Stock'}",
  "sector":"sector or blockchain ecosystem",
  "currentPrice":0.00,
  "targetPrice":0.00,
  "targetTimeframe":"1 week|1 month|3 months",
  "signal":"BUY|SELL|HOLD|WATCH|STRONG BUY|STRONG SELL",
  "probabilityUp":0-100,
  "expectedMove":"+X.X% or -X.X%",
  "shortTermOutlook":"Bullish|Bearish|Neutral|Volatile",
  "risk":"Low|Medium|High|Very High",
  "overallScore":0-100,
  "summary":"3-4 sentence professional analysis",
  "technicals":{
    "trend":"Uptrend|Downtrend|Sideways",
    "rsi":0-100,
    "support":0.00,
    "resistance":0.00,
    "movingAvg50":"above|below",
    "movingAvg200":"above|below",
    "volume":"Above average|Below average|Normal"
  },
  "fundamentals":{
    ${isCrypto
      ? '"marketCap":"$X.XB","volume24h":"$X.XB","circulatingSupply":"X.XM","dominance":"X.X%","correlation":"BTC correlation","onChainActivity":"High|Medium|Low","developerActivity":"High|Medium|Low"'
      : '"marketCap":"$X.XB","pe":0.0,"eps":"$X.XX","revenueGrowth":"X.X%","margin":"X.X%","debtToEquity":"X.X","analystRating":"Buy|Hold|Sell","priceTarget":"$X.XX","institutionalOwnership":"X.X%"'
    }
  },
  "catalysts":["catalyst1","catalyst2","catalyst3"],
  "risks":["risk1","risk2"],
  "keyLevels":{"support1":0.00,"support2":0.00,"resistance1":0.00,"resistance2":0.00},
  ${isCrypto ? '"networkMetrics":{"transactions":"X.XM/day","activeAddresses":"X.XM","hashRate":"X.X EH/s or N/A","stakingYield":"X.X% or N/A"},' : ''}
  "verdict":"One powerful sentence investment thesis"
}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1500,system:'You are a professional financial analyst. Return only valid JSON.',messages:[{role:'user',content:prompt}]}),
      })
      const data = await res.json()
      const parsed = JSON.parse(data.content?.[0]?.text.replace(/```json|```/g,'').trim())
      setSearchResult(parsed)
      const newHistory = [q, ...searchHistory.filter(h => h !== q)].slice(0, 8)
      setSearchHistory(newHistory); save(SEARCH_HISTORY_KEY, newHistory)
    } catch(e) {
      setSearchError('Analysis failed. Check your API key or try again.')
    }
    setSearching(false)
  }, [apiKey, searchHistory])

  const signalColor = (sig) => {
    if (!sig) return C.textMuted
    if (sig.includes('BUY'))  return C.success
    if (sig.includes('SELL')) return C.danger
    if (sig === 'HOLD')       return C.warning
    return C.accent
  }
  const sentimentColor = (s) => {
    if (s === 'Bullish') return C.success
    if (s === 'Bearish') return C.danger
    if (s === 'Cautious' || s === 'Volatile') return C.warning
    return C.textSec
  }
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : ''

  useEffect(() => { if (!analysis && apiKey) runAnalysis('morning') }, [apiKey]) // eslint-disable-line

  return (
    <div style={{padding:'0 16px 100px'}}>

      {/* Search Bar */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:12,marginBottom:14}}>
        <div style={{display:'flex',gap:8,marginBottom:searchHistory.length>0&&activeView==='market'?8:0}}>
          <div style={{flex:1,display:'flex',alignItems:'center',gap:8,background:C.surface,borderRadius:10,padding:'8px 12px'}}>
            <span style={{fontSize:16}}>🔍</span>
            <input
              value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&runSearch(searchQuery)}
              placeholder="Search stock or crypto... (AAPL, BTC, ETH)"
              style={{flex:1,background:'none',border:'none',color:C.text,fontSize:13,fontFamily:'Inter,sans-serif',outline:'none'}}
            />
            {searchQuery&&<button onClick={()=>{setSearchQuery('');setSearchResult(null);setActiveView('market')}} style={{background:'none',border:'none',color:C.textMuted,cursor:'pointer',fontSize:14,padding:0}}>✕</button>}
          </div>
          <button onClick={()=>runSearch(searchQuery)} disabled={searching||!searchQuery.trim()} style={{background:searching?C.surface:C.accent,border:'none',borderRadius:10,padding:'8px 14px',color:searching?C.textMuted:'#fff',fontSize:13,fontWeight:600,cursor:searching||!searchQuery.trim()?'not-allowed':'pointer',fontFamily:'Inter,sans-serif',flexShrink:0}}>
            {searching?<Spin size={14}/>:'Analyze'}
          </button>
        </div>

        {/* Search history chips */}
        {searchHistory.length>0&&activeView==='market'&&(
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {searchHistory.map(h=>(
              <button key={h} onClick={()=>{setSearchQuery(h);runSearch(h)}} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:'3px 10px',color:C.textSec,fontSize:11,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search Error */}
      {searchError&&<div style={{background:'rgba(255,94,94,0.1)',border:'1px solid rgba(255,94,94,0.3)',borderRadius:10,padding:'10px 14px',color:C.danger,fontSize:13,marginBottom:12}}>{searchError}</div>}

      {/* ── SEARCH RESULT VIEW ── */}
      {activeView==='search'&&(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <h3 style={{color:C.text,fontSize:15,fontWeight:700}}>Search Analysis</h3>
            <button onClick={()=>{setActiveView('market');setSearchResult(null);setSearchQuery('')}} style={{background:C.accentSoft,border:'none',borderRadius:8,padding:'5px 12px',color:C.accent,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>← Market View</button>
          </div>

          {searching&&(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 20px',gap:14}}>
              <Spin size={36} color={C.accent}/>
              <p style={{color:C.textSec,fontSize:13,textAlign:'center'}}>Running deep AI analysis on {searchQuery.toUpperCase()}...<br/><span style={{fontSize:11,color:C.textMuted}}>Analyzing technicals, fundamentals & market sentiment</span></p>
            </div>
          )}

          {searchResult&&!searching&&<SearchResultCard result={searchResult} signalColor={signalColor} sentimentColor={sentimentColor}/>}
        </div>
      )}

      {/* ── MARKET VIEW ── */}
      {activeView==='market'&&(
        <>
          {/* Header card */}
          <div style={{background:'linear-gradient(135deg,rgba(82,201,134,.15),rgba(69,183,209,.08))',border:'1px solid rgba(82,201,134,.3)',borderRadius:16,padding:14,marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div>
                <div style={{color:C.success,fontSize:13,fontWeight:700,marginBottom:2}}>📈 AI Market Intelligence</div>
                <div style={{color:C.textMuted,fontSize:11}}>{lastRun?`Updated: ${fmtTime(lastRun)}`:'Not yet analyzed'}</div>
              </div>
              {analysis&&<div style={{textAlign:'right'}}>
                <div style={{color:sentimentColor(analysis.marketSentiment),fontSize:14,fontWeight:700}}>{analysis.marketSentiment}</div>
                <div style={{color:C.textMuted,fontSize:10}}>Market Sentiment</div>
              </div>}
            </div>
            {analysis&&<>
              <div style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{color:C.textMuted,fontSize:10}}>Sentiment Score</span>
                  <span style={{color:sentimentColor(analysis.marketSentiment),fontSize:10,fontWeight:700}}>{analysis.sentimentScore}/100</span>
                </div>
                <div style={{background:'rgba(255,255,255,0.1)',borderRadius:3,height:5,overflow:'hidden'}}>
                  <div style={{background:sentimentColor(analysis.marketSentiment),height:'100%',width:`${analysis.sentimentScore}%`,borderRadius:3}}/>
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
            {!apiKey&&<p style={{color:C.warning,fontSize:11,marginTop:8,textAlign:'center'}}>⚠️ Add Anthropic API key in ⚙️ Settings</p>}
          </div>

          {/* Notification permission */}
          {notifPerm!=='granted'&&notifPerm!=='unsupported'&&(
            <div style={{background:'rgba(255,159,67,0.1)',border:'1px solid rgba(255,159,67,0.3)',borderRadius:12,padding:10,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{color:C.warning,fontSize:12}}>🔔 Enable market alert notifications</span>
              <button onClick={requestNotif} style={{background:C.warning,border:'none',borderRadius:8,padding:'5px 10px',color:'#fff',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Enable</button>
            </div>
          )}

          {loading&&<div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'32px 20px',gap:12}}><Spin size={32} color={C.success}/><p style={{color:C.textSec,fontSize:13}}>Analyzing markets, news & political trades...</p></div>}

          {analysis&&!loading&&(
            <>
              {/* Tabs */}
              <div style={{display:'flex',background:C.card,borderRadius:12,marginBottom:12,overflow:'hidden'}}>
                {[['picks','🎯 Picks'],['political','🏛️ Political'],['news','📰 News'],['sectors','📊 Sectors']].map(([k,l])=>(
                  <button key={k} onClick={()=>setTab(k)} style={{flex:1,border:'none',background:tab===k?C.accentSoft:'transparent',color:tab===k?C.accent:C.textMuted,padding:'10px 2px',fontSize:10,fontWeight:tab===k?700:400,cursor:'pointer',fontFamily:'Inter,sans-serif'}}>{l}</button>
                ))}
              </div>

              {tab==='picks'&&(
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <h3 style={{color:C.text,fontSize:14,fontWeight:700}}>Today's Top Picks</h3>
                    <span style={{color:C.textMuted,fontSize:10}}>AI probability analysis</span>
                  </div>
                  {analysis.topPicks?.map((pick,i)=><StockPickCard key={i} pick={pick} signalColor={signalColor} onSearch={(t)=>{setSearchQuery(t);runSearch(t)}}/>)}
                  {analysis.keyLevels&&(
                    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginTop:4}}>
                      <h4 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>📐 Key Market Levels</h4>
                      {[['S&P 500',analysis.keyLevels.sp500],['NASDAQ',analysis.keyLevels.nasdaq]].map(([name,data])=>data&&(
                        <div key={name} style={{marginBottom:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{color:C.textSec,fontSize:12,fontWeight:600}}>{name}</span>
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

              {tab==='political'&&(
                <div>
                  <div style={{background:'rgba(108,99,255,0.08)',border:'1px solid rgba(108,99,255,0.2)',borderRadius:12,padding:10,marginBottom:12}}>
                    <p style={{color:C.textSec,fontSize:12,lineHeight:1.5}}>🏛️ <strong style={{color:C.text}}>STOCK Act</strong> — Politicians must report trades within 45 days. These often signal upcoming legislation.</p>
                  </div>
                  {analysis.politicalTrades?.map((trade,i)=><PoliticalTradeCard key={i} trade={trade} onSearch={(t)=>{setSearchQuery(t);runSearch(t)}}/>)}
                </div>
              )}

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
                      <div key={i} style={{display:'flex',gap:10,marginBottom:7}}>
                        <span style={{color:C.danger}}>•</span>
                        <p style={{color:C.textSec,fontSize:12,lineHeight:1.5}}>{risk}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab==='sectors'&&(
                <div>
                  <h3 style={{color:C.text,fontSize:14,fontWeight:700,marginBottom:10}}>Sector Outlook</h3>
                  {analysis.sectorOutlook?.map((sector,i)=>(
                    <div key={i} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:12,marginBottom:8,display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:7,height:38,borderRadius:4,background:sector.signal==='Bullish'?C.success:sector.signal==='Bearish'?C.danger:C.warning,flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                          <span style={{color:C.text,fontSize:13,fontWeight:600}}>{sector.sector}</span>
                          <span style={{background:(sector.signal==='Bullish'?C.success:sector.signal==='Bearish'?C.danger:C.warning)+'20',color:sector.signal==='Bullish'?C.success:sector.signal==='Bearish'?C.danger:C.warning,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:6}}>
                            {sector.signal==='Bullish'?'↑':sector.signal==='Bearish'?'↓':'→'} {sector.signal}
                          </span>
                        </div>
                        <p style={{color:C.textSec,fontSize:11,lineHeight:1.4}}>{sector.reason}</p>
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
              <h3 style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:6}}>Ready to Analyze</h3>
              <p style={{color:C.textSec,fontSize:13}}>{apiKey?'Tap Pre-Mkt, 11 AM, or 2 PM to run AI market analysis.':'Add your Anthropic API key in ⚙️ Settings to get started.'}</p>
            </div>
          )}
        </>
      )}

      <div style={{background:C.surface,borderRadius:10,padding:10,marginTop:12}}>
        <p style={{color:C.textMuted,fontSize:10,lineHeight:1.5,textAlign:'center'}}>⚠️ AI analysis for informational purposes only. Not financial advice. Always do your own research.</p>
      </div>
    </div>
  )
}

// ── Search Result Card ────────────────────────────────────────────────────────
function SearchResultCard({ result, signalColor, sentimentColor }) {
  const isUp = result.expectedMove?.startsWith('+')
  const isCrypto = result.type === 'Crypto'

  return (
    <div>
      {/* Header */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <div style={{width:52,height:52,borderRadius:14,background:signalColor(result.signal)+'20',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <div style={{textAlign:'center'}}>
              <div style={{color:signalColor(result.signal),fontSize:14,fontWeight:800}}>{result.ticker}</div>
              <div style={{color:isCrypto?'#FFB347':'#45B7D1',fontSize:9,fontWeight:600}}>{isCrypto?'CRYPTO':'STOCK'}</div>
            </div>
          </div>
          <div style={{flex:1}}>
            <div style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:2}}>{result.name}</div>
            <div style={{color:C.textMuted,fontSize:11}}>{result.sector}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{background:signalColor(result.signal)+'20',color:signalColor(result.signal),fontSize:12,fontWeight:800,padding:'4px 10px',borderRadius:10,marginBottom:4}}>{result.signal}</div>
            <div style={{color:isUp?C.success:C.danger,fontSize:16,fontWeight:800}}>{result.expectedMove}</div>
          </div>
        </div>

        {/* Price targets */}
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <div style={{flex:1,background:C.surface,borderRadius:10,padding:'8px 10px',textAlign:'center'}}>
            <div style={{color:C.text,fontSize:13,fontWeight:700}}>${result.currentPrice?.toLocaleString()}</div>
            <div style={{color:C.textMuted,fontSize:10}}>Current</div>
          </div>
          <div style={{flex:1,background:isUp?'rgba(82,201,134,0.1)':'rgba(255,94,94,0.1)',borderRadius:10,padding:'8px 10px',textAlign:'center'}}>
            <div style={{color:isUp?C.success:C.danger,fontSize:13,fontWeight:700}}>${result.targetPrice?.toLocaleString()}</div>
            <div style={{color:C.textMuted,fontSize:10}}>Target ({result.targetTimeframe})</div>
          </div>
          <div style={{flex:1,background:C.surface,borderRadius:10,padding:'8px 10px',textAlign:'center'}}>
            <div style={{color:result.risk==='Low'?C.success:result.risk==='High'||result.risk==='Very High'?C.danger:C.warning,fontSize:13,fontWeight:700}}>{result.risk}</div>
            <div style={{color:C.textMuted,fontSize:10}}>Risk</div>
          </div>
        </div>

        {/* Probability */}
        <div style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:C.textMuted,fontSize:11}}>Probability of upward move</span>
            <span style={{color:result.probabilityUp>=65?C.success:result.probabilityUp>=50?C.warning:C.danger,fontSize:12,fontWeight:700}}>{result.probabilityUp}%</span>
          </div>
          <div style={{background:C.surface,borderRadius:3,height:7,overflow:'hidden'}}>
            <div style={{background:result.probabilityUp>=65?C.success:result.probabilityUp>=50?C.warning:C.danger,height:'100%',width:`${result.probabilityUp}%`,borderRadius:3,transition:'width 1s'}}/>
          </div>
        </div>

        {/* Overall score */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{color:C.textMuted,fontSize:11}}>Overall AI Score</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{background:C.surface,borderRadius:3,height:6,width:80,overflow:'hidden'}}>
              <div style={{background:result.overallScore>=70?C.success:result.overallScore>=50?C.warning:C.danger,height:'100%',width:`${result.overallScore}%`,borderRadius:3}}/>
            </div>
            <span style={{color:result.overallScore>=70?C.success:result.overallScore>=50?C.warning:C.danger,fontSize:12,fontWeight:700}}>{result.overallScore}/100</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:10}}>
        <div style={{color:C.accent,fontSize:12,fontWeight:600,marginBottom:6}}>📊 AI Analysis</div>
        <p style={{color:C.text,fontSize:13,lineHeight:1.7}}>{result.summary}</p>
        {result.verdict&&<div style={{marginTop:10,padding:'8px 12px',background:C.accentSoft,borderRadius:10,color:C.accent,fontSize:12,fontWeight:600,fontStyle:'italic'}}>💡 {result.verdict}</div>}
      </div>

      {/* Technicals */}
      {result.technicals&&(
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:10}}>
          <div style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>📈 Technical Analysis</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
            {[
              ['Trend',result.technicals.trend,result.technicals.trend==='Uptrend'?C.success:result.technicals.trend==='Downtrend'?C.danger:C.warning],
              ['RSI',result.technicals.rsi,result.technicals.rsi>70?C.danger:result.technicals.rsi<30?C.success:C.warning],
              ['MA 50',result.technicals.movingAvg50,result.technicals.movingAvg50==='above'?C.success:C.danger],
              ['MA 200',result.technicals.movingAvg200,result.technicals.movingAvg200==='above'?C.success:C.danger],
              ['Volume',result.technicals.volume,C.textSec],
            ].map(([label,val,color])=>(
              <div key={label} style={{background:C.surface,borderRadius:9,padding:'8px 10px'}}>
                <div style={{color:C.textMuted,fontSize:10,marginBottom:2}}>{label}</div>
                <div style={{color:color,fontSize:12,fontWeight:700}}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <div style={{flex:1,background:'rgba(82,201,134,0.1)',borderRadius:8,padding:'6px 10px',textAlign:'center'}}>
              <div style={{color:C.success,fontSize:12,fontWeight:700}}>${result.technicals.support?.toLocaleString()}</div>
              <div style={{color:C.textMuted,fontSize:10}}>Support</div>
            </div>
            <div style={{flex:1,background:'rgba(255,94,94,0.1)',borderRadius:8,padding:'6px 10px',textAlign:'center'}}>
              <div style={{color:C.danger,fontSize:12,fontWeight:700}}>${result.technicals.resistance?.toLocaleString()}</div>
              <div style={{color:C.textMuted,fontSize:10}}>Resistance</div>
            </div>
          </div>
        </div>
      )}

      {/* Fundamentals */}
      {result.fundamentals&&(
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:10}}>
          <div style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>{isCrypto?'🔗 On-Chain Metrics':'💰 Fundamentals'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {Object.entries(result.fundamentals).map(([key,val])=>(
              <div key={key} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.textMuted,fontSize:12}}>{key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}</span>
                <span style={{color:C.text,fontSize:12,fontWeight:600}}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crypto network metrics */}
      {isCrypto&&result.networkMetrics&&(
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:10}}>
          <div style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:10}}>⛓️ Network Metrics</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {Object.entries(result.networkMetrics).map(([key,val])=>(
              <div key={key} style={{background:C.surface,borderRadius:9,padding:'8px 10px'}}>
                <div style={{color:C.textMuted,fontSize:10,marginBottom:2}}>{key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}</div>
                <div style={{color:C.text,fontSize:12,fontWeight:600}}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalysts & Risks */}
      <div style={{display:'flex',gap:10,marginBottom:10}}>
        <div style={{flex:1,background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:12}}>
          <div style={{color:C.success,fontSize:12,fontWeight:700,marginBottom:8}}>🚀 Catalysts</div>
          {result.catalysts?.map((c,i)=><div key={i} style={{color:C.text,fontSize:11,marginBottom:5,display:'flex',gap:5}}><span style={{color:C.success}}>✓</span>{c}</div>)}
        </div>
        <div style={{flex:1,background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:12}}>
          <div style={{color:C.danger,fontSize:12,fontWeight:700,marginBottom:8}}>⚠️ Risks</div>
          {result.risks?.map((r,i)=><div key={i} style={{color:C.text,fontSize:11,marginBottom:5,display:'flex',gap:5}}><span style={{color:C.danger}}>•</span>{r}</div>)}
        </div>
      </div>
    </div>
  )
}

// ── Stock Pick Card ───────────────────────────────────────────────────────────
function StockPickCard({ pick, signalColor, onSearch }) {
  const [expanded, setExpanded] = useState(false)
  const isUp = pick.expectedMove?.startsWith('+')
  return (
    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:12,marginBottom:8}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
        <div style={{background:signalColor(pick.signal)+'20',borderRadius:9,padding:'6px 8px',minWidth:46,textAlign:'center',flexShrink:0}}>
          <div style={{color:signalColor(pick.signal),fontSize:12,fontWeight:800}}>{pick.ticker}</div>
          <div style={{color:signalColor(pick.signal),fontSize:8,fontWeight:700}}>{pick.signal}</div>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:C.text,fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pick.company}</div>
          <div style={{color:C.textMuted,fontSize:10,marginTop:1}}>{pick.sector}</div>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{color:isUp?C.success:C.danger,fontSize:15,fontWeight:800}}>{pick.expectedMove}</div>
          <button onClick={e=>{e.stopPropagation();onSearch(pick.ticker)}} style={{background:C.accentSoft,border:'none',borderRadius:6,padding:'2px 7px',color:C.accent,fontSize:9,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:2}}>Deep Analysis →</button>
        </div>
      </div>
      <div onClick={()=>setExpanded(!expanded)} style={{cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
          <span style={{color:C.textMuted,fontSize:10}}>Probability up</span>
          <span style={{color:pick.probabilityUp>=65?C.success:pick.probabilityUp>=50?C.warning:C.danger,fontSize:10,fontWeight:700}}>{pick.probabilityUp}%</span>
        </div>
        <div style={{background:C.surface,borderRadius:3,height:5,overflow:'hidden',marginBottom:expanded?8:0}}>
          <div style={{background:pick.probabilityUp>=65?C.success:pick.probabilityUp>=50?C.warning:C.danger,height:'100%',width:`${pick.probabilityUp}%`,borderRadius:3}}/>
        </div>
        {expanded&&(
          <div style={{paddingTop:8,borderTop:`1px solid ${C.border}`}}>
            {pick.currentPrice&&(
              <div style={{display:'flex',gap:8,marginBottom:7}}>
                <div style={{flex:1,background:C.surface,borderRadius:7,padding:'5px 8px',textAlign:'center'}}>
                  <div style={{color:C.text,fontSize:11,fontWeight:700}}>${pick.currentPrice}</div>
                  <div style={{color:C.textMuted,fontSize:9}}>Current</div>
                </div>
                <div style={{flex:1,background:isUp?'rgba(82,201,134,0.1)':'rgba(255,94,94,0.1)',borderRadius:7,padding:'5px 8px',textAlign:'center'}}>
                  <div style={{color:isUp?C.success:C.danger,fontSize:11,fontWeight:700}}>${pick.targetPrice}</div>
                  <div style={{color:C.textMuted,fontSize:9}}>Target</div>
                </div>
                <div style={{flex:1,background:C.surface,borderRadius:7,padding:'5px 8px',textAlign:'center'}}>
                  <div style={{color:pick.risk==='Low'?C.success:pick.risk==='High'?C.danger:C.warning,fontSize:11,fontWeight:700}}>{pick.risk}</div>
                  <div style={{color:C.textMuted,fontSize:9}}>Risk</div>
                </div>
              </div>
            )}
            {pick.catalysts?.length>0&&<div style={{marginBottom:6}}>{pick.catalysts.map((c,i)=><div key={i} style={{color:C.text,fontSize:11,marginBottom:3}}>✓ {c}</div>)}</div>}
            {pick.reasoning&&<p style={{color:C.textSec,fontSize:11,lineHeight:1.5,fontStyle:'italic'}}>{pick.reasoning}</p>}
          </div>
        )}
        <div style={{textAlign:'center',marginTop:4}}>
          <span style={{color:C.textMuted,fontSize:9}}>{expanded?'▲ Less':'▼ More'}</span>
        </div>
      </div>
    </div>
  )
}

// ── Political Trade Card ──────────────────────────────────────────────────────
function PoliticalTradeCard({ trade, onSearch }) {
  return (
    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:14,padding:12,marginBottom:8}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:7}}>
        <div style={{width:34,height:34,borderRadius:'50%',background:trade.party==='R'?'rgba(255,94,94,0.2)':'rgba(69,183,209,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>
          {trade.party==='R'?'🔴':'🔵'}
        </div>
        <div style={{flex:1}}>
          <div style={{color:C.text,fontSize:12,fontWeight:600}}>{trade.politician}</div>
          <div style={{color:C.textMuted,fontSize:10}}>{trade.date}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{background:trade.action==='BUY'?'rgba(82,201,134,0.15)':'rgba(255,94,94,0.15)',color:trade.action==='BUY'?C.success:C.danger,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:7}}>{trade.action} {trade.ticker}</div>
          <div style={{color:C.textMuted,fontSize:9,marginTop:2}}>{trade.amount}</div>
          <button onClick={()=>onSearch(trade.ticker)} style={{background:C.accentSoft,border:'none',borderRadius:5,padding:'2px 7px',color:C.accent,fontSize:9,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif',marginTop:3}}>Analyze →</button>
        </div>
      </div>
      <p style={{color:C.textSec,fontSize:11,lineHeight:1.5}}>💡 {trade.significance}</p>
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_DATA = {
  marketSentiment:'Bullish', sentimentScore:72,
  marketSummary:'Markets showing bullish momentum as Fed signals rate cuts. Tech sector leading gains. Political buy activity in AI and defense stocks.',
  topPicks:[
    {ticker:'NVDA',company:'NVIDIA Corp',sector:'Technology',currentPrice:875.50,targetPrice:920.00,probabilityUp:82,expectedMove:'+5.1%',timeframe:'Today',signal:'BUY',catalysts:['AI chip demand surge','Data center expansion'],risk:'Medium',reasoning:'Strong momentum on AI infrastructure buildout.'},
    {ticker:'MSFT',company:'Microsoft Corp',sector:'Technology',currentPrice:415.20,targetPrice:428.00,probabilityUp:74,expectedMove:'+3.1%',timeframe:'Today',signal:'BUY',catalysts:['Azure AI revenue growth','Copilot adoption'],risk:'Low',reasoning:'Consistent outperformer with political tailwinds.'},
    {ticker:'JPM',company:'JPMorgan Chase',sector:'Financials',currentPrice:198.40,targetPrice:185.00,probabilityUp:32,expectedMove:'-6.8%',timeframe:'Today',signal:'SELL',catalysts:['Rising credit defaults'],risk:'High',reasoning:'Financials under pressure from yield curve.'},
  ],
  politicalTrades:[
    {politician:'Nancy Pelosi',party:'D',ticker:'NVDA',action:'BUY',amount:'$500K-$1M',date:'Jun 28, 2026',significance:'Third consecutive NVDA purchase. AI regulation likely favorable.'},
    {politician:'Dan Crenshaw',party:'R',ticker:'LMT',action:'BUY',amount:'$50K-$100K',date:'Jun 25, 2026',significance:'Defense committee member buying Lockheed ahead of budget vote.'},
  ],
  sectorOutlook:[
    {sector:'Technology',signal:'Bullish',reason:'AI infrastructure spend accelerating.'},
    {sector:'Energy',signal:'Bullish',reason:'Geopolitical tensions supporting oil prices.'},
    {sector:'Healthcare',signal:'Neutral',reason:'Drug pricing legislation uncertainty.'},
    {sector:'Financials',signal:'Bearish',reason:'Credit quality concerns rising.'},
  ],
  keyLevels:{sp500:{support:5180,resistance:5320,trend:'Uptrend'},nasdaq:{support:18400,resistance:19200,trend:'Uptrend'}},
  newsDrivers:['Fed minutes signal two rate cuts in 2026','NVIDIA beating estimates by 23%','US-China trade tensions easing'],
  riskFactors:['Geopolitical escalation could spike oil','Inflation re-acceleration risk'],
  timeSlot:'morning', generatedAt:new Date().toISOString(),
}
