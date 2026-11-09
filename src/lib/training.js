// Training: a weekly workout scheme, workout logging and progression.
//
// data.training = {
//   sports: ['gym', 'ride', ...],
//   days: [[sessionId, ...] × 7],          Mon..Sun
//   sessions: [{ id, name, sport, minutes, details, exercises: [{ id, name, sets, reps, weight }] }],
//   logs: { 'YYYY-MM-DD': { [sessionId]: { done, source: 'manual'|'garmin', sets: { [exerciseId]: [{ weight, reps, done }] } } } }
// }
import { todayKey, weekday, addDays, weekStart } from './dates.js'
import { uid } from './store.js'

export const SPORTS = {
  gym: { label: 'Gym / strength', short: 'Gym', icon: '🏋️', garmin: 'strength' },
  ride: { label: 'Cycling', short: 'Ride', icon: '🚴', garmin: 'ride' },
  run: { label: 'Running', short: 'Run', icon: '🏃', garmin: 'run' },
  other: { label: 'Mobility / other', short: 'Mobility', icon: '🧘', garmin: null },
}

export const emptyTraining = () => ({ sports: [], days: [[], [], [], [], [], [], []], sessions: [], logs: {}, createdAt: todayKey() })

// ── Templates ───────────────────────────────────────────────────────────────

const ex = (name, sets, reps) => ({ id: uid(), name, sets, reps: String(reps), weight: null })

const GYM = {
  'Full body A': () => [ex('Squat', 3, 8), ex('Bench press', 3, 8), ex('Bent-over row', 3, 10), ex('Plank', 3, '45s')],
  'Full body B': () => [ex('Deadlift', 3, 5), ex('Overhead press', 3, 8), ex('Lat pulldown', 3, 10), ex('Walking lunges', 3, 10)],
  'Full body C': () => [ex('Leg press', 3, 10), ex('Incline dumbbell press', 3, 10), ex('Seated cable row', 3, 10), ex('Face pulls', 3, 15)],
  'Upper A': () => [ex('Bench press', 4, 6), ex('Bent-over row', 4, 8), ex('Overhead press', 3, 8), ex('Lat pulldown', 3, 10), ex('Biceps curl', 2, 12), ex('Triceps pushdown', 2, 12)],
  'Lower A': () => [ex('Squat', 4, 6), ex('Romanian deadlift', 3, 8), ex('Leg press', 3, 10), ex('Calf raises', 3, 15), ex('Plank', 3, '45s')],
  'Upper B': () => [ex('Incline dumbbell press', 3, 10), ex('Pull-ups', 3, 'max'), ex('Seated cable row', 3, 10), ex('Lateral raises', 3, 15), ex('Dips', 3, 10)],
  'Lower B': () => [ex('Deadlift', 3, 5), ex('Bulgarian split squat', 3, 10), ex('Leg curl', 3, 12), ex('Hip thrust', 3, 10), ex('Hanging leg raise', 3, 12)],
}
const GYM_SPLITS = {
  1: ['Full body A'],
  2: ['Full body A', 'Full body B'],
  3: ['Full body A', 'Full body B', 'Full body C'],
  4: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
  5: ['Upper A', 'Lower A', 'Full body C', 'Upper B', 'Lower B'],
  6: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Full body A', 'Full body B'],
}

const RIDES = {
  endurance: ['Endurance ride', 75, 'Zone 2: steady, you can still talk. Cadence 85–95 rpm.'],
  threshold: ['Threshold intervals', 60, 'Warm up 15 min · 4 × 8 min hard but steady (threshold), 4 min easy between · cool down 10 min.'],
  vo2: ['VO2 max intervals', 60, 'Warm up 15 min · 5 × 4 min very hard, 4 min easy between · cool down 10 min.'],
  long: ['Long ride', 150, 'Zone 2 with some hills. Eat and drink every 45 min.'],
  recovery: ['Recovery spin', 45, 'Very easy, Zone 1. Just loosen the legs.'],
}
const RIDE_SPLITS = {
  1: ['long'],
  2: ['threshold', 'long'],
  3: ['endurance', 'threshold', 'long'],
  4: ['endurance', 'threshold', 'recovery', 'long'],
  5: ['endurance', 'threshold', 'endurance', 'vo2', 'long'],
  6: ['endurance', 'threshold', 'recovery', 'vo2', 'endurance', 'long'],
}
const RUNS = {
  easy: ['Easy run', 40, 'Conversational pace. Finish feeling fresh.'],
  intervals: ['Run intervals', 45, 'Warm up 10 min · 6 × 3 min fast, 2 min jog between · cool down.'],
  long: ['Long run', 70, 'Easy pace, a bit longer than usual.'],
}
const RUN_SPLITS = { 1: ['long'], 2: ['easy', 'long'], 3: ['easy', 'intervals', 'long'], 4: ['easy', 'intervals', 'easy', 'long'], 5: ['easy', 'intervals', 'easy', 'easy', 'long'], 6: ['easy', 'intervals', 'easy', 'easy', 'intervals', 'long'] }

