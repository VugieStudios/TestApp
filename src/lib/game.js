// Gamification. All XP is calculated from what you actually did, per day, so it
// can't be farmed (untick something and the XP disappears) and reviews can show
// how much XP you earned in any week or month.
import { todayKey, weekStart } from './dates.js'
import { active, bestStreak, dayCompletion, habitsForDay, isDone, streak } from './habits.js'
import { microGoals } from './goals.js'

export const XP = {
  habit: 10,
  completeDay: 20,
  step: 20,
  goal: 100,
  task: 5,
  journal: 15,
  focusMinute: 1,
  focusSession: 10,
  kick: 5,
  weeklyReview: 50,
  monthlyReview: 100,
  allQuests: 40,
  streak7: 50,
  streak30: 150,
  streak100: 500,
}

const JOURNAL_FIELDS = ['win', 'drain', 'gratitude', 'deep', 'notes', 'improve']
export const hasJournal = (e) => !!e && JOURNAL_FIELDS.some((k) => e[k]?.trim())

export const RANKS = [
  { level: 1, name: 'Novice' },
  { level: 3, name: 'Apprentice' },
  { level: 6, name: 'Adept' },
  { level: 10, name: 'Practitioner' },
  { level: 15, name: 'Expert' },
  { level: 21, name: 'Master' },
  { level: 28, name: 'Grandmaster' },
  { level: 36, name: 'Legend' },
]

export const xpForLevel = (level) => 50 * level * (level - 1)

export function levelFromXp(xp) {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  const start = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, into: xp - start, needed: next - start, progress: (xp - start) / (next - start) }
}

export const rankFor = (level) => [...RANKS].reverse().find((r) => level >= r.level)

// ── Daily quests ─────────────────────────────────────────────────────────────

function questState(data, day) {
  const low = !!data.lowEnergy[day]
  const habits = habitsForDay(data, day, low)
  const habitsDone = habits.filter((h) => isDone(data, h, day)).length
  const progress =
    data.goals.some((g) => g.steps.some((s) => s.done && s.doneAt === day)) ||
    data.focus.some((f) => f.date === day && f.minutes >= 15) ||
    data.tasks.some((t) => t.done && t.doneAt === day)
  const entry = data.entries[day]
  const reflect = hasJournal(entry)
  return { low, habits, habitsDone, allHabits: habits.length > 0 && habitsDone === habits.length, progress, reflect }
}

export function questsFor(data, day = todayKey()) {
  const q = questState(data, day)
  const list = [
    { id: 'habits', text: q.low ? 'Do your core habits' : 'Complete today’s habits', done: q.allHabits, xp: XP.completeDay, progress: `${q.habitsDone}/${q.habits.length}` },
    { id: 'progress', text: 'Move a goal forward (micro-goal, task or 15 min focus)', done: q.progress, xp: XP.step },
    { id: 'reflect', text: q.low ? 'Write one line: how was today?' : 'Reflect in your journal', done: q.reflect, xp: XP.journal },
  ]
  if (q.low) list.splice(1, 1) // low energy: no pressure to make progress
  return { list, allDone: list.every((x) => x.done), low: q.low }
}

// ── XP per day ───────────────────────────────────────────────────────────────

export function xpByDay(data) {
  const xp = {}
  const add = (day, n) => day && (xp[day] = (xp[day] || 0) + n)

  for (const [day, checks] of Object.entries(data.checks)) {
    add(day, Object.values(checks).filter(Boolean).length * XP.habit)
    const c = dayCompletion(data, day)
    if (c === 1) add(day, XP.completeDay)
  }
  for (const g of data.goals) {
    g.steps.forEach((s) => s.done && add(s.doneAt || g.createdAt, XP.step))
    if (g.done) add(g.doneAt || todayKey(), XP.goal)
  }
  data.tasks.forEach((t) => t.done && add(t.doneAt, XP.task))
  for (const [day, e] of Object.entries(data.entries)) {
    if (hasJournal(e)) add(day, XP.journal)
  }
  data.focus.forEach((f) => add(f.date, f.minutes * XP.focusMinute + (f.minutes >= 20 ? XP.focusSession : 0)))
  data.kicks.forEach((k) => add(k.date, XP.kick))
  for (const [key, day] of Object.entries(data.reviews)) add(day, key.startsWith('W') ? XP.weeklyReview : XP.monthlyReview)
  const questDays = new Set([...Object.keys(data.checks), ...Object.keys(data.entries)])
  for (const day of questDays) if (questsFor(data, day).allDone) add(day, XP.allQuests)
  return xp
}

