const SUPA_BASE = 'https://supabase.oceantradellc.org'
const SUPA_KEY  = 'sb_publishable_FAmXHtAz2P_KeOp9rlDPr9_rDtR8V4X'
const SESSION_KEY = 'sai_session'

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}
function saveSession(s) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
}

export async function login(email, password) {
  const r = await fetch(`${SUPA_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error_description || err.msg || 'Invalid login')
  }
  const data = await r.json()
  saveSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000) - 5000,
  })
  return data
}

export function logout() {
  clearSession()
}

export function isLoggedIn() {
  const s = loadSession()
  return !!(s && s.refresh_token)
}

async function refreshSession(s) {
  try {
    const r = await fetch(`${SUPA_BASE}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    })
    if (!r.ok) { clearSession(); return null }
    const data = await r.json()
    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000) - 5000,
    }
    saveSession(next)
    return next
  } catch { return null }
}

export async function getAccessToken() {
  let s = loadSession()
  if (!s) return null
  if (Date.now() >= s.expires_at) {
    s = await refreshSession(s)
    if (!s) return null
  }
  return s.access_token
}

export async function authHeaders(extra = {}) {
  const token = await getAccessToken()
  return {
    'Content-Type': 'application/json',
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${token || SUPA_KEY}`,
    ...extra,
  }
}

export const SUPA_REST_URL = `${SUPA_BASE}/rest/v1`
