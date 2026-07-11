// src/services/marketData.js
// Live market data from Yahoo Finance + Alpha Vantage

const AV_KEY = 'BZ0DDVJ3AE2U7ST5'
const AV_BASE = 'https://www.alphavantage.co/query'

// ── Yahoo Finance via public API proxy ────────────────────────────────────────
// Uses allorigins.win to bypass CORS on GitHub Pages
async function yahooFetch(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  try {
    const r = await fetch(proxy, { signal: AbortSignal.timeout(8000) })
    const data = await r.json()
    const parsed = JSON.parse(data.contents)
    return parsed?.chart?.result?.[0] || null
  } catch { return null }
}

async function yahooQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  try {
    const r = await fetch(proxy, { signal: AbortSignal.timeout(8000) })
    const data = await r.json()
    const parsed = JSON.parse(data.contents)
    return parsed?.quoteResponse?.result?.[0] || null
  } catch { return null }
}

// ── Alpha Vantage ─────────────────────────────────────────────────────────────
async function avFetch(params) {
  const url = `${AV_BASE}?${new URLSearchParams({ ...params, apikey: AV_KEY })}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
    return await r.json()
  } catch { return null }
}

// ── Detect crypto ─────────────────────────────────────────────────────────────
const CRYPTO_LIST = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC',
  'LINK','LTC','BCH','SHIB','UNI','ATOM','ALGO','NEAR','SAND','MANA','AXS','FTM']

export function isCryptoTicker(ticker) {
  return CRYPTO_LIST.includes(ticker.toUpperCase()) ||
    ticker.toLowerCase().includes('usdt') ||
    ticker.toLowerCase().includes('usd')
}

// ── Main: fetch all live data for a ticker ────────────────────────────────────
export async function fetchLiveData(ticker) {
  const sym = ticker.toUpperCase()
  const isCrypto = isCryptoTicker(sym)

  // Yahoo symbol for crypto
  const yahooSym = isCrypto ? `${sym}-USD` : sym

  // Run fetches in parallel
  const [quote, avQuote, avOverview, avRSI, avMACD, avNews] = await Promise.allSettled([
    yahooQuote(yahooSym),
    avFetch({ function: 'GLOBAL_QUOTE', symbol: isCrypto ? `${sym}USD` : sym }),
    isCrypto ? null : avFetch({ function: 'OVERVIEW', symbol: sym }),
    avFetch({ function: 'RSI', symbol: isCrypto ? `${sym}USD` : sym, interval: 'daily', time_period: 14, series_type: 'close' }),
    avFetch({ function: 'MACD', symbol: isCrypto ? `${sym}USD` : sym, interval: 'daily', series_type: 'close' }),
    avFetch({ function: 'NEWS_SENTIMENT', tickers: sym, limit: 5 }),
  ])

  const yahooData  = quote.status    === 'fulfilled' ? quote.value    : null
  const avData     = avQuote.status  === 'fulfilled' ? avQuote.value  : null
  const overview   = avOverview.status === 'fulfilled' ? avOverview.value : null
  const rsiData    = avRSI.status    === 'fulfilled' ? avRSI.value    : null
  const macdData   = avMACD.status   === 'fulfilled' ? avMACD.value   : null
  const newsData   = avNews.status   === 'fulfilled' ? avNews.value   : null

  // ── Extract real price ──────────────────────────────────────────────────────
  let currentPrice = null
  let prevClose    = null
  let changePercent = null
  let volume       = null
  let marketCap    = null
  let high52       = null
  let low52        = null
  let name         = sym

  // Yahoo quote is most reliable for real-time price
  if (yahooData) {
    currentPrice  = yahooData.regularMarketPrice || yahooData.ask || null
    prevClose     = yahooData.regularMarketPreviousClose || null
    changePercent = yahooData.regularMarketChangePercent || null
    volume        = yahooData.regularMarketVolume || null
    marketCap     = yahooData.marketCap || null
    high52        = yahooData.fiftyTwoWeekHigh || null
    low52         = yahooData.fiftyTwoWeekLow  || null
    name          = yahooData.longName || yahooData.shortName || sym
  }

  // Fallback to Alpha Vantage price
  if (!currentPrice && avData?.['Global Quote']) {
    const gq = avData['Global Quote']
    currentPrice  = parseFloat(gq['05. price']) || null
    prevClose     = parseFloat(gq['08. previous close']) || null
    changePercent = parseFloat(gq['10. change percent']) || null
    volume        = parseInt(gq['06. volume']) || null
  }

  // ── Extract RSI ─────────────────────────────────────────────────────────────
  let rsi = null
  if (rsiData?.['Technical Analysis: RSI']) {
    const dates = Object.keys(rsiData['Technical Analysis: RSI'])
    if (dates.length > 0) {
      rsi = parseFloat(rsiData['Technical Analysis: RSI'][dates[0]]?.RSI)
    }
  }

  // ── Extract MACD ────────────────────────────────────────────────────────────
  let macdSignal = null
  if (macdData?.['Technical Analysis: MACD']) {
    const dates = Object.keys(macdData['Technical Analysis: MACD'])
    if (dates.length > 0) {
      const latest = macdData['Technical Analysis: MACD'][dates[0]]
      const macdVal = parseFloat(latest?.MACD)
      const sigVal  = parseFloat(latest?.MACD_Signal)
      macdSignal = macdVal > sigVal ? 'Bullish crossover' : 'Bearish crossover'
    }
  }

  // ── Extract fundamentals (stocks only) ──────────────────────────────────────
  let fundamentals = {}
  if (overview && !overview.Note) {
    fundamentals = {
      pe:              overview.PERatio !== 'None' ? parseFloat(overview.PERatio) : null,
      eps:             overview.EPS !== 'None' ? parseFloat(overview.EPS) : null,
      revenueGrowthTTM:overview.RevenueGrowthTTM !== 'None' ? parseFloat(overview.RevenueGrowthTTM) : null,
      profitMargin:    overview.ProfitMargin !== 'None' ? parseFloat(overview.ProfitMargin) : null,
      beta:            overview.Beta !== 'None' ? parseFloat(overview.Beta) : null,
      dividendYield:   overview.DividendYield !== 'None' ? parseFloat(overview.DividendYield) : null,
      analystTarget:   overview.AnalystTargetPrice !== 'None' ? parseFloat(overview.AnalystTargetPrice) : null,
      sector:          overview.Sector || null,
      industry:        overview.Industry || null,
      description:     overview.Description || null,
      exDivDate:       overview.ExDividendDate || null,
      earningsDate:    overview.NextEarningsDate || null,
    }
    if (!name || name === sym) name = overview.Name || sym
  }

  // ── Extract news sentiment ───────────────────────────────────────────────────
  let newsSentiment = []
  if (newsData?.feed) {
    newsSentiment = newsData.feed.slice(0, 5).map(item => ({
      headline:  item.title,
      source:    item.source,
      sentiment: item.overall_sentiment_label,
      score:     item.overall_sentiment_score,
      url:       item.url,
      time:      item.time_published,
    }))
  }

  // ── Overall sentiment score from news ───────────────────────────────────────
  let newsSentimentScore = null
  if (newsSentiment.length > 0) {
    const avg = newsSentiment.reduce((a,b) => a + (b.score || 0), 0) / newsSentiment.length
    newsSentimentScore = avg
  }

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
    macdSignal,
    fundamentals,
    newsSentiment,
    newsSentimentScore,
    fetchedAt:        new Date().toISOString(),
    hasLiveData:      !!currentPrice,
  }
}

// ── Format helpers ─────────────────────────────────────────────────────────────
export function formatPrice(price, isCrypto = false) {
  if (!price) return 'N/A'
  if (isCrypto && price < 1) return `$${price.toFixed(6)}`
  if (isCrypto && price < 100) return `$${price.toFixed(4)}`
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
