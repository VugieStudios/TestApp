import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './lib/store.js'
import { supabase } from './lib/supabase.js'
import { computeGame, rankFor } from './lib/game.js'
import { streak } from './lib/habits.js'
import { todayKey } from './lib/dates.js'
import { useGarminSync } from './lib/garmin.js'
import { TimerProvider, fmtTime, useTimer } from './lib/timer.jsx'
import { BadgeToast, Kickstart, LevelUp, XpFloats } from './components/game.jsx'
import { Sheet } from './components/ui.jsx'
import Login from './views/Login.jsx'
import Today from './views/Today.jsx'
import Habits from './views/Habits.jsx'
import Goals from './views/Goals.jsx'
import Mind from './views/Mind.jsx'
import Stats from './views/Stats.jsx'
import Profile from './views/Profile.jsx'

const TABS = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'habits', label: 'Habits', icon: '↻' },
  { id: 'goals', label: 'Goals', icon: '◎' },
  { id: 'mind', label: 'Mind', icon: '✎' },
  { id: 'stats', label: 'Stats', icon: '▦' },
]
const VIEWS = { today: Today, habits: Habits, goals: Goals, mind: Mind, stats: Stats, profile: Profile }

const STATUS = { loading: 'Loading…', saving: 'Saving…', saved: 'Saved', offline: 'Not synced' }

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="login muted">Loading…</div>
  if (!session) return <Login />
  return <Main key={session.user.id} user={session.user} />
}