export function newSession(sport) {
  const s = { id: uid(), sport, name: SPORTS[sport].short, minutes: 45, details: '', exercises: [] }
  if (sport === 'gym') s.exercises = [ex('Bench press', 3, 8)]
  return s
}

// ── Generator ───────────────────────────────────────────────────────────────
// choice = { gym: [weekdays], ride: [weekdays], run: [...], other: [...] }, focus: 'strength'|'muscle'|'general', level: 'beginner'|'intermediate'

export function generatePlan({ choice, focus = 'general', level = 'intermediate' }) {
  const t = emptyTraining()
  t.sports = Object.keys(choice).filter((k) => choice[k].length)
  const scale = level === 'beginner' ? 0.75 : 1

  const place = (days, items, makeSession) => {
    // put the "long" session on the latest weekend day (or last day)
    const sorted = [...days].sort((a, b) => a - b)
    const order = [...items]
    const longIdx = order.findIndex((x) => x === 'long')
    let slots = sorted
    if (longIdx >= 0) {
      const weekendDay = [...sorted].reverse().find((d) => d >= 5) ?? sorted.at(-1)
      const longItem = order.splice(longIdx, 1)[0]
      slots = sorted.filter((d) => d !== weekendDay)
      t.days[weekendDay].push(makeSession(longItem).id)
    }
    slots.forEach((d, i) => order[i] && t.days[d].push(makeSession(order[i]).id))
  }

  if (choice.gym?.length) {
    const split = GYM_SPLITS[Math.min(6, choice.gym.length)]
    place(choice.gym, split, (name) => {
      let exercises = GYM[name]()
      if (focus === 'strength') exercises = exercises.map((e, i) => (i === 0 ? { ...e, sets: 5, reps: '5' } : e))
      if (focus === 'muscle') exercises = exercises.map((e, i) => (i > 0 && /^\d+$/.test(e.reps) ? { ...e, reps: String(Math.max(Number(e.reps), 10)) } : e))
      if (level === 'beginner') exercises = exercises.map((e) => ({ ...e, sets: Math.max(2, e.sets - 1) }))
      const s = { id: uid(), sport: 'gym', name, minutes: Math.round((exercises.length * 11) * scale), details: 'Warm up 5–10 min. Rest 2–3 min on big lifts, 1–2 min on the rest.', exercises }
      t.sessions.push(s)
      return s
    })
  }
  if (choice.ride?.length) {
    place(choice.ride, RIDE_SPLITS[Math.min(6, choice.ride.length)], (key) => {
      const [name, min, details] = RIDES[key]
      const s = { id: uid(), sport: 'ride', name, minutes: Math.round(min * scale), details, exercises: [] }
      t.sessions.push(s)
      return s
    })
  }
  if (choice.run?.length) {
    place(choice.run, RUN_SPLITS[Math.min(6, choice.run.length)], (key) => {
      const [name, min, details] = RUNS[key]
      const s = { id: uid(), sport: 'run', name, minutes: Math.round(min * scale), details, exercises: [] }
      t.sessions.push(s)
      return s
    })
  }
  if (choice.other?.length) {
    const s = { id: uid(), sport: 'other', name: 'Mobility & core', minutes: 20, details: 'Hips, hamstrings, shoulders + 3 rounds of plank, side plank and dead bugs.', exercises: [] }
    t.sessions.push(s)
    choice.other.forEach((d) => t.days[d].push(s.id))
  }
  return t
}

// ── Queries ─────────────────────────────────────────────────────────────────

export const hasPlan = (data) => !!data.training?.sessions?.length
export const sessionById = (data, id) => data.training?.sessions.find((s) => s.id === id)

