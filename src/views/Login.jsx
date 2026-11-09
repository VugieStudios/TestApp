import { useState } from 'react'
import { supabase, usernameToEmail } from '../lib/supabase.js'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    setBusy(false)
    if (!error) return
    if (error.message === 'Invalid login credentials') setError('Wrong username or password.')
    else if (/fetch|network/i.test(error.message)) setError("Can't reach the server. Check your internet connection.")
    else setError(error.message)
  }

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-logo">🌱</div>
        <h1>Grow</h1>
        <label className="field">
          <span className="label">Username</span>
          <input autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy || !username || !password}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
