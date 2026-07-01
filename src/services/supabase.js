const SUPA_URL = 'https://pojhfovzxcjjyrbdyqyc.supabase.co'
const SUPA_KEY = 'sb_publishable_Os81VZl31s-E1PlNoSSIYA_ZEPoCs3k'

const H = {
  'Content-Type': 'application/json',
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
}

export async function fetchTasks() {
  const r = await fetch(`${SUPA_URL}/rest/v1/tasks?order=created_at.desc`, { headers: H })
  if (!r.ok) throw new Error('fetch tasks failed')
  const rows = await r.json()
  return rows.map(fromDB)
}

export async function upsertTask(task) {
  await fetch(`${SUPA_URL}/rest/v1/tasks`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(toDB(task)),
  })
}

export async function removeTask(id) {
  await fetch(`${SUPA_URL}/rest/v1/tasks?id=eq.${id}`, { method: 'DELETE', headers: H })
}

export async function fetchProjects() {
  const r = await fetch(
