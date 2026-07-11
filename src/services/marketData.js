// src/services/marketData.js
// Live market data — Yahoo Finance + Alpha Vantage

const AV_KEY  = 'BZ0DDVJ3AE2U7ST5'
const AV_BASE = 'https://www.alphavantage.co/query'

// ── CORS proxy with fallback ───────────────────────────────────────────────────
async function proxyFetch(url, timeout = 6000) {
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  ]
  for (const proxy of proxies) {
    try {
      const r = await fetch(proxy, { signal: AbortSignal.timeout(timeout) })
      if (!r.ok) continue
      const text = await r.text()
      const json = JSON.parse(text)
      // allorigins wraps in .contents; corsproxy returns directly
      return json.contents ? JSON.parse(json.contents) : json
    } catch { continue }
  }
  return null
}

// ── Yahoo Finance ─────────────────────────────────────────────────────────────
async function yahooQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}&fields=regularMarketPrice,regularMarketPreviousClose,regularMarketChangePercent,regularMarketVolume,marketCap,fiftyTwoWeekHigh,fiftyTwoWeekLow,longName,shortName`
  try {
    const data = await proxyFetch(url)
    return data?.quoteResponse?.result?.[0] || null
  } catch { return null }
}

// ── Alpha Vantage ─────────────────────────────────────────────────────────────
async function avFetch(params) {
  const url = `${AV_BASE}?${new URLSearchParams({ ...params, apikey: AV_KEY })}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    return await r.json()
  } catch { return null }
}

// ── Detect crypto ─────────────────────────────────────────────────────────────
const CRYPTO_LIST = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC',
  'LINK','LTC','BCH','SHIB','UNI','ATOM','ALGO','NEAR','SAND','MANA','AXS','FTM']

export function isCryptoTicker(ticker) {
  const t = ticker.toUpperCase().replace('-USD','').replace('USDT','')
  return CRYPTO_LIST.includes(t) ||
    ticker.toLowerCase().includes('usdt') ||
    ticker.toLowerCase().includes('-usd')
}

// ── Main: fetch all live data for a ticker ────────────────────────────────────
export async function fetchLiveData(ticker) {
  const sym      = ticker.toUpperCase()
  const isCrypto = isCryptoTicker(sym)
  const yahooSym = isCrypto && !sym.includes('-USD') ? `${sym}-USD` : sym
  const avSym    = isCrypto ? `${sym.replace('-USD','')}USD` : sym

  // Fetch Yahoo quote + Alpha Vantage RSI in parallel
  const [quoteRes, rsiRes, newsRes] = await Promise.allSettled([
    yahooQuote(yahooSym),
    avFetch({ function:'RSI', symbol:avSym, interval:'daily', time_period:14, series_type:'close' }),
    avFetch({ function:'NEWS_SENTIMENT', tickers:sym.replace('-USD',''), limit:5 }),
  ])

  const yahooData = quoteRes.status  === 'fulfilled' ? quoteRes.value  : null
  const rsiData   = rsiRes.status    === 'fulfilled' ? rsiRes.value    : null
  const newsData  = newsRes.status   === 'fulfilled' ? newsRes.value   : null

  // ── Extract price ───────────────────────────────────────────────────────────
  let currentPrice  = yahooData?.regularMarketPrice || null
  let prevClose     = yahooData?.regularMarketPreviousClose || null
  let changePercent = yahooData?.regularMarketChangePercent || null
  let volume        = yahooData?.regularMarketVolume || null
  let marketCap     = yahooData?.marketCap || null
  let high52        = yahooData?.fiftyTwoWeekHigh || null
  let low52         = yahooData?.fiftyTwoWeekLow  || null
  let name          = yahooData?.longName || yahooData?.shortName || sym

  // ── Extract RSI ─────────────────────────────────────────────────────────────
  let rsi = null
  if (rsiData?.['Technical Analysis: RSI']) {
    const dates = Object.keys(rsiData['Technical Analysis: RSI'])
    if (dates.length > 0) rsi = parseFloat(rsiData['Technical Analysis: RSI'][dates[0]]?.RSI)
  }

  // ── Extract news sentiment ───────────────────────────────────────────────────
  let newsSentiment = []
  if (newsData?.feed) {
    newsSentiment = newsData.feed.slice(0,5).map(item => ({
      headline:  item.title,
      source:    item.source,
      sentiment: item.overall_sentiment_label,
      score:     item.overall_sentiment_score,
    }))
  }

  const newsSentimentScore = newsSentiment.length > 0
    ? newsSentiment.reduce((a,b) => a + (b.score||0), 0) / newsSentiment.length
    : null

  return {
    ticker:           sym,
    name,
    isCrypto,
    currentPrice,
    prevClose,
    changePercent,
    change:           currentPrice && prevClose ? currentPrice - prevClose : null,
    volume,
    marketCap,
    high52,
    low52,
    rsi,
    macdSignal:       null,
    fundamentals:     {},
    newsSentiment,
    newsSentimentScore,
    fetchedAt:        new Date().toISOString(),
    hasLiveData:      !!currentPrice,
  }
}

// ── Format helpers ─────────────────────────────────────────────────────────────
export function formatPrice(price, isCrypto = false) {
  if (!price && price !== 0) return 'N/A'
  if (isCrypto && price < 1)   return `$${price.toFixed(6)}`
  if (isCrypto && price < 100) return `$${price.toFixed(4)}`
  return `$${price.toLocaleString('en-US',{ minimumFractionDigits:2, maximumFractionDigits:2 })}`
}

export function formatMarketCap(mc) {
  if (!mc) return 'N/A'
  if (mc >= 1e12) return `$${(mc/1e12).toFixed(2)}T`
  if (mc >= 1e9)  return `$${(mc/1e9).toFixed(2)}B`
  if (mc >= 1e6)  return `$${(mc/1e6).toFixed(2)}M`
  return `$${mc.toLocaleString()}`
}

export function formatVolume(vol) {
  if (!vol) return 'N/A'
  if (vol >= 1e9) return `${(vol/1e9).toFixed(2)}B`
  if (vol >= 1e6) return `${(vol/1e6).toFixed(2)}M`
  if (vol >= 1e3) return `${(vol/1e3).toFixed(0)}K`
  return vol.toString()
}
