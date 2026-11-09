import { addDays, todayKey, weekday, weekStart, WEEKDAYS } from './dates.js'

// ── Scheduling ───────────────────────────────────────────────────────────────

export function describeSchedule(s) {
  if (s.type === 'daily') return 'Every day'
  if (s.type === 'weekly') return `${s.times}× per week`
  if (s.days.length === 7) return 'Every day'
  if (s.days.join() === '0,1,2,3,4') return 'Weekdays'
  if (s.days.join() === '5,6') return 'Weekends'
  return s.days.map((d) => WEEKDAYS[d]).join(', ')
}

export const isDone = (data, h, day) => !!data.checks[day]?.[h.id]

// Fixed-day habits are expected on their days; weekly habits are flexible.
export function isScheduled(h, day) {
  if (h.schedule.type === 'daily') return true
  if (h.schedule.type === 'days') return h.schedule.days.includes(weekday(day))
  return false
}

// On a Low Energy day only core habits count, so the rest can't break a streak.
export const isExcused = (data, h, day) => !!data.lowEnergy[day] && !h.core

export function weekCount(data, h, day) {
  const start = weekStart(day)
  let n = 0
  for (let i = 0; i < 7; i++) if (isDone(data, h, addDays(start, i))) n++
  return n
}

export const active = (data) => data.habits.filter((h) => !h.archived)

// Habits to show on a given day (today by default)
export function habitsForDay(data, day = todayKey(), lowEnergy = !!data.lowEnergy[day]) {
  return active(data)
    .filter((h) => (lowEnergy ? h.core : true))
    .filter((h) => {
      if (h.schedule.type === 'weekly') return weekCount(data, h, day) < h.schedule.times || isDone(data, h, day)
      return isScheduled(h, day) || isDone(data, h, day)
    })
}

// Share of the day's expected habits that were done (null when nothing was expected)
export function dayCompletion(data, day) {
  const habits = active(data).filter((h) => h.createdAt <= day && !isExcused(data, h, day))
  const fixed = habits.filter((h) => isScheduled(h, day))
  const flexDone = habits.filter((h) => h.schedule.type === 'weekly' && isDone(data, h, day))
  const total = fixed.length + flexDone.length
  if (!total) return null
  return (fixed.filter((h) => isDone(data, h, day)).length + flexDone.length) / total
}

// ── Streaks with freezes ─────────────────────────────────────────────────────
// Freezes: each habit may miss up to `freezesPerWeek` expected days per week
// without losing its streak. Frozen days keep the streak alive but don't add to it.

export function streakInfo(data, h, today = todayKey()) {
  const perWeek = data.settings.freezesPerWeek ?? 1
  const created = h.createdAt || '2000-01-01'
  const frozen = new Set()

  if (h.schedule.type === 'weekly') {
    const thisWeek = weekCount(data, h, today)
    let count = thisWeek >= h.schedule.times ? 1 : 0 // current week only counts once it's met
    let wk = addDays(weekStart(today), -7)
    for (let i = 0; i < 260 && addDays(wk, 6) >= created; i++) {
      const n = weekCount(data, h, wk)
      if (n >= h.schedule.times) count++
      else if (h.schedule.times - n <= perWeek && n > 0) frozen.add(wk)
      else break
      wk = addDays(wk, -7)
    }
    return { count, unit: 'week', frozen, freezesLeft: perWeek }
  }

  const usedPerWeek = {}
  let day = today
  let count = 0
  if (!isDone(data, h, day)) day = addDays(day, -1) // today isn't over yet
  for (let i = 0; i < 1000 && day >= created; i++) {
    if (isDone(data, h, day)) count++
    else if (isScheduled(h, day) && !isExcused(data, h, day)) {
      const wk = weekStart(day)
      if ((usedPerWeek[wk] || 0) < perWeek) {
        usedPerWeek[wk] = (usedPerWeek[wk] || 0) + 1
        frozen.add(day)
      } else break
    }
    day = addDays(day, -1)
  }
  const used = usedPerWeek[weekStart(today)] || 0
  return { count, unit: 'day', frozen, freezesLeft: Math.max(0, perWeek - used) }
}

export const streak = (data, h) => streakInfo(data, h).count
export const bestStreak = (data, h) => Math.max(streak(data, h), data.best[h.id] || 0)
