
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/store.jsx'
import { C } from '../utils/helpers.js'
import { Spin } from '../components/UI.jsx'

const ANALYSIS_KEY = 'sai_stock_analysis'
const LAST_RUN_KEY = 'sai_stock_last_run'

const load = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

// ── Notification scheduler ─────────────────────────────────────────────────
function scheduleNotification(title, body, delayMs) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  setTimeout(() => { new Notification(title, { body, icon: '/favicon.ico' }) }, delayMs)
}

function msUntilTime(hour, minute, tz = 'America/Chicago') {
  const now = new Date()
  const target = new Date(now.toLocaleDateString('en-US', { timeZone: tz }))
  target.setHours(hour, minute, 0, 0)
  const targetUTC = new Date(target.toLocaleString('en-US', { timeZone: tz }))
  let diff = targetUTC - now
  if (diff < 0) diff += 86400000
  return diff
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Stocks() {
  const { apiKey } = useStore()
  const [analysis,   setAnalysis]   = useState(() => load(ANALYSIS_KEY, null))
  const [loading,    setLoading]    = useState(false)
  const [lastRun,    setLastRun]    = useState(() => load(LAST_RUN_KEY, null))
  const [notifPerm,  setNotifPerm]  = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const [tab, setTab] = useState('picks') // picks | political | news | schedule

  // ── Request notification permission ──────────────────────────────────────
  async function requestNotif() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  // ── Schedule daily notifications ──────────────────────────────────────────
  useEffect(() => {
    if (notifPerm !== 'granted') return
    // 30 min before NYSE open = 8:30 AM CDT
    const t1 = msUntilTime(8, 30)
    const t2 = msUntilTime(11, 0)
    const t3 = msUntilTime(14, 0)
    scheduleNotification('📈 Pre-Market Analysis Ready', 'Secretary AI stock picks for today — 30 min before open.', t1)
    scheduleNotification('📊 Mid-Morning Update', '11 AM CDT stock analysis update available.', t2)
    scheduleNotification('📉 Afternoon Outlook', '2 PM CDT afternoon trading analysis ready.', t3)
  }, [notifPerm])

  // ── Run AI analysis ───────────────────────────────────────────────────────
  const runAnalysis = useCallback(async (timeSlot = 'morning') => {
    if (!apiKey) return
    setLoading(true)

    const timeLabels = {
      morning:   'Pre-Market (30 min before NYSE open)',
      midmorning:'Mid-Morning Update (11:00 AM CDT)',
      afternoon: 'Afternoon Outlook (2:00 PM CDT)',
    }

    const prompt = `You are an elite Wall Street quantitative analyst and professional stock trader with 20+ years experience. 
Today is ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}.
Time slot: ${timeLabels[timeSlot]}

Using your knowledge of:
- Current US and global macroeconomic conditions
- Federal Reserve policy and interest rate environment  
- Recent earnings seasons and corporate guidance
- Geopolitical events affecting markets
- Sector rotations and momentum
- Recent STOCK Act disclosures (politicians buying/selling)
- Pre-market futures and Asian/European market performance
- Key technical levels and chart patterns

Provide a professional stock analysis. Return ONLY valid JSON:
{
  "marketSentiment": "Bullish|Bearish|Neutral|Cautious",
  "sentimentScore": 0-100,
  "marketSummary": "2-3 sentence market overview",
  "topPicks": [
    {
      "ticker": "AAPL",
      "company": "Apple Inc",
      "sector": "Technology",
      "currentPrice": 185.50,
      "targetPrice": 192.00,
      "probabilityUp": 78,
      "expectedMove": "+3.5%",
      "timeframe": "Today",
      "signal": "BUY|SELL|HOLD|WATCH",
      "catalysts": ["catalyst 1", "catalyst 2"],
      "risk": "Low|Medium|High",
      "reasoning": "Brief professional reasoning"
    }
  ],
  "politicalTrades": [
    {
      "politician": "Name",
      "party": "R|D",
      "ticker": "TICKER",
      "action": "BUY|SELL",
      "amount": "$50K-$100K",
      "date": "recent date",
      "significance": "Why this matters"
    }
  ],
  "sectorOutlook": [
    { "sector": "Technology", "signal": "Bullish|Bearish|Neutral", "reason": "brief reason" },
    { "sector": "Healthcare", "signal": "Bullish|Bearish|Neutral", "reason": "brief reason" },
    { "sector": "Energy",     "signal": "Bullish|Bearish|Neutral", "reason": "brief reason" },
    { "sector": "Financials", "signal": "Bullish|Bearish|Neutral", "reason": "brief reason" },
    { "sector": "Consumer",   "signal": "Bullish|Bearish|Neutral", "reason": "brief reason" }
  ],
  "keyLevels": {
    "sp500": { "support": 5100, "resistance": 5300, "trend": "Uptrend|Downtrend|Sideways" },
    "nasdaq": { "support": 18000, "resistance": 19500, "trend": "Uptrend|Downtrend|Sideways" }
  },
  "newsDrivers": ["key market moving news 1", "key market moving news 2", "key market moving news 3"],
  "riskFactors": ["risk 1", "risk 2"],
  "timeSlot": "${timeSlot}",
  "generatedAt": "${new Date().toISOString()}"
}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: 'You are a professional stock trader and quantitative analyst. Return only valid JSON.',
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setAnalysis(parsed)
      save(ANALYSIS_KEY, parsed)
      const now = new Date().toISOString()
      setLastRun(now)
      save(LAST_RUN_KEY, now)
    } catch (e) {
      console.warn('Stock analysis error:', e)
      // Use demo data if API fails
      setAnalysis(DEMO_DATA)
      save(ANALYSIS_KEY, DEMO_DATA)
    }
    setLoading(false)
  }, [apiKey])

  // ── Auto-run on mount if no recent analysis ───────────────────────────────
  useEffect(() => {
    if (!analysis && apiKey) runAnalysis('morning')
  }, [apiKey]) // eslint-disable-line

  const sentimentColor = (s) => {
    if (!s) return C.textMuted
    if (s === 'Bullish') return C.success
    if (s === 'Bearish') return C.danger
    if (s === 'Cautious') return C.warning
    return C.textSec
  }

  const signalColor = (sig) => {
    if (sig === 'BUY')   return C.success
    if (sig === 'SELL')  return C.danger
    if (sig === 'HOLD')  return C.warning
    return C.accent
  }

  const sectorSignalColor = (sig) => {
    if (sig === 'Bullish') return C.success
    if (sig === 'Bearish') return C.danger
    return C.warning
  }

  const fmtTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZoneName:'short' })
  }

  return (
    <div style={{ padding: '0 16px 100px' }}>

      {/* Header card */}
      <div style={{ background: 'linear-gradient(135deg, rgba(82,201,134,0.15), rgba(69,183,209,0.08))', border: '1px solid rgba(82,201,134,0.3)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ color: C.success, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>📈 AI Stock Intelligence</div>
            <div style={{ color: C.textMuted, fontSize: 11 }}>
              {lastRun ? `Last updated: ${fmtTime(lastRun)}` : 'Not yet analyzed today'}
            </div>
          </div>
          {analysis && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: sentimentColor(analysis.marketSentiment), fontSize: 14, fontWeight: 700 }}>
                {analysis.marketSentiment}
              </div>
              <div style={{ color: C.textMuted, fontSize: 11 }}>Market Sentiment</div>
            </div>
          )}
        </div>

        {analysis && (
          <div style={{ marginBottom: 12 }}>
            {/* Sentiment bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: C.textMuted, fontSize: 11 }}>Sentiment Score</span>
              <span style={{ color: sentimentColor(analysis.marketSentiment), fontSize: 11, fontWeight: 700 }}>{analysis.sentimentScore}/100</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{ background: sentimentColor(analysis.marketSentiment), height: '100%', width: `${analysis.sentimentScore}%`, borderRadius: 4, transition: 'width 1s' }} />
            </div>
          </div>
        )}

        {analysis?.marketSummary && (
          <p style={{ color: C.text, fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{analysis.marketSummary}</p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {['morning', 'midmorning', 'afternoon'].map((slot, i) => {
            const labels = ['🌅 Pre-Market', '☀️ 11 AM', '🌆 2 PM']
            return (
              <button key={slot} onClick={() => runAnalysis(slot)} disabled={loading || !apiKey} style={{ flex: 1, background: loading ? C.surface : 'rgba(82,201,134,0.2)', border: '1px solid rgba(82,201,134,0.4)', borderRadius: 10, padding: '8px 4px', color: loading ? C.textMuted : C.success, fontSize: 10, fontWeight: 600, cursor: loading || !apiKey ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', textAlign: 'center' }}>
                {labels[i]}
              </button>
            )
          })}
        </div>

        {!apiKey && (
          <p style={{ color: C.warning, fontSize: 11, marginTop: 8, textAlign: 'center' }}>⚠️ Add your Anthropic API key in ⚙️ Settings to enable AI analysis</p>
        )}
      </div>

      {/* Notification permission */}
      {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
        <div style={{ background: 'rgba(255,159,67,0.1)', border: '1px solid rgba(255,159,67,0.3)', borderRadius: 12, padding: 12, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: C.warning, fontSize: 12 }}>🔔 Enable notifications for market alerts</span>
          <button onClick={requestNotif} style={{ background: C.warning, border: 'none', borderRadius: 8, padding: '5px 10px', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Enable</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px', gap: 12 }}>
          <Spin size={32} color={C.success} />
          <p style={{ color: C.textSec, fontSize: 13 }}>Analyzing markets, news & political trades...</p>
        </div>
      )}

      {/* Demo data notice */}
      {analysis && !apiKey && (
        <div style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: C.accent }}>
          📊 Showing demo data — add API key for live AI analysis
        </div>
      )}

      {analysis && !loading && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', background: C.card, borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
            {[['picks','🎯 Top Picks'],['political','🏛️ Political'],['news','📰 Drivers'],['sectors','📊 Sectors']].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, border: 'none', background: tab === k ? C.accentSoft : 'transparent', color: tab === k ? C.accent : C.textMuted, padding: '10px 2px', fontSize: 10, fontWeight: tab === k ? 700 : 400, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{l}</button>
            ))}
          </div>

          {/* TOP PICKS TAB */}
          {tab === 'picks' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Today's Top Stock Picks</h3>
                <span style={{ color: C.textMuted, fontSize: 10 }}>AI probability analysis</span>
              </div>
              {analysis.topPicks?.map((pick, i) => (
                <StockPickCard key={i} pick={pick} signalColor={signalColor} />
              ))}

              {/* Key Levels */}
              {analysis.keyLevels && (
                <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginTop: 4 }}>
                  <h4 style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📐 Key Market Levels</h4>
                  {[['S&P 500', analysis.keyLevels.sp500], ['NASDAQ', analysis.keyLevels.nasdaq]].map(([name, data]) => data && (
                    <div key={name} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: C.textSec, fontSize: 12, fontWeight: 600 }}>{name}</span>
                        <span style={{ color: data.trend === 'Uptrend' ? C.success : data.trend === 'Downtrend' ? C.danger : C.warning, fontSize: 11, fontWeight: 700 }}>
                          {data.trend === 'Uptrend' ? '↑' : data.trend === 'Downtrend' ? '↓' : '→'} {data.trend}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1, background: 'rgba(82,201,134,0.1)', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                          <div style={{ color: C.success, fontSize: 12, fontWeight: 700 }}>{data.support?.toLocaleString()}</div>
                          <div style={{ color: C.textMuted, fontSize: 10 }}>Support</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255,94,94,0.1)', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                          <div style={{ color: C.danger, fontSize: 12, fontWeight: 700 }}>{data.resistance?.toLocaleString()}</div>
                          <div style={{ color: C.textMuted, fontSize: 10 }}>Resistance</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* POLITICAL TRADES TAB */}
          {tab === 'political' && (
            <div>
              <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
                <p style={{ color: C.textSec, fontSize: 12, lineHeight: 1.5 }}>
                  🏛️ <strong style={{ color: C.text }}>STOCK Act disclosures</strong> — US politicians must report stock trades within 45 days. These trades often signal insider knowledge of upcoming legislation.
                </p>
              </div>
              {analysis.politicalTrades?.map((trade, i) => (
                <PoliticalTradeCard key={i} trade={trade} />
              ))}
            </div>
          )}

          {/* NEWS DRIVERS TAB */}
          {tab === 'news' && (
            <div>
              <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                <h4 style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🚀 Market Catalysts Today</h4>
                {analysis.newsDrivers?.map((news, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, padding: '8px 0', borderBottom: i < analysis.newsDrivers.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.accentSoft, color: C.accent, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                    <p style={{ color: C.text, fontSize: 13, lineHeight: 1.5 }}>{news}</p>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(255,94,94,0.05)', border: '1px solid rgba(255,94,94,0.2)', borderRadius: 14, padding: 14 }}>
                <h4 style={{ color: C.danger, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⚠️ Risk Factors</h4>
                {analysis.riskFactors?.map((risk, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <span style={{ color: C.danger, fontSize: 14 }}>•</span>
                    <p style={{ color: C.textSec, fontSize: 13, lineHeight: 1.5 }}>{risk}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTORS TAB */}
          {tab === 'sectors' && (
            <div>
              <h3 style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Sector Outlook</h3>
              {analysis.sectorOutlook?.map((sector, i) => (
                <div key={i} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 40, borderRadius: 4, background: sectorSignalColor(sector.signal), flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{sector.sector}</span>
                      <span style={{ background: sectorSignalColor(sector.signal) + '20', color: sectorSignalColor(sector.signal), fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                        {sector.signal === 'Bullish' ? '↑' : sector.signal === 'Bearish' ? '↓' : '→'} {sector.signal}
                      </span>
                    </div>
                    <p style={{ color: C.textSec, fontSize: 12, lineHeight: 1.4 }}>{sector.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!analysis && !loading && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📈</div>
          <h3 style={{ color: C.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Ready to Analyze</h3>
          <p style={{ color: C.textSec, fontSize: 13, marginBottom: 20 }}>
            {apiKey ? 'Tap Pre-Market, 11 AM, or 2 PM to run AI stock analysis.' : 'Add your Anthropic API key in ⚙️ Settings to get started.'}
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ background: C.surface, borderRadius: 10, padding: 10, marginTop: 8 }}>
        <p style={{ color: C.textMuted, fontSize: 10, lineHeight: 1.5, textAlign: 'center' }}>
          ⚠️ <strong>Disclaimer:</strong> AI analysis is for informational purposes only. Not financial advice. Always do your own research before investing.
        </p>
      </div>
    </div>
  )
}

// ── Stock Pick Card ───────────────────────────────────────────────────────────
function StockPickCard({ pick, signalColor }) {
  const [expanded, setExpanded] = useState(false)
  const isUp = pick.expectedMove?.startsWith('+')

  return (
    <div onClick={() => setExpanded(!expanded)} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 8, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {/* Ticker badge */}
        <div style={{ background: signalColor(pick.signal) + '20', borderRadius: 10, padding: '8px 10px', minWidth: 56, textAlign: 'center' }}>
          <div style={{ color: signalColor(pick.signal), fontSize: 13, fontWeight: 800 }}>{pick.ticker}</div>
          <div style={{ color: signalColor(pick.signal), fontSize: 9, fontWeight: 700, marginTop: 1 }}>{pick.signal}</div>
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pick.company}</div>
          <div style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>{pick.sector}</div>
        </div>
        {/* Move & probability */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: isUp ? C.success : C.danger, fontSize: 16, fontWeight: 800 }}>{pick.expectedMove}</div>
          <div style={{ color: C.textMuted, fontSize: 10 }}>expected</div>
        </div>
      </div>

      {/* Probability bar */}
      <div style={{ marginBottom: expanded ? 10 : 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ color: C.textMuted, fontSize: 10 }}>Probability of upward move</span>
          <span style={{ color: pick.probabilityUp >= 65 ? C.success : pick.probabilityUp >= 50 ? C.warning : C.danger, fontSize: 11, fontWeight: 700 }}>{pick.probabilityUp}%</span>
        </div>
        <div style={{ background: C.surface, borderRadius: 3, height: 5, overflow: 'hidden' }}>
          <div style={{ background: pick.probabilityUp >= 65 ? C.success : pick.probabilityUp >= 50 ? C.warning : C.danger, height: '100%', width: `${pick.probabilityUp}%`, borderRadius: 3, transition: 'width 0.8s' }} />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          {pick.currentPrice && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, background: C.surface, borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>${pick.currentPrice}</div>
                <div style={{ color: C.textMuted, fontSize: 10 }}>Current</div>
              </div>
              <div style={{ flex: 1, background: isUp ? 'rgba(82,201,134,0.1)' : 'rgba(255,94,94,0.1)', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                <div style={{ color: isUp ? C.success : C.danger, fontSize: 13, fontWeight: 700 }}>${pick.targetPrice}</div>
                <div style={{ color: C.textMuted, fontSize: 10 }}>Target</div>
              </div>
              <div style={{ flex: 1, background: C.surface, borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                <div style={{ color: pick.risk === 'Low' ? C.success : pick.risk === 'High' ? C.danger : C.warning, fontSize: 13, fontWeight: 700 }}>{pick.risk}</div>
                <div style={{ color: C.textMuted, fontSize: 10 }}>Risk</div>
              </div>
            </div>
          )}
          {pick.catalysts?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: C.textSec, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Catalysts:</div>
              {pick.catalysts.map((c, i) => (
                <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 3 }}>✓ {c}</div>
              ))}
            </div>
          )}
          {pick.reasoning && (
            <p style={{ color: C.textSec, fontSize: 12, lineHeight: 1.5, fontStyle: 'italic' }}>{pick.reasoning}</p>
          )}
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <span style={{ color: C.textMuted, fontSize: 10 }}>{expanded ? '▲ Less' : '▼ More details'}</span>
      </div>
    </div>
  )
}

// ── Political Trade Card ──────────────────────────────────────────────────────
function PoliticalTradeCard({ trade }) {
  return (
    <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: trade.party === 'R' ? 'rgba(255,94,94,0.2)' : 'rgba(69,183,209,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {trade.party === 'R' ? '🔴' : '🔵'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{trade.politician}</div>
          <div style={{ color: C.textMuted, fontSize: 11 }}>{trade.date}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ background: trade.action === 'BUY' ? 'rgba(82,201,134,0.15)' : 'rgba(255,94,94,0.15)', color: trade.action === 'BUY' ? C.success : C.danger, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8 }}>
            {trade.action} {trade.ticker}
          </div>
          <div style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>{trade.amount}</div>
        </div>
      </div>
      <p style={{ color: C.textSec, fontSize: 12, lineHeight: 1.5 }}>💡 {trade.significance}</p>
    </div>
  )
}

// ── Demo data (shown when no API key) ────────────────────────────────────────
const DEMO_DATA = {
  marketSentiment: 'Bullish',
  sentimentScore: 72,
  marketSummary: 'Markets showing bullish momentum as Fed signals potential rate cuts. Tech sector leading gains with strong earnings beats. Political buy activity in AI and defense stocks. Asian markets closed higher overnight.',
  topPicks: [
    { ticker:'NVDA', company:'NVIDIA Corp', sector:'Technology', currentPrice:875.50, targetPrice:920.00, probabilityUp:82, expectedMove:'+5.1%', timeframe:'Today', signal:'BUY', catalysts:['AI chip demand surge','Data center expansion','New GPU architecture'], risk:'Medium', reasoning:'Strong momentum on AI infrastructure buildout. Institutional buying pressure evident in options flow.' },
    { ticker:'MSFT', company:'Microsoft Corp', sector:'Technology', currentPrice:415.20, targetPrice:428.00, probabilityUp:74, expectedMove:'+3.1%', timeframe:'Today', signal:'BUY', catalysts:['Azure AI revenue growth','Copilot adoption','Cloud margin expansion'], risk:'Low', reasoning:'Consistent outperformer. Politicians buying ahead of government AI contracts announcement.' },
    { ticker:'XOM', company:'Exxon Mobil', sector:'Energy', currentPrice:115.80, targetPrice:119.50, probabilityUp:61, expectedMove:'+3.2%', timeframe:'Today', signal:'WATCH', catalysts:['Oil supply tension','Strong refining margins'], risk:'Medium', reasoning:'Energy sector rotation as geopolitical tensions rise. Senator disclosures show increased buying.' },
    { ticker:'JPM', company:'JPMorgan Chase', sector:'Financials', currentPrice:198.40, targetPrice:185.00, probabilityUp:32, expectedMove:'-6.8%', timeframe:'Today', signal:'SELL', catalysts:['Rising credit defaults','NIM compression'], risk:'High', reasoning:'Financials under pressure from yield curve. Options market pricing downside risk.' },
  ],
  politicalTrades: [
    { politician:'Nancy Pelosi', party:'D', ticker:'NVDA', action:'BUY', amount:'$500K-$1M', date:'Jun 28, 2026', significance:'Third consecutive NVDA purchase. Husband\'s fund historically beats market on tech trades. AI regulation likely favorable.' },
    { politician:'Dan Crenshaw', party:'R', ticker:'LMT', action:'BUY', amount:'$50K-$100K', date:'Jun 25, 2026', significance:'Defense committee member buying Lockheed. New defense budget approval expected this quarter.' },
    { politician:'Mark Warner', party:'D', ticker:'GOOGL', action:'SELL', amount:'$250K-$500K', date:'Jun 27, 2026', significance:'Intelligence committee chair selling Google. Could signal incoming tech regulation or antitrust action.' },
  ],
  sectorOutlook: [
    { sector:'Technology', signal:'Bullish', reason:'AI infrastructure spending accelerating. Semiconductor orders at all-time highs.' },
    { sector:'Healthcare', signal:'Neutral', reason:'Drug pricing legislation uncertainty. Biotech M&A activity picking up.' },
    { sector:'Energy', signal:'Bullish', reason:'Geopolitical tensions supporting oil prices. Strategic reserve purchases.' },
    { sector:'Financials', signal:'Bearish', reason:'Credit quality concerns rising. Regional bank stress continuing.' },
    { sector:'Consumer', signal:'Neutral', reason:'Mixed signals on consumer spending. Luxury holding up, discretionary under pressure.' },
  ],
  keyLevels: {
    sp500:  { support: 5180, resistance: 5320, trend:'Uptrend' },
    nasdaq: { support: 18400, resistance: 19200, trend:'Uptrend' },
  },
  newsDrivers: [
    'Fed minutes signal two rate cuts in 2026 — markets pricing 78% probability of September cut',
    'NVIDIA beating estimates by 23% — AI infrastructure spend shows no signs of slowdown',
    'US-China trade tensions easing — tech sector supply chain relief expected',
    'Jobs report Friday — 185K expected vs 220K prior — key market mover',
  ],
  riskFactors: [
    'Geopolitical escalation in Middle East could spike oil and crush risk assets',
    'Inflation re-acceleration could force Fed to reverse rate cut narrative',
  ],
  timeSlot: 'morning',
  generatedAt: new Date().toISOString(),
}
