import { addDays, addMonths, fmtMinutes, lastDays, monthEnd, monthKey, monthStart, range, shortDate, todayKey, weekday, weekStart, WEEKDAYS } from './dates.js'
import { active, dayCompletion, isDone, isScheduled, weekCount } from './habits.js'
import { hasJournal } from './game.js'

// ── Per-day numbers ──────────────────────────────────────────────────────────

export function dayStats(data, day) {
  const e = data.entries[day] || {}
  const completion = dayCompletion(data, day)
  const focus = data.focus.filter((f) => f.date === day).reduce((n, f) => n + f.minutes, 0)
  const parts = []
  if (completion !== null) parts.push(completion)
  if (e.mood) parts.push((e.mood - 1) / 4)
  if (e.energy) parts.push((e.energy - 1) / 4)
  const score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null
  return { day, completion, mood: e.mood || null, energy: e.energy || null, focus, score, low: !!data.lowEnergy[day] }
}

// ── Correlations & pattern insights ─────────────────────────────────────────

function pearson(xs, ys) {
  const n = xs.length
  if (n < 3) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
const strength = (r) => (Math.abs(r) > 0.5 ? 'strong' : Math.abs(r) > 0.3 ? 'clear' : 'slight')

export const MIN_DAYS = 7

export function insights(data, days = 60) {
  const stats = lastDays(days).map((d) => dayStats(data, d))
  const rated = stats.filter((s) => s.energy || s.mood)
  const out = []
  if (rated.length < MIN_DAYS) return { ready: false, have: rated.length, list: [] }

  // Habit completion ↔ energy / mood
  for (const key of ['energy', 'mood']) {
    const pairs = stats.filter((s) => s[key] && s.completion !== null)
    if (pairs.length >= MIN_DAYS) {
      const r = pearson(pairs.map((p) => p.completion), pairs.map((p) => p[key]))
      if (Math.abs(r) >= 0.2) {
        out.push({
          icon: key === 'energy' ? '⚡' : '🙂',
          weight: Math.abs(r),
          title: `Habits ${r > 0 ? '↑' : '↓'} ${key}`,
          text:
            r > 0
              ? `There's a ${strength(r)} link between finishing your habits and higher ${key}. Days you complete them tend to feel better.`
              : `On days with high habit completion your ${key} tends to be lower. Maybe your routine is too heavy. Try Low Energy Mode on tough days.`,
        })
      }
    }
  }

  // Which single habit makes the biggest difference?
  let bestHabit = null
  for (const h of active(data)) {
    const withH = rated.filter((s) => isDone(data, h, s.day) && s.energy).map((s) => s.energy)
    const without = rated.filter((s) => !isDone(data, h, s.day) && s.energy && h.createdAt <= s.day).map((s) => s.energy)
    if (withH.length >= 3 && without.length >= 3) {
      const diff = avg(withH) - avg(without)
      if (!bestHabit || Math.abs(diff) > Math.abs(bestHabit.diff)) bestHabit = { h, diff }
    }
  }
  if (bestHabit && Math.abs(bestHabit.diff) >= 0.4) {
    out.push({
      icon: bestHabit.h.emoji,
      weight: Math.abs(bestHabit.diff) / 2,
      title: `${bestHabit.h.name} matters`,
      text: `Your energy is on average ${Math.abs(bestHabit.diff).toFixed(1)} points ${bestHabit.diff > 0 ? 'higher' : 'lower'} on days you do "${bestHabit.h.name}".`,
    })
  }

  // Focus ↔ mood
  const focusPairs = rated.filter((s) => s.mood)
  if (focusPairs.length >= MIN_DAYS && focusPairs.some((s) => s.focus > 0)) {
    const r = pearson(focusPairs.map((s) => s.focus), focusPairs.map((s) => s.mood))
    if (Math.abs(r) >= 0.25) {
      out.push({
        icon: '⏱',
        weight: Math.abs(r),
        title: r > 0 ? 'Deep work lifts your mood' : 'Long focus days drain you',
        text: r > 0 ? 'Days with more focus time tend to be better days for you.' : 'Your mood is lower on days with lots of focus time. Build in more breaks.',
      })
    }
  }

  // Best & worst weekday
  const byWd = WEEKDAYS.map((_, i) => avg(stats.filter((s) => s.score !== null && weekday(s.day) === i).map((s) => s.score)))
  const valid = byWd.map((v, i) => ({ v, i })).filter((x) => x.v !== null)
  if (valid.length >= 4) {
    const best = valid.reduce((a, b) => (b.v > a.v ? b : a))
    const worst = valid.reduce((a, b) => (b.v < a.v ? b : a))
    if (best.v - worst.v > 0.12) {
      out.push({
        icon: '📅',
        weight: best.v - worst.v,
        title: `${WEEKDAYS[best.i]} is your best day`,
        text: `Your days score highest on ${WEEKDAYS[best.i]} and lowest on ${WEEKDAYS[worst.i]}. Plan important work for your strong days and keep ${WEEKDAYS[worst.i]} light.`,
      })
    }
  }

  // Sleep-like effect: today's energy vs yesterday's habit completion
  const lagged = stats
    .map((s) => ({ e: s.energy, c: dayCompletion(data, addDays(s.day, -1)) }))
    .filter((x) => x.e && x.c !== null)
  if (lagged.length >= MIN_DAYS) {
    const r = pearson(lagged.map((x) => x.c), lagged.map((x) => x.e))
    if (r >= 0.3) {
      out.push({ icon: '🌙', weight: r * 0.9, title: 'Good days build on each other', text: 'When you finish your habits, your energy the next day tends to be higher too.' })
    }
  }

  // Recurring energy drains from the journal
  const drains = topWords(Object.entries(data.entries).filter(([d]) => d >= addDays(todayKey(), -days)).map(([, e]) => e.drain))
  if (drains.length) {
    out.push({ icon: '🪫', weight: 0.3, title: 'Recurring energy drains', text: `"${drains.slice(0, 3).join('", "')}" keep showing up in your energy drains. Can you remove or reduce one of them?` })
  }

  return { ready: true, have: rated.length, list: out.sort((a, b) => b.weight - a.weight) }
}

const STOP = new Set('the a an and or but to of in on at for with my me i it is was be been too much very that this so not no just had have has get got did do from about all when then than there their they them we our you your its im ive dont didnt de het een en van ik je niet met op te dat die is was'.split(' '))

export function topWords(texts, n = 5) {
  const counts = {}
  for (const t of texts) {
    if (!t) continue
    const seen = new Set()
    for (const w of t.toLowerCase().match(/[a-zà-ÿ']{3,}/g) || []) {
      if (STOP.has(w) || seen.has(w)) continue
      seen.add(w)
      counts[w] = (counts[w] || 0) + 1
    }
  }
  return Object.entries(counts).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w)
}

// ── Weekly & monthly reviews ────────────────────────────────────────────────

export function periodFor(kind, anchor) {
  if (kind === 'week') {
    const start = weekStart(anchor)
    return { kind, key: `W:${start}`, start, end: addDays(start, 6), label: `${shortDate(start)} – ${shortDate(addDays(start, 6))}` }
  }
  const m = monthKey(anchor)
  const label = new Date(m + '-01T12:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return { kind, key: `M:${m}`, start: monthStart(m), end: monthEnd(m), label }
}

export function shiftPeriod(p, dir) {
  if (p.kind === 'week') return periodFor('week', addDays(p.start, 7 * dir))
  return periodFor('month', monthStart(addMonths(p.start.slice(0, 7), dir)))
}

function summarize(data, game, start, end) {
  const today = todayKey()
  const days = range(start, end < today ? end : today)
  const stats = days.map((d) => dayStats(data, d))
  const comp = stats.filter((s) => s.completion !== null)

  // per habit completion in this period
  const habits = active(data)
    .filter((h) => h.createdAt <= end)
    .map((h) => {
      let rate
      if (h.schedule.type === 'weekly') {
        const weeks = [...new Set(days.map(weekStart))]
        rate = avg(weeks.map((w) => Math.min(1, weekCount(data, h, w) / h.schedule.times)))
      } else {
        const due = days.filter((d) => isScheduled(h, d) && d >= h.createdAt && !(data.lowEnergy[d] && !h.core))
        rate = due.length ? due.filter((d) => isDone(data, h, d)).length / due.length : null
      }
      return { h, rate }
    })
    .filter((x) => x.rate !== null)

  const inRange = (d) => d && d >= start && d <= end
  return {
    days: days.length,
    completion: avg(comp.map((s) => s.completion)),
    mood: avg(stats.filter((s) => s.mood).map((s) => s.mood)),
    energy: avg(stats.filter((s) => s.energy).map((s) => s.energy)),
    focus: data.focus.filter((f) => inRange(f.date)).reduce((n, f) => n + f.minutes, 0),
    steps: data.goals.reduce((n, g) => n + g.steps.filter((s) => s.done && inRange(s.doneAt)).length, 0),
    goalsDone: data.goals.filter((g) => g.done && inRange(g.doneAt)).length,
    tasks: data.tasks.filter((t) => t.done && inRange(t.doneAt)).length,
    journals: days.filter((d) => hasJournal(data.entries[d])).length,
    lowDays: days.filter((d) => data.lowEnergy[d]).length,
    xp: Object.entries(game.byDay).filter(([d]) => inRange(d)).reduce((n, [, v]) => n + v, 0),
    habits,
    wins: days.map((d) => ({ d, text: data.entries[d]?.win })).filter((w) => w.text?.trim()),
    drains: topWords(days.map((d) => data.entries[d]?.drain)),
    bestDay: stats.filter((s) => s.score !== null).sort((a, b) => b.score - a.score)[0] || null,
  }
}

const pct = (v) => `${Math.round(v * 100)}%`

export function review(data, game, period) {
  const cur = summarize(data, game, period.start, period.end)
  const prevP = shiftPeriod(period, -1)
  const prev = summarize(data, game, prevP.start, prevP.end)
  const noun = period.kind === 'week' ? 'week' : 'month'

  // Generated summary text
  const lines = []
  if (cur.completion !== null) {
    let l = `You completed ${pct(cur.completion)} of your habits this ${noun}`
    if (prev.completion !== null) {
      const diff = cur.completion - prev.completion
      l += Math.abs(diff) < 0.03 ? ', about the same as last time.' : diff > 0 ? `, up ${pct(diff)} from last ${noun} 📈` : `, down ${pct(-diff)} from last ${noun}.`
    } else l += '.'
    lines.push(l)
  }
  const sorted = [...cur.habits].sort((a, b) => b.rate - a.rate)
  if (sorted.length >= 2) {
    lines.push(`Strongest habit: ${sorted[0].h.name} (${pct(sorted[0].rate)}). Needs attention: ${sorted.at(-1).h.name} (${pct(sorted.at(-1).rate)}).`)
  }
  if (cur.focus) lines.push(`You focused for ${fmtMinutes(cur.focus)}${prev.focus ? ` (last ${noun}: ${fmtMinutes(prev.focus)})` : ''}.`)
  if (cur.steps || cur.goalsDone) lines.push(`You finished ${cur.steps} micro-goal${cur.steps === 1 ? '' : 's'}${cur.goalsDone ? ` and achieved ${cur.goalsDone} goal${cur.goalsDone === 1 ? '' : 's'} 🏆` : ''}.`)
  if (cur.energy && prev.energy) {
    const d = cur.energy - prev.energy
    if (Math.abs(d) >= 0.3) lines.push(`Your average energy ${d > 0 ? 'rose' : 'dropped'} from ${prev.energy.toFixed(1)} to ${cur.energy.toFixed(1)}.`)
  }
  if (cur.lowDays) lines.push(`You used Low Energy Mode on ${cur.lowDays} day${cur.lowDays === 1 ? '' : 's'}. Protecting your core habits on hard days is a win.`)
  if (cur.drains.length) lines.push(`Recurring energy drains: ${cur.drains.slice(0, 3).join(', ')}.`)

  // One concrete suggestion for next time
  let advice
  if (sorted.length && sorted.at(-1).rate < 0.5) advice = `Make "${sorted.at(-1).h.name}" easier next ${noun}: shrink it, or move it to fewer days.`
  else if (cur.energy && cur.energy < 2.6) advice = 'Your energy was low. Plan fewer things and use Low Energy Mode without guilt.'
  else if (!cur.focus) advice = 'Try one 25-minute focus session on your most important micro-goal.'
  else if (cur.completion !== null && cur.completion >= 0.85) advice = 'You are crushing it. Consider adding one new small habit or a bigger goal.'
  else advice = 'Pick one micro-goal each morning and protect time for it.'

  if (!lines.length) lines.push(`Not much data for this ${noun} yet. Keep tracking and this review fills itself.`)
  return { cur, prev, lines, advice }
}
