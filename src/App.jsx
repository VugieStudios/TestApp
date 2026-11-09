import { useEffect, useState } from 'react'
import { useStore } from './store.js'
import { supabase } from './supabase.js'
import Login from './views/Login.jsx'
import Today from './views/Today.jsx'
import Habits from './views/Habits.jsx'
import Goals from './views/Goals.jsx'
import Journal from './views/Journal.jsx'
import Insights from './views/Insights.jsx'

const TABS = [
  { id: 'today', label: 'Today', icon: '☀️' },
  { id: 'habits', label: 'Habits', icon: '🔁' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
  { id: 'journal', label: 'Journal', icon: '📓' },
  { id: 'insights', label: 'Insights', icon: '📈' },
]

const STATUS = {
  loading: 'Loading…',
  saving: 'Saving…',
  saved: '✓ Saved',
  offline: '⚠ Not synced',
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="login muted">Loading…</div>
  if (!session) return <Login />
  return <Main key={session.user.id} user={session.user} />
}

function Main({ user }) {
  const [data, actions, status] = useStore(user)
  const [tab, setTab] = useState('today')

  const View = { today: Today, habits: Habits, goals: Goals, journal: Journal, insights: Insights }[tab]

  const logout = () => {
    if (status === 'saving' && !window.confirm('Still saving. Log out anyway?')) return
    supabase.auth.signOut()
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">🌱 Grow</span>
        <nav className="tabs desktop-only">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="row tight">
          <span className={`sync ${status}`} title={status === 'offline' ? 'Saved on this device; will sync when the connection is back' : ''}>
            {STATUS[status]}
          </span>
          <button className="ghost small" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="content">
        <View data={data} actions={actions} goTo={setTab} />
      </main>

      <nav className="bottom-nav mobile-only">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
