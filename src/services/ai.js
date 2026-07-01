const EP = 'https://api.anthropic.com/v1/messages'
const M  = 'claude-sonnet-4-6'

async function ask(apiKey, messages, system='', maxTokens=500) {
  const r = await fetch(EP, {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-api-key':apiKey,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true',
    },
    body:JSON.stringify({model:M,max_tokens:maxTokens,system,messages}),
  })
  if (!r.ok) throw new Error(`API ${r.status}`)
  const d = await r.json()
  return d.content?.[0]?.text ?? ''
}

const parseJSON = (t) => {
  try { return JSON.parse(t.replace(/```json|```/g,'').trim()) }
  catch { return null }
}

export const classifyTask = async (key, input) =>
  parseJSON(await ask(key,[{role:'user',content:`Classify this into a task. Return ONLY valid JSON, no markdown fences:
{"title":"concise title","description":"brief description","category":"Perso|Family|Home|Work|Investment|Hobbies|Projects","priority":1,"tags":[],"confidence":0.9}

Priority: 1=urgent/health/critical, 2=important, 3=low/hobby
Input: "${input}"`}],'You are a task classifier. Return only valid JSON.',400))

export const classifyImage = async (key, b64) =>
  parseJSON(await ask(key,[{role:'user',content:[
    {type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},
    {type:'text',text:'Extract a task from this image. Return ONLY valid JSON: {"title":"...","description":"...","category":"Work","priority":2,"tags":[],"confidence":0.9}'},
  ]}],'',400))

export const smartNotes = async (key, title, cat, desc) =>
  ask(key,[{role:'user',content:`Task: "${title}"\nCategory: ${cat}\n${desc?`Description: ${desc}`:''}
Give practical bullet-point action steps. Max 120 words.`}],'You are a helpful personal secretary.',300)

export const morningBriefing = async (key, tasks, overdueCount) => {
  const top = tasks.slice(0,5).map(t=>`[P${t.priority}] ${t.title}`).join('\n')
  return ask(key,[{role:'user',content:`Active: ${tasks.length} | Overdue: ${overdueCount}\nTop tasks:\n${top}\nWrite a brief energizing morning briefing (max 80 words).`}],'You are an upbeat personal secretary.',200)
}

export const weeklyReview = async (key, stats) => {
  const br = Object.entries(stats.byCat).filter(([,v])=>v.total>0).map(([c,v])=>`${c}: ${Math.round(v.rate*100)}%`).join(', ')
  return ask(key,[{role:'user',content:`Weekly: ${stats.completed}/${stats.total} done. ${stats.overdue.length} overdue.\nBy category: ${br}\nWrite an encouraging review (max 120 words): wins, attention needed, one tip.`}],'You are an encouraging personal secretary.',250)
}
