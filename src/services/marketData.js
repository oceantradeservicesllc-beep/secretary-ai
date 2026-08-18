// src/services/marketData.js
// Multi-source live price fetcher — no API key needed

const CRYPTO_LIST = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC',
  'LINK','LTC','BCH','SHIB','UNI','ATOM','ALGO','NEAR','FTM','SAND','MANA','PEPE','ARB','OP']

export const isCryptoTicker = (t) =>
  CRYPTO_LIST.includes(t?.toUpperCase().replace('-USD','')) ||
  t?.toUpperCase().includes('-USD')

// ── CoinGecko: free, no key, best for crypto ──────────────────────────────────
const GECKO_IDS = {
  BTC:'bitcoin', ETH:'ethereum', SOL:'solana', BNB:'binancecoin',
  XRP:'ripple', ADA:'cardano', DOGE:'dogecoin', AVAX:'avalanche-2',
  DOT:'polkadot', MATIC:'matic-network', LINK:'chainlink', LTC:'litecoin',
  BCH:'bitcoin-cash', SHIB:'shiba-inu', UNI:'uniswap', ATOM:'cosmos',
  ALGO:'algorand', NEAR:'near', FTM:'fantom', SAND:'the-sandbox',
  MANA:'decentraland', PEPE:'pepe', ARB:'arbitrum', OP:'optimism',
}

async function fetchCoinGecko(ticker) {
  const id = GECKO_IDS[ticker.toUpperCase()]
  if (!id) return null
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!r.ok) return null
    const data = await r.json()
    const d = data[id]
    if (!d?.usd) return null
    return {
      price:     d.usd,
      changePct: d.usd_24h_change || 0,
      volume:    d.usd_24h_vol || 0,
      source:    'CoinGecko',
      ok: true,
    }
  } catch { return null }
}

// ── Yahoo Finance via CORS proxies ────────────────────────────────────────────
async function fetchYahoo(ticker) {
  const sym = isCryptoTicker(ticker) ? `${ticker.replace('-USD','')}-USD` : ticker.toUpperCase()
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://thingproxy.freeboard.io/fetch/${url}`,
  ]
  for (const proxy of proxies) {
    try {
      const r = await fetch(proxy, { signal: AbortSignal.timeout(7000) })
      if (!r.ok) continue
      const raw  = await r.text()
      const json = JSON.parse(raw)
      const body = json.contents ? JSON.parse(json.contents) : json
      const res  = body?.chart?.result?.[0]
      if (!res) continue
      const meta     = res.meta
      const price    = meta.regularMarketPrice || meta.previousClose
      if (!price) continue
      const prevClose = meta.chartPreviousClose || meta.previousClose || price
      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
      return {
        price,
        changePct,
        prevClose,
        high52:  meta.fiftyTwoWeekHigh || null,
        low52:   meta.fiftyTwoWeekLow  || null,
        source:  'Yahoo Finance',
        ok: true,
      }
    } catch { continue }
  }
  return null
}

// ── Binance: free, no key, great for crypto ───────────────────────────────────
async function fetchBinance(ticker) {
  const sym = ticker.toUpperCase().replace('-USD','') + 'USDT'
  try {
    const [tickerR, statsR] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`, { signal: AbortSignal.timeout(6000) }),
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`,  { signal: AbortSignal.timeout(6000) }),
    ])
    if (!tickerR.ok) return null
    const tickerData = await tickerR.json()
    const statsData  = statsR.ok ? await statsR.json() : {}
    const price = parseFloat(tickerData.price)
    if (!price) return null
    return {
      price,
      changePct: parseFloat(statsData.priceChangePercent || 0),
      volume:    parseFloat(statsData.volume || 0),
      source:    'Binance',
      ok: true,
    }
  } catch { return null }
}

// ── Main fetch function — tries best source first ─────────────────────────────
export async function fetchLivePrice(ticker) {
  const sym     = ticker.toUpperCase().trim()
  const isCrypto = isCryptoTicker(sym)

  if (isCrypto) {
    // For crypto: CoinGecko → Binance → Yahoo
    const cg = await fetchCoinGecko(sym.replace('-USD',''))
    if (cg) return cg
    const bi = await fetchBinance(sym)
    if (bi) return bi
    const yh = await fetchYahoo(sym)
    if (yh) return yh
  } else {
    // For stocks: Yahoo Finance only (best source for stocks)
    const yh = await fetchYahoo(sym)
    if (yh) return yh
  }

  return { ok: false, price: null, changePct: null, source: null }
}

// ── Batch fetch multiple tickers ──────────────────────────────────────────────
export async function fetchPrices(tickers) {
  const results = {}
  for (const t of tickers) {
    const d = await fetchLivePrice(t)
    if (d.ok) results[t] = d
    await new Promise(r => setTimeout(r, 300)) // rate limit
  }
  return results
}

// ── Format helpers ────────────────────────────────────────────────────────────
export function formatPrice(price, isCrypto = false) {
  if (!price && price !== 0) return 'N/A'
  if (isCrypto && price < 0.01) return `$${price.toFixed(8)}`
  if (isCrypto && price < 1)    return `$${price.toFixed(6)}`
  if (isCrypto && price < 100)  return `$${price.toFixed(4)}`
  return `$${price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
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
  return String(vol)
}
