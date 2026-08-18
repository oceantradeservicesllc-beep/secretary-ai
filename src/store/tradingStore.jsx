import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const Ctx = createContext(null)

const SUPA_URL = 'https://meqsodoybcsgpmmccwpe.supabase.co/rest/v1'
const SUPA_KEY = 'sb_publishable_-KsN5vI4j3YYkw14ursHuw_HC5H0j_O'
const H = {
  'Content-Type': 'application/json',
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function dbGet(table) {
  try {
    const r = await fetch(`${SUPA_URL}/${table}?order=created_at.desc`, { headers: H })
    if (!r.ok) return []
    return await r.json()
  } catch { return [] }
}

async function dbUpsert(table, data) {
  try {
    await fetch(`${SUPA_URL}/${table}`, {
      method: 'POST',
      headers: { ...H, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(data),
    })
  } catch(e) { console.warn('upsert failed', table, e) }
}

async function dbDelete(table, id) {
  try {
    await fetch(`${SUPA_URL}/${table}?id=eq.${id}`, { method: 'DELETE', headers: H })
  } catch(e) { console.warn('delete failed', table, e) }
}

// ── Local storage fallback ────────────────────────────────────────────────────
const KEYS = { pos: 'sai_trading_positions', arch: 'sai_trading_archived', cash: 'sai_trading_cash' }
const load = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } }
const save = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// ── Converters ────────────────────────────────────────────────────────────────
function posToDB(p) {
  return {
    id: p.id, ticker: p.ticker, asset_type: p.assetType, side: p.side,
    fund_group: p.fundGroup, trade_type: p.tradeType,
    avg_price: p.avgPrice, total_qty: p.totalQty, stop_loss: p.stopLoss,
    purchases: p.purchases || [], first_date: p.firstDate,
    notes: p.notes || '', is_closed: p.isClosed || false,
    created_at: p.createdAt, updated_at: p.updatedAt || new Date().toISOString(),
  }
}

