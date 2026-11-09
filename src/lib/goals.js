import { addDays, daysBetween, todayKey } from './dates.js'
import { uid } from './store.js'

// ─────────────────────────────────────────────────────────────────────────────
// Automatic goal breakdown. Two strategies:
//  1. Measurable goals ("Read 12 books", "Ride 500 km", "Save €1000"): the number
//     is split into equal chunks spread over the time until the deadline.
//  2. Everything else: a proven step template for the goal's category, with the
//     steps spread evenly until the deadline.
// The user can always edit, remove or add steps before saving.
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIES = {
  learning: { label: 'Learning', icon: '📘' },
  fitness: { label: 'Fitness', icon: '🏃' },
  project: { label: 'Project / creative', icon: '🛠️' },
  finance: { label: 'Money', icon: '💶' },
  health: { label: 'Health & mind', icon: '🧘' },
  career: { label: 'Career & study', icon: '🎓' },
  general: { label: 'Other', icon: '🎯' },
}

const KEYWORDS = {
  finance: /\b(save|saving|money|invest\w*|budget|debt|income|earn|spend)\b|€|\beur\b|euro/i,
  learning: /learn|study|course|language|spanish|english|french|german|read|book|guitar|piano|skill|practi[cs]e|exam|chapter/i,
  fitness: /run|ride|cycl|bike|gym|lift|weight|kg|km|fit|train|marathon|swim|push.?up|workout|race|ftp|watt/i,
  project: /build|launch|make|create|app|website|channel|youtube|video|write|blog|business|shop|design|game|portfolio/i,
  health: /sleep|meditat|health|eat|diet|water|stress|calm|phone|screen|walk|mindful|pray|bible/i,
  career: /job|intern|cv|resume|apply|career|grade|university|rsm|semester|thesis|promotion/i,
}

export function detectCategory(title) {
  for (const [cat, re] of Object.entries(KEYWORDS)) if (re.test(title)) return cat
  return 'general'
}

const TEMPLATES = {
  learning: [
    ['Write down what "done" looks like for: {goal}', 10],
    ['Pick one main resource (course, book or video series)', 15],
    ['Block 3 learning slots in your calendar this week', 5],
    ['Learning session 1: the basics', 25],
    ['Learning session 2: go one level deeper', 25],
    ['Practice: use what you learned on something real', 25],
    ['Learning session 3', 25],
    ['Explain it out loud as if teaching someone', 15],
    ['Find your weakest spot and review it', 25],
    ['Learning session 4', 25],
    ['Final check: prove you can do it', 30],
  ],
  fitness: [
    ['Measure your starting point for: {goal}', 15],
    ['Choose a simple training plan', 15],
    ['Prepare gear and plan this week’s sessions', 10],
    ['Session 1: easy start', 30],
    ['Session 2', 30],
    ['Recovery: stretch / mobility 10 min', 10],
    ['Session 3: slightly harder', 40],
    ['Check progress against your starting point', 10],
    ['Session 4', 40],
    ['Session 5: the key workout', 45],
    ['Taper: easy session + good sleep', 20],
    ['Do it: {goal}', 60],
  ],
  project: [
    ['Write one sentence: what will exist when "{goal}" is done?', 10],
    ['List every part of the project (brain-dump it)', 15],
    ['Do the smallest first piece (15 min)', 15],
    ['Build part 1', 45],
    ['Build part 2', 45],
    ['Show it to one person and ask for feedback', 15],
    ['Improve the one thing that matters most', 45],
    ['Build part 3 / polish', 45],
    ['Final check: is it good enough to ship?', 20],
    ['Ship it 🚀', 30],
  ],
  finance: [
    ['Write down your exact target and deadline for: {goal}', 10],
    ['Check where your money goes (last 30 days)', 25],
    ['Find 2 costs you can cut or lower', 15],
    ['Set up an automatic transfer on payday', 10],
    ['Mid-way check: on track?', 10],
    ['Find one extra way to earn or save', 20],
    ['Final check and celebrate the result', 10],
  ],
  health: [
    ['Decide exactly what "{goal}" means for you', 10],
    ['Track your current behaviour for 3 days', 5],
    ['Remove one thing that makes it harder', 15],
    ['Do it for 1 day', 15],
    ['Do it 3 days in a row', 15],
    ['Reflect: what helped, what got in the way?', 10],
    ['Make it a habit in the Habits tab', 5],
    ['Keep going for a full week', 15],
  ],
  career: [
    ['Define the outcome for: {goal}', 10],
    ['Research what is needed (requirements, deadlines)', 25],
    ['Make a list of materials you need', 15],
    ['Work session 1', 45],
    ['Ask someone experienced for advice', 15],
    ['Work session 2', 45],
    ['Review and improve', 30],
    ['Submit / finish it', 20],
  ],
  general: [
    ['Write down exactly what success looks like for: {goal}', 10],
    ['Split it into 3 milestones', 15],
    ['Do the first 10-minute action', 10],
    ['Milestone 1: first concrete progress', 30],
    ['Check-in: what works, what doesn’t?', 10],
    ['Milestone 2', 30],
    ['Remove one obstacle', 15],
    ['Milestone 3', 30],
    ['Final push', 30],
    ['Reflect and celebrate', 10],
  ],
}

