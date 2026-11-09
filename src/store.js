import { useEffect, useRef, useState } from 'react'
import { addDays, todayKey } from './dates.js'
import { supabase } from './supabase.js'

// All data lives in one object, saved to the user's row in Supabase.
// A copy is kept in the browser so the app opens instantly and works offline.

const LEGACY_KEY = 'grow-data-v1' // data from before logins existed
const cacheKey = (userId) => `grow-cache-${userId}`

const DEFAULT_DATA = {
  habits: [
    { id: 'h1', name: 'Move for 30 minutes', emoji: '🚴', archived: false },
    { id: 'h2', name: 'Read 10 pages', emoji: '📖', archived: false },
    { id: 'h3', name: 'No phone in bed', emoji: '📵', archived: false },
  ],
  checks: {}, // { 'YYYY-MM-DD': { habitId: true } }
  entries: {}, // { 'YYYY-MM-DD': { gratitude, win, improve, notes } }
  goals: [], // [{ id, title, why, deadline, done, steps: [{ id, text, done, doneAt }] }]
  seen: null, // { level, badges: [] } already celebrated
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...DEFAULT_DATA, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}

function writeLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    /* storage full or blocked */
  }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// status: 'loading' | 'saved' | 'saving' | 'offline'
export function useStore(user) {
  const [data, setData] = useState(() => readLocal(cacheKey(user.id)) || readLocal(LEGACY_KEY) || DEFAULT_DATA)
  const [status, setStatus] = useState('loading')
  const ready = useRef(false)
  const timer = useRef(null)

  // Load from the server once after login
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: row, error } = await supabase.from('user_data').select('data').eq('user_id', user.id).maybeSingle()
      if (cancelled) return
      if (error) {
        setStatus('offline')
      } else if (row) {
        setData({ ...DEFAULT_DATA, ...row.data })
        setStatus('saved')
      } else {
        // First login: move whatever was on this device into the account
        const initial = readLocal(LEGACY_KEY) || DEFAULT_DATA
        const { error: insertError } = await supabase.from('user_data').insert({ user_id: user.id, data: initial })
        if (!cancelled) {
          setData(initial)
          setStatus(insertError ? 'offline' : 'saved')
        }
      }
      ready.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [user.id])

  // Save changes: instantly to this device, and to the server after a short pause
  useEffect(() => {
    writeLocal(cacheKey(user.id), data)
    if (!ready.current) return
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('user_data')
        .upsert({ user_id: user.id, data, updated_at: new Date().toISOString() })
      setStatus(error ? 'offline' : 'saved')
    }, 800)
  }, [data, user.id])

  const update = (fn) => setData((prev) => fn(structuredClone(prev)))

  const actions = {
    // Habits
    toggleCheck(date, habitId) {
      update((d) => {
        d.checks[date] ??= {}
        if (d.checks[date][habitId]) delete d.checks[date][habitId]
        else d.checks[date][habitId] = true
        return d
      })
    },
    addHabit(name, emoji) {
      update((d) => {
        d.habits.push({ id: uid(), name, emoji: emoji || '✅', archived: false })
        return d
      })
    },
    editHabit(id, changes) {
      update((d) => {
        Object.assign(d.habits.find((h) => h.id === id), changes)
        return d
      })
    },
    deleteHabit(id) {
      update((d) => {
        d.habits = d.habits.filter((h) => h.id !== id)
        return d
      })
    },

    // Daily check-in + journal
    saveEntry(date, changes) {
      update((d) => {
        d.entries[date] = { ...(d.entries[date] || {}), ...changes }
        return d
      })
    },

    // Goals
    addGoal(goal) {
      update((d) => {
        d.goals.push({ id: uid(), done: false, steps: [], ...goal })
        return d
      })
    },
    editGoal(id, changes) {
      update((d) => {
        Object.assign(d.goals.find((g) => g.id === id), changes)
        return d
      })
    },
    deleteGoal(id) {
      update((d) => {
        d.goals = d.goals.filter((g) => g.id !== id)
        return d
      })
    },
    addStep(goalId, text) {
      update((d) => {
        d.goals.find((g) => g.id === goalId).steps.push({ id: uid(), text, done: false })
        return d
      })
    },
    toggleStep(goalId, stepId) {
      update((d) => {
        const step = d.goals.find((g) => g.id === goalId).steps.find((s) => s.id === stepId)
        step.done = !step.done
        step.doneAt = step.done ? todayKey() : null
        return d
      })
    },
    deleteStep(goalId, stepId) {
      update((d) => {
        const goal = d.goals.find((g) => g.id === goalId)
        goal.steps = goal.steps.filter((s) => s.id !== stepId)
        return d
      })
    },

    // Game: remember which level/badges have been celebrated already
    markSeen(level, badgeIds) {
      update((d) => {
        d.seen = { level, badges: badgeIds }
        return d
      })
    },

    // Backup
    replaceAll(newData) {
      setData({ ...DEFAULT_DATA, ...newData })
    },
  }

  return [data, actions, status]
}

// Consecutive days the habit was done. Today not done yet doesn't break the streak.
export function streak(checks, habitId) {
  let day = todayKey()
  if (!checks[day]?.[habitId]) day = addDays(day, -1)
  let count = 0
  while (checks[day]?.[habitId]) {
    count++
    day = addDays(day, -1)
  }
  return count
}

export function bestStreak(checks, habitId) {
  const days = Object.keys(checks)
    .filter((k) => checks[k][habitId])
    .sort()
  let best = 0
  let run = 0
  let prev = null
  for (const day of days) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    prev = day
  }
  return best
}