export function sessionsForDay(data, day = todayKey()) {
  if (!hasPlan(data)) return []
  if (data.training.createdAt && day < data.training.createdAt) return [] // the scheme didn't exist yet
  return (data.training.days[weekday(day)] || []).map((id) => sessionById(data, id)).filter(Boolean)
}

export const logFor = (data, day, sessionId) => data.training?.logs?.[day]?.[sessionId]
export const isSessionDone = (data, day, sessionId) => !!logFor(data, day, sessionId)?.done

const norm = (s) => s.trim().toLowerCase()
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

// Most recent logged sets for an exercise (matched by name across sessions), before `beforeDay`
export function lastPerformance(data, exerciseName, beforeDay = todayKey()) {
  if (!data.training) return null
  const days = Object.keys(data.training.logs).filter((d) => d < beforeDay).sort().reverse()
  for (const d of days) {
    for (const [sid, log] of Object.entries(data.training.logs[d])) {
      const session = sessionById(data, sid)
      if (!session) continue
      for (const e of session.exercises) {
        if (norm(e.name) !== norm(exerciseName)) continue
        const sets = (log.sets?.[e.id] || []).filter((s) => s.done && (num(s.weight) !== null || num(s.reps) !== null))
        if (sets.length) return { date: d, sets, target: e }
      }
    }
  }
  return null
}

// Progressive overload: hit all target reps last time → add weight
export function suggestion(data, exercise) {
  const last = lastPerformance(data, exercise.name)
  if (!last) return exercise.weight ? { weight: exercise.weight, why: 'target weight' } : null
  const weights = last.sets.map((s) => num(s.weight)).filter((w) => w !== null)
  const top = weights.length ? Math.max(...weights) : null
  const target = Number(exercise.reps)
  const hitAll = Number.isFinite(target) && last.sets.length >= exercise.sets && last.sets.every((s) => num(s.reps) >= target)
  if (top === null) return null
  if (hitAll) {
    const inc = /dumbbell|curl|raise|fly|pushdown|face/i.test(exercise.name) ? 1 : 2.5
    return { weight: top + inc, why: `you hit all reps last time, add ${inc} kg` }
  }
  return { weight: top, why: 'match last time and beat the reps' }
}

export const e1rm = (w, r) => (w && r ? Math.round(w * (1 + r / 30)) : null)

// Progress per exercise: best set and last session
export function exerciseProgress(data) {
  const map = {}
  if (!data.training) return []
  for (const [d, logs] of Object.entries(data.training.logs)) {
    for (const [sid, log] of Object.entries(logs)) {
      const session = sessionById(data, sid)
      if (!session) continue
      for (const e of session.exercises) {
        const sets = (log.sets?.[e.id] || []).filter((s) => s.done && num(s.weight))
        if (!sets.length) continue
        const key = norm(e.name)
        map[key] ??= { name: e.name, history: [] }
        const top = sets.reduce((a, b) => (num(b.weight) > num(a.weight) || (num(b.weight) === num(a.weight) && num(b.reps) > num(a.reps)) ? b : a))
        map[key].history.push({ date: d, weight: num(top.weight), reps: num(top.reps), e1rm: e1rm(num(top.weight), num(top.reps)) })
      }
    }
  }
  return Object.values(map)
    .map((x) => {
      x.history.sort((a, b) => a.date.localeCompare(b.date))
      x.best = x.history.reduce((a, b) => ((b.e1rm || 0) > (a.e1rm || 0) ? b : a))
      x.last = x.history.at(-1)
      x.first = x.history[0]
      return x
    })
    .sort((a, b) => b.last.date.localeCompare(a.last.date))
}

// Planned vs done for a date range
export function adherence(data, start, end) {
  if (!hasPlan(data)) return null
  let planned = 0
  let done = 0
  for (let d = start; d <= end && d <= todayKey(); d = addDays(d, 1)) {
    for (const s of sessionsForDay(data, d)) {
      planned++
      if (isSessionDone(data, d, s.id)) done++
    }
  }
  return { planned, done }
}

export const sessionsDone = (data) =>
  Object.values(data.training?.logs || {}).reduce((n, l) => n + Object.values(l).filter((x) => x.done).length, 0)

export const thisWeekAdherence = (data) => adherence(data, weekStart(todayKey()), addDays(weekStart(todayKey()), 6))
