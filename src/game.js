// Everything game-related is calculated from your data, so it can never get out of sync:
// untick a habit and its XP goes away again.
import { addDays, todayKey } from './dates.js'
import { bestStreak } from './store.js'

export const XP = {
  habit: 10,
  perfectDay: 25,
  reflection: 15,
  step: 20,
  goal: 100,
  allQuests: 50,
}

const REFLECT_FIELDS = ['gratitude', 'win', 'improve', 'notes']

export const RANKS = [
  { level: 1, name: 'Seedling', icon: '🌱' },
  { level: 3, name: 'Sprout', icon: '🌿' },
  { level: 5, name: 'Sapling', icon: '🪴' },
  { level: 8, name: 'Young Tree', icon: '🌳' },
  { level: 12, name: 'Mighty Oak', icon: '🌲' },
  { level: 17, name: 'Forest Guardian', icon: '🏞️' },
  { level: 23, name: 'Mountain', icon: '🏔️' },
  { level: 30, name: 'Legend', icon: '👑' },
]

// Total XP needed to reach a level: L2 = 100, L3 = 300, L4 = 600, L5 = 1000 …
export const xpForLevel = (level) => 50 * level * (level - 1)

export function levelFromXp(xp) {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  const start = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, into: xp - start, needed: next - start, progress: (xp - start) / (next - start) }
}

export function rankFor(level) {
  return [...RANKS].reverse().find((r) => level >= r.level)
}

const hasReflection = (entry) => !!entry && REFLECT_FIELDS.some((k) => entry[k]?.trim())

function dayInfo(data, day, habits) {
  const checked = habits.filter((h) => data.checks[day]?.[h.id]).length
  const perfect = habits.length > 0 && checked === habits.length
  const reflected = hasReflection(data.entries[day])
  const steps = data.goals.reduce((n, g) => n + g.steps.filter((s) => s.done && s.doneAt === day).length, 0)
  return { checked, perfect, reflected, steps, allQuests: perfect && reflected && steps > 0 }
}

export function questsFor(data, day = todayKey()) {
  const habits = data.habits.filter((h) => !h.archived)
  const info = dayInfo(data, day, habits)
  return {
    list: [
      { id: 'habits', icon: '✅', text: 'Complete all your habits', done: info.perfect, xp: XP.perfectDay, progress: `${info.checked}/${habits.length}` },
      { id: 'reflect', icon: '✍️', text: 'Write a reflection', done: info.reflected, xp: XP.reflection },
      { id: 'step', icon: '🎯', text: 'Finish one goal step', done: info.steps > 0, xp: XP.step },
    ],
    allDone: info.allQuests,
  }
}

// Consecutive days with at least one habit done (today not done yet doesn't break it)
export function dayStreak(data) {
  const any = (d) => Object.values(data.checks[d] || {}).some(Boolean)
  let day = todayKey()
  if (!any(day)) day = addDays(day, -1)
  let n = 0
  while (any(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

export function computeGame(data) {
  const habits = data.habits.filter((h) => !h.archived)
  const days = new Set([...Object.keys(data.checks), ...Object.keys(data.entries)])
  data.goals.forEach((g) => g.steps.forEach((s) => s.doneAt && days.add(s.doneAt)))

  let totalChecks = 0
  let perfectDays = 0
  let reflections = 0
  let questDays = 0
  for (const day of days) {
    totalChecks += Object.values(data.checks[day] || {}).filter(Boolean).length
    const info = dayInfo(data, day, habits)
    if (info.perfect) perfectDays++
    if (info.reflected) reflections++
    if (info.allQuests) questDays++
  }
  const stepsDone = data.goals.reduce((n, g) => n + g.steps.filter((s) => s.done).length, 0)
  const goalsDone = data.goals.filter((g) => g.done).length

  const xp =
    totalChecks * XP.habit +
    perfectDays * XP.perfectDay +
    reflections * XP.reflection +
    stepsDone * XP.step +
    goalsDone * XP.goal +
    questDays * XP.allQuests

  const lvl = levelFromXp(xp)
  const best = Math.max(0, ...data.habits.map((h) => bestStreak(data.checks, h.id)))
  const stats = { xp, ...lvl, totalChecks, perfectDays, reflections, stepsDone, goalsDone, questDays, bestStreak: best, goals: data.goals.length }

  const badges = BADGES.map((b) => ({ ...b, unlocked: b.test(stats) }))
  return { ...stats, rank: rankFor(lvl.level), badges, streak: dayStreak(data) }
}

export const BADGES = [
  { id: 'first', icon: '👟', name: 'First Step', desc: 'Complete your first habit', test: (s) => s.totalChecks >= 1 },
  { id: 'streak3', icon: '🔥', name: 'On Fire', desc: '3-day habit streak', test: (s) => s.bestStreak >= 3 },
  { id: 'streak7', icon: '⚡', name: 'Week Warrior', desc: '7-day habit streak', test: (s) => s.bestStreak >= 7 },
  { id: 'streak30', icon: '💎', name: 'Unstoppable', desc: '30-day habit streak', test: (s) => s.bestStreak >= 30 },
  { id: 'perfect1', icon: '⭐', name: 'Perfect Day', desc: 'Do all habits in one day', test: (s) => s.perfectDays >= 1 },
  { id: 'perfect10', icon: '🌟', name: 'Perfectionist', desc: '10 perfect days', test: (s) => s.perfectDays >= 10 },
  { id: 'quests1', icon: '🎁', name: 'Questmaster', desc: 'Finish all daily quests', test: (s) => s.questDays >= 1 },
  { id: 'journal1', icon: '✍️', name: 'Dear Diary', desc: 'Write your first reflection', test: (s) => s.reflections >= 1 },
  { id: 'journal10', icon: '📚', name: 'Deep Thinker', desc: '10 reflections', test: (s) => s.reflections >= 10 },
  { id: 'goal', icon: '🗺️', name: 'Big Dreamer', desc: 'Set your first goal', test: (s) => s.goals >= 1 },
  { id: 'steps10', icon: '🧗', name: 'Climber', desc: 'Finish 10 goal steps', test: (s) => s.stepsDone >= 10 },
  { id: 'goaldone', icon: '🏆', name: 'Achiever', desc: 'Achieve a goal', test: (s) => s.goalsDone >= 1 },
  { id: 'checks100', icon: '💯', name: 'Centurion', desc: '100 habit checks', test: (s) => s.totalChecks >= 100 },
  { id: 'level5', icon: '🚀', name: 'Rising Star', desc: 'Reach level 5', test: (s) => s.level >= 5 },
  { id: 'level10', icon: '👑', name: 'Royalty', desc: 'Reach level 10', test: (s) => s.level >= 10 },
]
