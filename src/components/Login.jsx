import { useState } from 'react'
import { login } from '../lib/auth.js'

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      onSuccess()
    } catch (err) {
      setError(err.message || 'Login failed')
    }
    setLoading(false)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Inter,sans-serif' }}>
      <form onSubmit={handleSubmit} style={{ width:280, display:'flex', flexDirection:'column', gap:12 }}>
        <h2 style={{ margin:0, marginBottom:8 }}>Secretary AI</h2>
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}
          required style={{ padding:10, borderRadius:8, border:'1px solid #ccc' }} />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}
          required style={{ padding:10, borderRadius:8, border:'1px solid #ccc' }} />
        {error && <div style={{ color:'#FF5E5E', fontSize:13 }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ padding:10, borderRadius:8, border:'none', background:'#6C63FF', color:'#fff', fontWeight:600, cursor:'pointer' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