function posFromDB(r) {
  return {
    id: r.id, ticker: r.ticker, assetType: r.asset_type, side: r.side,
    fundGroup: r.fund_group, tradeType: r.trade_type,
    avgPrice: parseFloat(r.avg_price), totalQty: parseFloat(r.total_qty),
    stopLoss: parseFloat(r.stop_loss),
    purchases: r.purchases || [], firstDate: r.first_date,
    notes: r.notes || '', isClosed: r.is_closed || false,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

function archToDB(p) {
  return {
    id: p.id, ticker: p.ticker, asset_type: p.assetType, side: p.side,
    fund_group: p.fundGroup, trade_type: p.tradeType,
    avg_price: p.avgPrice, total_qty: p.totalQty, stop_loss: p.stopLoss,
    purchases: p.purchases || [], first_date: p.firstDate, notes: p.notes || '',
    sell_price: p.sellPrice, sell_qty: p.sellQty, sell_date: p.sellDate,
    pnl: p.pnl, pnl_pct: p.pnlPct, days_held: p.daysHeld,
    sell_notes: p.sellNotes || '', is_closed: true, closed_at: p.closedAt,
    created_at: p.createdAt, updated_at: new Date().toISOString(),
  }
}

function archFromDB(r) {
  return {
    id: r.id, ticker: r.ticker, assetType: r.asset_type, side: r.side,
    fundGroup: r.fund_group, tradeType: r.trade_type,
    avgPrice: parseFloat(r.avg_price||0), totalQty: parseFloat(r.total_qty||0),
    stopLoss: parseFloat(r.stop_loss||0),
    purchases: r.purchases || [], firstDate: r.first_date, notes: r.notes || '',
    sellPrice: parseFloat(r.sell_price||0), sellQty: parseFloat(r.sell_qty||0),
    sellDate: r.sell_date, pnl: parseFloat(r.pnl||0), pnlPct: parseFloat(r.pnl_pct||0),
    daysHeld: r.days_held || 0, sellNotes: r.sell_notes || '',
    isClosed: true, closedAt: r.closed_at, createdAt: r.created_at,
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const FUND_GROUPS = ['401k', 'Roth IRA', 'Perso', 'Emcy Fund']
export const FUND_COLORS = {
  '401k':     '#6C63FF',
  'Roth IRA': '#52C986',
  'Perso':    '#45B7D1',
  'Emcy Fund':'#FF9F43',
}
export const TRADE_TYPES = [
  { k:'S', label:'Short', full:'Short (1–7 days)',   color:'#FF9F43' },
  { k:'M', label:'Mid',   full:'Mid (1–3 months)',   color:'#45B7D1' },
  { k:'L', label:'Long',  full:'Long (6–12 months)', color:'#C984E0' },
]
export const ASSET_TYPES = ['Stock', 'Crypto', 'Futures', 'Contract']

// ── Provider ──────────────────────────────────────────────────────────────────
export function TradingProvider({ children }) {
  const [positions, setPositions] = useState(() => load(KEYS.pos,  []))
  const [archived,  setArchived]  = useState(() => load(KEYS.arch, []))
  const [cashMap,   setCashMap]   = useState(() => load(KEYS.cash, {}))
  const [syncing,   setSyncing]   = useState(false)

  // ── Save to localStorage whenever state changes ───────────────────────────
  useEffect(() => { save(KEYS.pos,  positions) }, [positions])
  useEffect(() => { save(KEYS.arch, archived)  }, [archived])
  useEffect(() => { save(KEYS.cash, cashMap)   }, [cashMap])

  // ── Load from Supabase on startup ─────────────────────────────────────────
  useEffect(() => { syncFromCloud() }, []) // eslint-disable-line

  const syncFromCloud = useCallback(async () => {
    setSyncing(true)
    try {
      const [posRows, archRows, cashRows] = await Promise.all([
        dbGet('trading_positions'),
        dbGet('trading_archived'),
        dbGet('trading_cash'),
      ])
      if (posRows.length  > 0) setPositions(posRows.map(posFromDB))
      if (archRows.length > 0) setArchived(archRows.map(archFromDB))
      if (cashRows.length > 0) {
        const map = {}
        cashRows.forEach(r => { map[r.fund_group] = parseFloat(r.amount || 0) })
        setCashMap(map)
      }
    } catch(e) { console.warn('Trading sync failed:', e) }
    setSyncing(false)
  }, [])

  // ── Add trade ─────────────────────────────────────────────────────────────
  const addTrade = useCallback((trade) => {
    const { ticker, assetType, price, qty, fundGroup, tradeType, date, side, notes } = trade
    const sym = ticker.toUpperCase().trim()
    const bp  = parseFloat(price)
    const q   = parseFloat(qty)
    const d   = date || new Date().toISOString().split('T')[0]
    const sl  = parseFloat((bp * 0.95).toFixed(6))
    let finalSL = sl

    setPositions(prev => {
      const idx = prev.findIndex(p => p.ticker === sym && p.fundGroup === fundGroup && !p.isClosed)
      if (idx >= 0 && side === 'BUY') {
        const ex  = prev[idx]
        const tq  = ex.totalQty + q
        const avg = ((ex.avgPrice * ex.totalQty) + (bp * q)) / tq
        finalSL   = parseFloat((avg * 0.95).toFixed(6))
        const updated = {
          ...ex,
          avgPrice:  parseFloat(avg.toFixed(6)),
          totalQty:  tq,
          stopLoss:  finalSL,
          purchases: [...ex.purchases, { id: uid(), price: bp, qty: q, date: d }],
          updatedAt: new Date().toISOString(),
        }
        const next = [...prev]; next[idx] = updated
        dbUpsert('trading_positions', posToDB(updated))
        // Deduct additional purchase cost from cash
        if ((trade.side || 'BUY') === 'BUY') {
          const cost = bp * q
          setCashMap(prev => {
            const newCash = parseFloat(Math.max((prev[trade.fundGroup] || 0) - cost, 0).toFixed(2))
            dbUpsert('trading_cash', {
              id: `cash_${trade.fundGroup.replace(/\s+/g,'_')}`,
              fund_group: trade.fundGroup,
              amount: newCash,
              updated_at: new Date().toISOString(),
            })
            return { ...prev, [trade.fundGroup]: newCash }
          })
        }
        return next
      }
      const newPos = {
        id: uid(), ticker: sym, assetType: assetType || 'Stock',
        side: side || 'BUY', fundGroup, tradeType,
        avgPrice: bp, totalQty: q, stopLoss: sl,
        purchases: [{ id: uid(), price: bp, qty: q, date: d }],
        firstDate: d, notes: notes || '', isClosed: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      dbUpsert('trading_positions', posToDB(newPos))
      return [newPos, ...prev]
    })

    // Deduct cost from cash for this fund group (BUY only)
    if ((trade.side || 'BUY') === 'BUY') {
      const cost = bp * q
      setCashMap(prev => {
        const newCash = parseFloat(Math.max((prev[trade.fundGroup] || 0) - cost, 0).toFixed(2))
        dbUpsert('trading_cash', {
          id: `cash_${trade.fundGroup.replace(/\s+/g,'_')}`,
          fund_group: trade.fundGroup,
          amount: newCash,
          updated_at: new Date().toISOString(),
        })
        return { ...prev, [trade.fundGroup]: newCash }
      })
    }

    return { ticker: sym, stopLoss: finalSL, tradeDate: d }
  }, [])

  // ── Close / sell ──────────────────────────────────────────────────────────
  const closeTrade = useCallback((posId, sellPrice, sellQty, sellDate, notes) => {
    setPositions(prev => {
      const pos = prev.find(p => p.id === posId)
      if (!pos) return prev

      const sp       = parseFloat(sellPrice)
      const sq       = parseFloat(sellQty) || pos.totalQty
      const sd       = sellDate || new Date().toISOString().split('T')[0]
      const pnl      = (sp - pos.avgPrice) * sq
      const pnlPct   = ((sp - pos.avgPrice) / pos.avgPrice) * 100
      const daysHeld = Math.round((new Date(sd) - new Date(pos.firstDate)) / 86400000)

      const record = {
        ...pos,
        sellPrice: sp, sellQty: sq, sellDate: sd,
        pnl:       parseFloat(pnl.toFixed(2)),
        pnlPct:    parseFloat(pnlPct.toFixed(2)),
        daysHeld,  sellNotes: notes || '',
        isClosed:  true, closedAt: new Date().toISOString(),
      }

      // Auto-add sale proceeds to cash for this fund group
      const proceeds = sp * sq
      setCashMap(prev => {
        const newCash = parseFloat(((prev[pos.fundGroup] || 0) + proceeds).toFixed(2))
        dbUpsert('trading_cash', {
          id: `cash_${pos.fundGroup.replace(/\s+/g,'_')}`,
          fund_group: pos.fundGroup,
          amount: newCash,
          updated_at: new Date().toISOString(),
        })
        return { ...prev, [pos.fundGroup]: newCash }
      })

      setArchived(a => {
        const next = [record, ...a]
        dbUpsert('trading_archived', archToDB(record))
        return next
      })

      if (sq < pos.totalQty) {
        const updated = { ...pos, totalQty: pos.totalQty - sq, updatedAt: new Date().toISOString() }
        dbUpsert('trading_positions', posToDB(updated))
        return prev.map(p => p.id === posId ? updated : p)
      }
      dbDelete('trading_positions', posId)
      return prev.filter(p => p.id !== posId)
    })
  }, [])

  const deletePosition = useCallback((id) => {
    setPositions(prev => prev.filter(p => p.id !== id))
    dbDelete('trading_positions', id)
  }, [])

  // ── Edit existing position ────────────────────────────────────────────────
  const editPosition = useCallback((id, updates) => {
    setPositions(prev => {
      const next = prev.map(p => {
        if (p.id !== id) return p
        const updated = {
          ...p,
          ticker:    updates.ticker    || p.ticker,
          assetType: updates.assetType || p.assetType,
          avgPrice:  updates.avgPrice  != null ? parseFloat(updates.avgPrice)  : p.avgPrice,
          totalQty:  updates.totalQty  != null ? parseFloat(updates.totalQty)  : p.totalQty,
          fundGroup: updates.fundGroup || p.fundGroup,
          tradeType: updates.tradeType || p.tradeType,
          notes:     updates.notes     != null ? updates.notes : p.notes,
          stopLoss:  updates.stopLoss  != null ? parseFloat(updates.stopLoss)  : parseFloat((parseFloat(updates.avgPrice||p.avgPrice)*0.95).toFixed(6)),
          updatedAt: new Date().toISOString(),
        }
        dbUpsert('trading_positions', posToDB(updated))
        return updated
      })
      return next
    })
  }, [])

  // ── Cash — synced to Supabase ─────────────────────────────────────────────
  const setCash = useCallback((fg, amt) => {
    const amount = parseFloat(amt) || 0
    setCashMap(prev => ({ ...prev, [fg]: amount }))
    dbUpsert('trading_cash', {
      id: `cash_${fg.replace(/\s+/g,'_')}`,
      fund_group: fg,
      amount,
      updated_at: new Date().toISOString(),
    })
  }, [])

  // ── Performance calc — cash excluded ─────────────────────────────────────
  const calcPerf = useCallback((fg, days) => {
    const cutoff = days ? new Date(Date.now() - days * 86400000) : null
    const closed = archived.filter(p => {
      if (fg && p.fundGroup !== fg) return false
      if (!cutoff) return true
      return new Date(p.closedAt) >= cutoff
    })
    const realized = closed.reduce((s, p) => s + (p.pnl || 0), 0)
    const wins     = closed.filter(p => p.pnl > 0).length
    const active   = positions.filter(p => (!fg || p.fundGroup === fg) && !p.isClosed)
    const invested = active.reduce((s, p) => s + (p.avgPrice * p.totalQty), 0)
    const best     = closed.length ? closed.reduce((a, b) => a.pnl > b.pnl ? a : b, closed[0]) : null
    const worst    = closed.length ? closed.reduce((a, b) => a.pnl < b.pnl ? a : b, closed[0]) : null
    const pnlPct   = invested > 0 ? (realized / invested) * 100 : 0
    return { realized, invested, count: closed.length, wins, losses: closed.length - wins, winRate: closed.length ? wins / closed.length * 100 : 0, closed, best, worst, pnlPct }
  }, [positions, archived])

  // ── Parse quick entry ─────────────────────────────────────────────────────
  const parseQuick = useCallback((str) => {
    const parts = str.split('/').map(s => s.trim())
    if (parts.length < 3) return null
    const [ticker, price, qty, datePart, fund, type] = parts
    const fg = fund
      ? FUND_GROUPS.find(f => f.toLowerCase().includes(fund.toLowerCase())) || '401k'
      : '401k'
    const tt = type
      ? TRADE_TYPES.find(t => t.k.toLowerCase() === type.trim()[0].toLowerCase()) || TRADE_TYPES[0]
      : TRADE_TYPES[0]
    let d = new Date().toISOString().split('T')[0]
    if (datePart && /\d/.test(datePart)) {
      const p = datePart.trim().split(/[\/\-]/)
      if (p.length === 3 && p[2].length === 4)
        d = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
    }
    return { ticker: ticker.toUpperCase(), price: parseFloat(price), qty: parseFloat(qty), fundGroup: fg, tradeType: tt.k, date: d }
  }, [])

  return (
    <Ctx.Provider value={{
      positions, archived, cashMap, syncing,
      addTrade, closeTrade, deletePosition, editPosition, setCash,
      calcPerf, parseQuick, syncFromCloud,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useTrading = () => useContext(Ctx)
