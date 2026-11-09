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
import Plan from './views/Plan.jsx'
import Mind from './views/Mind.jsx'
import Stats from './views/Stats.jsx'
import Settings from './views/Settings.jsx'
import { WorkoutLogger } from './components/workout.jsx'
import { sessionById } from './lib/training.js'

const TABS = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'plan', label: 'Plan', icon: '☰' },
  { id: 'mind', label: 'Mind', icon: '✎' },
  { id: 'progress', label: 'Progress', icon: '▦' },
]
const VIEWS = { today: Today, plan: Plan, mind: Mind, progress: Stats, settings: Settings }

// Old screen names still work everywhere in the app
const ALIASES = {
  habits: ['plan', 'habits'],
  train: ['plan', 'training'],
  goals: ['plan', 'goals'],
  stats: ['progress', null],
  profile: ['settings', null],
}

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
  const [workout, setWorkout] = useState(null) // { date, sessionId }
  const timer = useTimer()
  const game = useMemo(() => computeGame(data), [data])

  const goTo = (target, subTab = null) => {
    const [t, defSub] = ALIASES[target] || [target, null]
    setTab(t)
    setSub(subTab || defSub)
    window.scrollTo({ top: 0 })
  }
  const garmin = useGarminSync(data, actions)

  // Garmin: sync when the app opens or comes back into view, and every 15 minutes while open
  const garminRef = useRef({})
  garminRef.current = { g: data.garmin, garmin, status }
  useEffect(() => {
    const maybeSync = () => {
      const { g, garmin: gs, status: st } = garminRef.current
      if (st === 'loading' || !g?.enabled || gs.syncing || document.visibilityState === 'hidden') return
      const last = g.lastSync || g.lastAttempt
      if (!last || Date.now() - new Date(last) > 15 * 60 * 1000) gs.sync()
    }
    maybeSync()
    const id = setInterval(maybeSync, 60 * 1000)
    document.addEventListener('visibilitychange', maybeSync)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', maybeSync)
    }
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
    logWorkout: (date, sessionId) => setWorkout({ date, sessionId }),
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
        <button className="me" onClick={() => goTo('progress', 'achievements')} aria-label="Level and badges">
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
          <span className={`sync ${status}`} title={status === 'offline' ? 'Saved on this device; will sync when back online' : STATUS[status]}>
            <i />{STATUS[status]}
          </span>
          <button className={`icon-btn gear ${tab === 'settings' ? 'on' : ''}`} onClick={() => goTo('settings')} aria-label="Settings">⚙</button>
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

      <Sheet open={!!workout} onClose={() => setWorkout(null)} title={workout ? sessionById(data, workout.sessionId)?.name || 'Workout' : ''}>
        {workout && <WorkoutLogger data={data} actions={actions} date={workout.date} sessionId={workout.sessionId} onClose={() => setWorkout(null)} />}
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