const UNIT = /(€\s?)?(\d+(?:[.,]\d+)?)\s*(k\b|km|kilomet\w*|books?|pages?|kgs?|kilos?|watts?|w\b|euros?|eur|€|hours?|hrs?|minutes?|min\b|lessons?|videos?|workouts?|sessions?|times|reps|chapters?|words?|push.?ups?|pull.?ups?|posts?|clients?|subscribers?|followers?)/i

const UNIT_ALIASES = { kgs: 'kg', kilo: 'kg', kilos: 'kg', w: 'W', watt: 'W', watts: 'W', min: 'min', minute: 'min', minutes: 'min', hrs: 'hours', hr: 'hours', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km' }

export function parseMeasurable(title) {
  const euro = title.match(/€\s?(\d+(?:[.,]\d+)?)/)
  if (euro) return { amount: parseFloat(euro[1].replace(',', '.')), unit: '€' }
  const m = title.match(UNIT)
  if (!m) return null
  const amount = parseFloat(m[2].replace(',', '.'))
  let unit = m[3].toLowerCase()
  if (m[1] || unit === 'eur' || unit.startsWith('euro')) unit = '€'
  unit = UNIT_ALIASES[unit] || unit
  if (unit === 'k' || !amount || amount < 2) return null
  return { amount, unit }
}

// "Level" goals: reach a number once (bench 65 kg, FTP 300 W, run 10 km).
// "Total" goals: add up to a number over time (ride 500 km in December, read 12 books).
export function guessMode(title, unit) {
  if (['kg', 'W', 'reps', 'push-ups', 'pushups', 'pull-ups', 'pullups', 'subscribers', 'followers'].includes(unit)) return 'level'
  if (/bench|squat|deadlift|lift|press|ftp|weigh|max\b|pr\b|personal best/i.test(title)) return 'level'
  if (unit === 'km' && !/\b(in|this|per|by|every|each|total)\b/i.test(title) && /\brun\b|\bswim\b/i.test(title)) return 'level'
  return 'total'
}

const STEP_SIZE = { kg: 2.5, W: 5, km: 1, min: 1, reps: 1, 'push-ups': 1, pushups: 1, 'pull-ups': 1, pullups: 1 }
const WHOLE = ['book', 'books', 'times', 'clients', 'posts', 'videos', 'lessons', 'sessions', 'workouts', 'reps', 'subscribers', 'followers', 'chapters']

const round = (n) => (n >= 10 ? Math.round(n * 2) / 2 : Math.round(n * 10) / 10)
const fmt = (n, unit) => (unit === '€' ? `€${round(n)}` : `${round(n)} ${round(n) === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit}`)
const VERBS = { '€': 'Save', km: 'Ride', books: 'Read', book: 'Read', pages: 'Read', kg: 'Lift', W: 'Hold' }

// The word right before the number: "I want to bench 65kg" -> "Bench"
function verbFor(title, unit) {
  const m = title.match(/([a-z]+)\s+(?:€\s?)?\d/i)
  const skip = /^(to|of|a|an|the|my|i|want|be|get|in|at|for|under|than|least|about)$/i
  if (m && !skip.test(m[1])) return m[1] === m[1].toUpperCase() ? m[1] : m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
  return VERBS[unit] || 'Reach'
}

export function measurableSteps(title, measure, days) {
  const { amount, unit, mode } = measure
  const start = measure.start === '' || measure.start === null || measure.start === undefined ? null : Number(measure.start)
  const verb = verbFor(title, unit)
  const weeks = Math.min(Math.max(2, Math.round(days / 7)), 20)

  if (mode === 'level') {
    const steps = []
    let from = start
    if (from === null) {
      steps.push([`Test where you are now: your current max (${unit})`, 30])
      const inc0 = STEP_SIZE[unit] || 1
      from = Math.round((amount * 0.6) / inc0) * inc0
    }
    const gap = amount - from
    if (gap <= 0) return [[`You're already at ${fmt(from, unit)}: test ${fmt(amount, unit)} to confirm 🎯`, 30]]
    const inc = STEP_SIZE[unit] || (WHOLE.includes(unit) ? 1 : gap / weeks)
    const n = Math.max(1, Math.min(12, Math.ceil(gap / inc))) // realistic increments, max 12 steps
    const per = Math.ceil(gap / n / inc) * inc
    for (let i = 1; i <= n; i++) {
      const v = Math.min(amount, from + per * i)
      steps.push([v >= amount ? `${verb} ${fmt(amount, unit)} 🎯` : `${verb} ${fmt(v, unit)}`, 45])
      if (v >= amount) break
    }
    return steps
  }

  // total
  const done = start || 0
  const left = amount - done
  if (left <= 0) return [[`You've already done ${fmt(done, unit)}. Goal reached 🎯`, 5]]
  const chunks = WHOLE.includes(unit) ? Math.max(1, Math.min(weeks, left)) : weeks
  const per = left / chunks
  const steps = [['Plan when you’ll work on it this week', 10]]
  for (let i = 1; i <= chunks; i++) {
    const cum = i === chunks ? amount : done + per * i
    steps.push([`${verb} ${fmt(per, unit)} · ${unit === '€' ? `€${round(cum)}` : round(cum)}/${fmt(amount, unit)} total`, 30])
  }
  return steps
}

export function breakdown({ title, category, deadline, horizon, measure }) {
  const today = todayKey()
  const days = deadline ? Math.max(1, daysBetween(today, deadline)) : horizon === 'long' ? 90 : 21

  let steps
  if (measure) {
    steps = measurableSteps(title, measure, days)
  } else {
    steps = TEMPLATES[category] || TEMPLATES.general
    if (horizon === 'long' && days > 60) {
      steps = [...steps.slice(0, -1), ['Monthly review: adjust the plan', 15], ...steps.slice(-1)]
    }
  }

  const gap = days / steps.length
  return steps.map(([text, minutes], i) => ({
    id: uid(),
    text: text.replaceAll('{goal}', title),
    minutes,
    done: false,
    doneAt: null,
    plannedFor: addDays(today, Math.round(i * gap)),
  }))
}

// Next undone step of every active goal, overdue/today first
export function microGoals(data, limit = 3) {
  const today = todayKey()
  return data.goals
    .filter((g) => !g.done)
    .map((g) => {
      const step = g.steps.find((s) => !s.done)
      return step && { goal: g, step, overdue: step.plannedFor && step.plannedFor < today, due: !step.plannedFor || step.plannedFor <= today }
    })
    .filter(Boolean)
    .sort((a, b) => (b.due - a.due) || (a.step.plannedFor || '').localeCompare(b.step.plannedFor || ''))
    .slice(0, limit)
}

export function goalProgress(g) {
  return g.steps.length ? g.steps.filter((s) => s.done).length / g.steps.length : 0
}

// Is the goal ahead or behind the plan?
export function goalPace(g) {
  const today = todayKey()
  const planned = g.steps.filter((s) => s.plannedFor && s.plannedFor < today).length // today's step isn't late yet
  const done = g.steps.filter((s) => s.done).length
  return done - planned // > 0 ahead, < 0 behind
}