function Main({ user }) {
  const [data, actions, status] = useStore(user)
  const onWorkDone = useCallback(
    ({ minutes, target }) => actions.logFocus({ minutes, label: target?.label || 'Free focus', targetType: target?.type || null, targetId: target?.id || null }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )
  return (
    <TimerProvider settings={data.settings} onWorkDone={onWorkDone}>
      <Shell data={data} actions={actions} status={status} />
    </TimerProvider>
  )
}

function TimerPill({ onClick }) {
  const t = useTimer()
  if (t.status === 'idle') return null
  return (
    <button className={`timer-pill ${t.phase}`} onClick={onClick}>
      {t.status === 'paused' ? '❚❚' : t.phase === 'break' ? '☕' : '⏱'} {fmtTime(t.remaining)}
    </button>
  )
}

function Shell({ data, actions, status }) {
  const [tab, setTab] = useState('today')
  const [sub, setSub] = useState(null)
  const [dumpOpen, setDumpOpen] = useState(false)
  const [dumpText, setDumpText] = useState('')
  const [dumpSaved, setDumpSaved] = useState(0)
  const [kickTarget, setKickTarget] = useState(null)
  const timer = useTimer()
  const game = useMemo(() => computeGame(data), [data])

  const goTo = (t, subTab = null) => {
    setTab(t)
    setSub(subTab)
    window.scrollTo({ top: 0 })
  }
  const garmin = useGarminSync(data, actions)

  // Garmin: sync on open, at most every 3 hours
  const autoSynced = useRef(false)
  useEffect(() => {
    if (status === 'loading' || autoSynced.current || !data.garmin?.enabled) return
    autoSynced.current = true
    const last = data.garmin.lastSync || data.garmin.lastAttempt
    if (!last || Date.now() - new Date(last) > 3 * 3600 * 1000) garmin.sync()
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const ui = {
    goTo,
    kick: (target) => setKickTarget(target),
    // start a focus session; the timer pill in the top bar shows it everywhere
    focus: (target) => {
      timer.start(target)
      goTo('today')
    },
    openDump: () => setDumpOpen(true),
    garmin,
  }

  // remember best streaks so they survive edits
  useEffect(() => {
    if (status === 'loading') return
    const updates = {}
    for (const h of data.habits) {
      const s = streak(data, h)
      if (s > (data.best[h.id] || 0)) updates[h.id] = s
    }
    if (Object.keys(updates).length) actions.recordBest(updates)
  }, [data.checks, status]) // eslint-disable-line react-hooks/exhaustive-deps

  // +XP popups
  const [floats, setFloats] = useState([])
  const prevXp = useRef(null)
  useEffect(() => {
    if (status === 'loading') return
    const prev = prevXp.current
    prevXp.current = game.xp
    if (prev === null || game.xp <= prev) return
    const f = { id: Math.random(), amount: game.xp - prev }
    setFloats((l) => [...l, f])
    navigator.vibrate?.(20)
    setTimeout(() => setFloats((l) => l.filter((x) => x !== f)), 1300)
  }, [game.xp, status])

  // level-ups (modal) and badges (toast), each shown once
  const [levelUp, setLevelUp] = useState(null)
  const [toasts, setToasts] = useState([])
  const unlocked = game.badges.filter((b) => b.unlocked).map((b) => b.id).join(',')
  useEffect(() => {
    if (status === 'loading') return
    const ids = unlocked ? unlocked.split(',') : []
    if (!data.seen) return actions.markSeen(game.level, ids)
    const fresh = game.badges.filter((b) => b.unlocked && !data.seen.badges.includes(b.id))
    const up = game.level > data.seen.level
    if (!up && !fresh.length) return
    if (up) setLevelUp({ level: game.level, rank: game.rank, rankChanged: rankFor(data.seen.level).name !== game.rank.name })
    if (fresh.length) setToasts((t) => [...t, ...fresh])
    actions.markSeen(Math.max(game.level, data.seen.level), [...new Set([...data.seen.badges, ...ids])])
  }, [game.level, unlocked, status]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveDump = () => {
    if (!dumpText.trim()) return
    actions.addDump(dumpText.trim())
    setDumpText('')
    setDumpSaved((n) => n + 1)
  }

  const View = VIEWS[tab]
  const low = !!data.lowEnergy[todayKey()]

  return (
    <div className={`app ${low ? 'is-low' : ''}`}>
      <header className="topbar">
        <button className="me" onClick={() => goTo('profile')} aria-label="Profile">
          <span className="me-lvl">{game.level}</span>
          <span className="me-bar"><i style={{ width: `${game.progress * 100}%` }} /></span>
        </button>
        <nav className="tabs desktop-only">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => goTo(t.id)}>{t.label}</button>
          ))}
        </nav>
        <div className="row tight">
          <TimerPill onClick={() => goTo('today')} />
          <span className={`sync ${status}`} title={status === 'offline' ? 'Saved on this device; will sync when back online' : ''}>
            <i />{STATUS[status]}
          </span>
        </div>
      </header>

      <main className="content">
        <View key={tab + (sub || '')} data={data} actions={actions} game={game} ui={ui} goTo={goTo} sub={sub} />
      </main>

      <button className="fab" onClick={() => setDumpOpen(true)} aria-label="Brain dump">
        <span>+</span>
      </button>

      <Sheet open={dumpOpen} onClose={() => { setDumpOpen(false); setDumpSaved(0) }} title="Brain dump">
        <p className="muted small">Get it out of your head. Sort it out later in the Mind tab.</p>
        <textarea
          autoFocus
          rows={4}
          placeholder="Type anything… press Enter to save, keep typing for the next one"
          value={dumpText}
          onChange={(e) => setDumpText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveDump() } }}
        />
        <div className="row">
          <span className="grow muted small">{dumpSaved > 0 && `✓ ${dumpSaved} saved`}</span>
          <button className="primary" onClick={saveDump} disabled={!dumpText.trim()}>Dump it</button>
        </div>
      </Sheet>

      <XpFloats floats={floats} />
      <Kickstart
        target={kickTarget}
        onClose={() => setKickTarget(null)}
        onFinish={(t) => actions.logKick(t.label)}
        onContinue={(t) => { setKickTarget(null); ui.focus(t) }}
      />
      <LevelUp item={levelUp} onClose={() => setLevelUp(null)} />
      <BadgeToast badge={toasts[0]} onDone={() => setToasts((t) => t.slice(1))} />

      <nav className="bottom-nav mobile-only">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => goTo(t.id)}>
            <span className="icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
