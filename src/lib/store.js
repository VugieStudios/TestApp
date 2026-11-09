import { useEffect, useRef, useState } from 'react'
import { todayKey } from './dates.js'
import { supabase } from './supabase.js'

// ─────────────────────────────────────────────────────────────────────────────
// Data model (version 2). Everything lives in one JSON object that is saved to
// the user's row in Supabase, with a copy in the browser for instant/offline use.
//
// habits:   [{ id, name, emoji, schedule, core, archived, createdAt }]
//           schedule = { type: 'daily' } | { type: 'days', days: [0..6] } | { type: 'weekly', times: n }
// checks:   { 'YYYY-MM-DD': { habitId: true } }
// goals:    [{ id, title, why, horizon: 'short'|'long', category, deadline, done, doneAt, createdAt,
//              steps: [{ id, text, done, doneAt, plannedFor, minutes }] }]
// tasks:    [{ id, text, done, doneAt, createdAt, fromDump }]
// dumps:    [{ id, text, createdAt, processed }]
// entries:  { 'YYYY-MM-DD': { win, drain, gratitude, deep, notes } }
// focus:    [{ id, date, minutes, label, targetType, targetId }]
// kicks:    [{ id, date, label }]          1-minute rule starts
// lowEnergy:{ 'YYYY-MM-DD': true }
// reviews:  { 'W:2026-11-02': date, 'M:2026-10': date }   completed reviews
// best:     { habitId: longest streak }
// settings: { freezesPerWeek, focusMinutes, breakMinutes, dashboard: [{ id, hidden }] }
// seen:     { level, badges: [] }             celebrations already shown
// ─────────────────────────────────────────────────────────────────────────────

const LEGACY_KEY = 'grow-data-v1'
const cacheKey = (userId) => `grow-cache-${userId}`

export const DEFAULT_DASHBOARD = [
  'player',
  'quests',
  'habits',
  'micro',
  'focus',
  'tasks',
  'journal',
  'dump',
  'grid',
  'insights',
].map((id) => ({ id, hidden: false }))

export const DEFAULT_SETTINGS = {
  freezesPerWeek: 1,
  focusMinutes: 25,
  breakMinutes: 5,
  dashboard: DEFAULT_DASHBOARD,
}

function freshData() {
  const today = todayKey()
  return {
    version: 2,
    habits: [
      { id: 'h1', name: 'Move for 30 minutes', emoji: '🚴', schedule: { type: 'weekly', times: 4 }, core: false, archived: false, createdAt: today },
      { id: 'h2', name: 'Read 10 pages', emoji: '📖', schedule: { type: 'daily' }, core: true, archived: false, createdAt: today },
      { id: 'h3', name: 'No phone in bed', emoji: '🌙', schedule: { type: 'daily' }, core: true, archived: false, createdAt: today },
    ],
    checks: {},
    goals: [],
    tasks: [],
    dumps: [],
    entries: {},
    focus: [],
    kicks: [],
    lowEnergy: {},
    reviews: {},
    best: {},
    settings: DEFAULT_SETTINGS,
    seen: null,
  }
}

// Bring any older saved data up to the current shape
export function migrate(raw) {
  if (!raw) return freshData()
  const base = freshData()
  const d = { ...base, ...raw, settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) } }

  // make sure every dashboard widget exists exactly once
  const known = new Set(d.settings.dashboard.map((w) => w.id))
  d.settings.dashboard = [
    ...d.settings.dashboard.filter((w) => DEFAULT_DASHBOARD.some((x) => x.id === w.id)),
    ...DEFAULT_DASHBOARD.filter((w) => !known.has(w.id)),
  ]

  if (!raw.version || raw.version < 2) {
    const firstCheck = Object.keys(raw.checks || {}).sort()[0] || todayKey()
    d.habits = (raw.habits || base.habits).map((h, i) => ({
      schedule: { type: 'daily' },
      core: i < 2,
      createdAt: firstCheck,
      ...h,
    }))
    d.goals = (raw.goals || []).map((g) => ({
      horizon: 'short',
      category: 'general',
      createdAt: todayKey(),
      ...g,
      steps: (g.steps || []).map((s) => ({ plannedFor: null, minutes: 25, ...s })),
    }))
    d.seen = null // XP rules changed: don't celebrate the difference
    d.version = 2
  }
  return d
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
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

export const uid = () => Math.random().toString(36).slice(2, 10)

