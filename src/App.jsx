import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store.js'
import { supabase } from './supabase.js'
import { computeGame, rankFor } from './game.js'
import { Celebration, XpFloats } from './components/Game.jsx'
import Login from './views/Login.jsx'
import Today from './views/Today.jsx'
import Habits from './views/Habits.jsx'
import Goals from './views/Goals.jsx'
import Journal from './views/Journal.jsx'
import Profile from './views/Profile.jsx'

const TABS = [
  { id: 'today', label: 'Today', icon: '⚔️' },
  { id: 'habits', label: 'Habits', icon: '🔁' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
  { id: 'journal', label: 'Journal', icon: '📓' },
  { id: 'profile', label: 'Profile', icon: '🏅' },
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
  const game = useMemo(() => computeGame(data), [data])

  // +XP popups whenever XP goes up
  const [floats, setFloats] = useState([])
  const prevXp = useRef(null)
  useEffect(() => {
    if (status === 'loading') return
    const prev = prevXp.current
    prevXp.current = game.xp
    if (prev === null || game.xp <= prev) return
    const f = { id: Math.random(), amount: game.xp - prev }
    setFloats((list) => [...list, f])
    navigator.vibrate?.(25)
    setTimeout(() => setFloats((list) => list.filter((x) => x !== f)), 1300)
  }, [game.xp, status])

  // Level-ups and new badges, each celebrated once
  const [queue, setQueue] = useState([])
  const unlocked = game.badges.filter((b) => b.unlocked).map((b) => b.id).join(',')
  useEffect(() => {
    if (status === 'loading') return
    const ids = unlocked ? unlocked.split(',') : []
    if (!data.seen) {
      actions.markSeen(game.level, ids) // first time: don't celebrate old progress
      return
    }
    const newBadges = game.badges.filter((b) => b.unlocked && !data.seen.badges.includes(b.id))
    const levelUp = game.level > data.seen.level
    if (!levelUp && newBadges.length === 0) return

    const items = []
    if (levelUp) {
      items.push({ type: 'level', level: game.level, rank: game.rank, rankChanged: rankFor(data.seen.level).name !== game.rank.name })
    }
    newBadges.forEach((badge) => items.push({ type: 'badge', badge }))
    setQueue((q) => [...q, ...items])
    navigator.vibrate?.([40, 60, 40])
    actions.markSeen(Math.max(game.level, data.seen.level), [...new Set([...data.seen.badges, ...ids])])
  }, [game.level, unlocked, status]) // eslint-disable-line react-hooks/exhaustive-deps

  const View = { today: Today, habits: Habits, goals: Goals, journal: Journal, profile: Profile }[tab]

  const logout = () => {
    if (status === 'saving' && !window.confirm('Still saving. Log out anyway?')) return
    supabase.auth.signOut()
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="logo" onClick={() => setTab('profile')}>
          <span className="mini-avatar">{game.rank.icon}</span>
          <span>Lv {game.level}</span>
          <span className="mini-xp"><i style={{ width: `${game.progress * 100}%` }} /></span>
        </button>
        <nav className="tabs desktop-only">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="row tight">
          <span className={`sync ${status}`}>{STATUS[status]}</span>
          <button className="ghost small" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="content">
        <View data={data} actions={actions} goTo={setTab} game={game} />
      </main>

      <XpFloats floats={floats} />
      <Celebration item={queue[0]} onClose={() => setQueue((q) => q.slice(1))} />

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