// Streak rewards are one-off bonuses based on the best streak ever reached
function streakBonus(data) {
  let total = 0
  for (const h of data.habits) {
    const b = bestStreak(data, h)
    const unitDays = h.schedule.type === 'weekly' ? 7 : 1
    const days = b * unitDays
    if (days >= 7) total += XP.streak7
    if (days >= 30) total += XP.streak30
    if (days >= 100) total += XP.streak100
  }
  return total
}

// ── Everything for the UI ───────────────────────────────────────────────────

export function computeGame(data) {
  const byDay = xpByDay(data)
  const xp = Object.values(byDay).reduce((a, b) => a + b, 0) + streakBonus(data)
  const lvl = levelFromXp(xp)
  const habits = active(data)
  const streaks = habits.map((h) => ({ habit: h, current: streak(data, h), best: bestStreak(data, h) }))
  const best = Math.max(0, ...data.habits.map((h) => bestStreak(data, h)))

  const stats = {
    xp,
    ...lvl,
    xpToday: byDay[todayKey()] || 0,
    xpWeek: Object.entries(byDay).filter(([d]) => d >= weekStart(todayKey())).reduce((a, [, v]) => a + v, 0),
    totalChecks: Object.values(data.checks).reduce((n, c) => n + Object.values(c).filter(Boolean).length, 0),
    completeDays: Object.keys(data.checks).filter((d) => dayCompletion(data, d) === 1).length,
    stepsDone: data.goals.reduce((n, g) => n + g.steps.filter((s) => s.done).length, 0),
    goalsDone: data.goals.filter((g) => g.done).length,
    goals: data.goals.length,
    tasksDone: data.tasks.filter((t) => t.done).length,
    focusMinutes: data.focus.reduce((n, f) => n + f.minutes, 0),
    focusSessions: data.focus.filter((f) => f.minutes >= 20).length,
    kicks: data.kicks.length,
    journals: Object.values(data.entries).filter(hasJournal).length,
    reviews: Object.keys(data.reviews).length,
    dumps: data.dumps.length,
    lowDays: Object.keys(data.lowEnergy).length,
    bestStreak: best,
    microToday: microGoals(data).length,
  }
  return {
    ...stats,
    byDay,
    rank: rankFor(lvl.level),
    streaks,
    badges: BADGES.map((b) => ({ ...b, unlocked: b.test(stats) })),
  }
}

export const BADGES = [
  { id: 'first', icon: '◆', name: 'First Step', desc: 'Complete your first habit', test: (s) => s.totalChecks >= 1 },
  { id: 'streak7', icon: '🔥', name: 'Week Strong', desc: '7-day streak on a habit', test: (s) => s.bestStreak >= 7 },
  { id: 'streak30', icon: '⚡', name: 'Unbroken', desc: '30-day streak on a habit', test: (s) => s.bestStreak >= 30 },
  { id: 'streak100', icon: '💎', name: 'Centennial', desc: '100-day streak', test: (s) => s.bestStreak >= 100 },
  { id: 'complete10', icon: '★', name: 'Consistent', desc: '10 fully completed days', test: (s) => s.completeDays >= 10 },
  { id: 'focus1', icon: '⏱', name: 'Deep Work', desc: 'Finish a focus session', test: (s) => s.focusSessions >= 1 },
  { id: 'focus600', icon: '🧠', name: 'Flow State', desc: '10 hours of focus', test: (s) => s.focusMinutes >= 600 },
  { id: 'kick5', icon: '🚀', name: 'Just Start', desc: 'Use the 1-minute rule 5×', test: (s) => s.kicks >= 5 },
  { id: 'dump10', icon: '🌀', name: 'Clear Mind', desc: '10 brain dumps', test: (s) => s.dumps >= 10 },
  { id: 'journal7', icon: '✎', name: 'Reflective', desc: 'Journal on 7 days', test: (s) => s.journals >= 7 },
  { id: 'goal1', icon: '◎', name: 'Visionary', desc: 'Set your first goal', test: (s) => s.goals >= 1 },
  { id: 'steps25', icon: '⛰', name: 'Climber', desc: 'Finish 25 micro-goals', test: (s) => s.stepsDone >= 25 },
  { id: 'goaldone', icon: '🏆', name: 'Achiever', desc: 'Achieve a goal', test: (s) => s.goalsDone >= 1 },
  { id: 'review1', icon: '📊', name: 'Self-Aware', desc: 'Complete a review', test: (s) => s.reviews >= 1 },
  { id: 'low1', icon: '🔋', name: 'Self-Care', desc: 'Use Low Energy Mode', test: (s) => s.lowDays >= 1 },
  { id: 'level10', icon: '♛', name: 'Practitioner', desc: 'Reach level 10', test: (s) => s.level >= 10 },
]