// status: 'loading' | 'saved' | 'saving' | 'offline'
export function useStore(user) {
  const [data, setData] = useState(() => migrate(readLocal(cacheKey(user.id)) || readLocal(LEGACY_KEY)))
  const [status, setStatus] = useState('loading')
  const ready = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: row, error } = await supabase.from('user_data').select('data').eq('user_id', user.id).maybeSingle()
      if (cancelled) return
      if (error) {
        setStatus('offline')
      } else if (row) {
        setData(migrate(row.data))
        setStatus('saved')
      } else {
        const initial = migrate(readLocal(LEGACY_KEY))
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

  useEffect(() => {
    writeLocal(cacheKey(user.id), data)
    if (!ready.current) return
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from('user_data').upsert({ user_id: user.id, data, updated_at: new Date().toISOString() })
      setStatus(error ? 'offline' : 'saved')
    }, 800)
  }, [data, user.id])

  const update = (fn) =>
    setData((prev) => {
      const next = structuredClone(prev)
      return fn(next) || next
    })

  const find = (list, id) => list.find((x) => x.id === id)

  const actions = {
    // ── Habits ──
    toggleCheck(date, habitId) {
      update((d) => {
        d.checks[date] ??= {}
        if (d.checks[date][habitId]) delete d.checks[date][habitId]
        else d.checks[date][habitId] = true
      })
    },
    addHabit(habit) {
      update((d) => {
        d.habits.push({ id: uid(), emoji: '✦', core: false, archived: false, createdAt: todayKey(), schedule: { type: 'daily' }, ...habit })
      })
    },
    editHabit(id, changes) {
      update((d) => void Object.assign(find(d.habits, id), changes))
    },
    deleteHabit(id) {
      update((d) => {
        d.habits = d.habits.filter((h) => h.id !== id)
        delete d.best[id]
      })
    },
    recordBest(bests) {
      update((d) => void Object.assign(d.best, bests))
    },

    // ── Goals & micro-goals ──
    addGoal(goal) {
      update((d) => {
        d.goals.push({ id: uid(), done: false, createdAt: todayKey(), steps: [], ...goal })
      })
    },
    editGoal(id, changes) {
      update((d) => {
        const g = find(d.goals, id)
        Object.assign(g, changes)
        if ('done' in changes) g.doneAt = changes.done ? todayKey() : null
      })
    },
    deleteGoal(id) {
      update((d) => {
        d.goals = d.goals.filter((g) => g.id !== id)
      })
    },
    setSteps(goalId, steps) {
      update((d) => {
        find(d.goals, goalId).steps = steps
      })
    },
    addStep(goalId, text) {
      update((d) => {
        find(d.goals, goalId).steps.push({ id: uid(), text, done: false, doneAt: null, plannedFor: null, minutes: 25 })
      })
    },
    toggleStep(goalId, stepId) {
      update((d) => {
        const s = find(find(d.goals, goalId).steps, stepId)
        s.done = !s.done
        s.doneAt = s.done ? todayKey() : null
      })
    },
    deleteStep(goalId, stepId) {
      update((d) => {
        const g = find(d.goals, goalId)
        g.steps = g.steps.filter((s) => s.id !== stepId)
      })
    },

    // ── Tasks & brain dump ──
    addTask(text, extra = {}) {
      update((d) => {
        d.tasks.unshift({ id: uid(), text, done: false, doneAt: null, createdAt: todayKey(), ...extra })
      })
    },
    toggleTask(id) {
      update((d) => {
        const t = find(d.tasks, id)
        t.done = !t.done
        t.doneAt = t.done ? todayKey() : null
      })
    },
    deleteTask(id) {
      update((d) => {
        d.tasks = d.tasks.filter((t) => t.id !== id)
      })
    },
    addDump(text) {
      update((d) => {
        d.dumps.unshift({ id: uid(), text, createdAt: new Date().toISOString(), processed: false })
      })
    },
    dumpToTask(id) {
      update((d) => {
        const dump = find(d.dumps, id)
        dump.processed = true
        d.tasks.unshift({ id: uid(), text: dump.text, done: false, doneAt: null, createdAt: todayKey(), fromDump: true })
      })
    },
    editDump(id, changes) {
      update((d) => void Object.assign(find(d.dumps, id), changes))
    },
    deleteDump(id) {
      update((d) => {
        d.dumps = d.dumps.filter((x) => x.id !== id)
      })
    },

    // ── Journal & check-in ──
    saveEntry(date, changes) {
      update((d) => {
        d.entries[date] = { ...(d.entries[date] || {}), ...changes }
      })
    },

    // ── Focus & 1-minute rule ──
    logFocus(session) {
      update((d) => {
        d.focus.push({ id: uid(), date: todayKey(), ...session })
      })
    },
    logKick(label) {
      update((d) => {
        d.kicks.push({ id: uid(), date: todayKey(), label })
      })
    },
    completeTarget(target) {
      if (!target) return
      if (target.type === 'step') actions.toggleStep(target.goalId, target.id)
      if (target.type === 'task') actions.toggleTask(target.id)
    },

    // ── Modes, reviews, settings ──
    setLowEnergy(on, date = todayKey()) {
      update((d) => {
        if (on) d.lowEnergy[date] = true
        else delete d.lowEnergy[date]
      })
    },
    completeReview(key) {
      update((d) => {
        d.reviews[key] = todayKey()
      })
    },
    setSettings(changes) {
      update((d) => {
        d.settings = { ...d.settings, ...changes }
      })
    },
    markSeen(level, badges) {
      update((d) => {
        d.seen = { level, badges }
      })
    },
    replaceAll(newData) {
      setData(migrate(newData))
    },
    // Wipe everything and start with a clean slate (login stays the same)
    resetAll() {
      try {
        localStorage.removeItem('grow-timer')
        localStorage.removeItem(LEGACY_KEY)
      } catch {
        /* ignore */
      }
      setData({ ...freshData(), habits: [] })
    },
  }

  return [data, actions, status]
}
