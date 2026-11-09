import { createContext, useContext, useEffect, useRef, useState } from 'react'

// Pomodoro timer shared by the whole app. It stores an end time instead of
// counting down, so it stays correct when you switch tabs, lock your phone or reload.

const TimerContext = createContext(null)
const KEY = 'grow-timer'

const IDLE = { phase: 'work', status: 'idle', endAt: null, remainingMs: null, target: null, finished: null }

function load() {
  try {
    return { ...IDLE, ...JSON.parse(localStorage.getItem(KEY)) }
  } catch {
    return IDLE
  }
}

export function chime(times = 2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = i % 2 ? 660 : 880
      const t = ctx.currentTime + i * 0.25
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.45)
    }
  } catch {
    /* audio not available */
  }
  navigator.vibrate?.([200, 100, 200])
}

export function TimerProvider({ settings, onWorkDone, children }) {
  const [t, setT] = useState(load)
  const [now, setNow] = useState(Date.now())
  const doneRef = useRef(onWorkDone)
  doneRef.current = onWorkDone

  const workMs = (settings.focusMinutes || 25) * 60000
  const breakMs = (settings.breakMinutes || 5) * 60000

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(t))
    } catch {
      /* ignore */
    }
  }, [t])

  useEffect(() => {
    if (t.status !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [t.status])

  // phase finished?
  useEffect(() => {
    if (t.status !== 'running' || now < t.endAt) return
    chime(t.phase === 'work' ? 3 : 2)
    if (t.phase === 'work') {
      doneRef.current?.({ minutes: settings.focusMinutes || 25, target: t.target })
      setT({ ...t, phase: 'break', status: 'running', endAt: Date.now() + breakMs, finished: t.target || { label: 'Focus session' } })
    } else {
      setT({ ...t, phase: 'work', status: 'idle', endAt: null, remainingMs: null })
    }
  }, [now, t]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = t.phase === 'work' ? workMs : breakMs
  const remaining = t.status === 'running' ? Math.max(0, t.endAt - now) : t.status === 'paused' ? t.remainingMs : total

  const api = {
    ...t,
    total,
    remaining,
    progress: 1 - remaining / total,
    start(target = t.target) {
      setNow(Date.now())
      setT({ ...t, target, phase: 'work', status: 'running', endAt: Date.now() + workMs, remainingMs: null, finished: null })
    },
    pause() {
      setT({ ...t, status: 'paused', remainingMs: Math.max(0, t.endAt - Date.now()), endAt: null })
    },
    resume() {
      setNow(Date.now())
      setT({ ...t, status: 'running', endAt: Date.now() + t.remainingMs, remainingMs: null })
    },
    reset() {
      setT({ ...IDLE, target: t.target })
    },
    // stop early but keep the minutes you did
    stopAndLog() {
      const done = Math.floor((total - remaining) / 60000)
      if (t.phase === 'work' && done >= 1) doneRef.current?.({ minutes: done, target: t.target })
      setT({ ...IDLE, target: t.target })
    },
    skipBreak() {
      setT({ ...IDLE, target: t.target, finished: t.finished })
    },
    setTarget(target) {
      setT({ ...t, target })
    },
    clearFinished() {
      setT({ ...t, finished: null })
    },
  }

  return <TimerContext.Provider value={api}>{children}</TimerContext.Provider>
}

export const useTimer = () => useContext(TimerContext)

export const fmtTime = (ms) => {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
