import { addDays, addMonths, fmtMinutes, lastDays, monthEnd, monthKey, monthStart, range, shortDate, todayKey, weekday, weekStart, WEEKDAYS } from './dates.js'
import { active, dayCompletion, isDone, isScheduled, weekCount } from './habits.js'
import { hasJournal } from './game.js'
import { garminRange } from './garmin.js'

// ── Per-day numbers ──────────────────────────────────────────────────────────
// Day score (0–1): mostly habits, plus focus time and moving goals/tasks forward.

export function dayStats(data, day) {
  const e = data.entries[day] || {}
  const completion = dayCompletion(data, day)
  const focus = data.focus.filter((f) => f.date === day).reduce((n, f) => n + f.minutes, 0)
  const progress =
    data.goals.reduce((n, g) => n + g.steps.filter((s) => s.done && s.doneAt === day).length, 0) +
    data.tasks.filter((t) => t.done && t.doneAt === day).length
  const journaled = hasJournal(e)
  const active = completion !== null || focus > 0 || progress > 0 || journaled
  let score = null
  if (active) {
    const focusPart = Math.min(1, focus / 50)
    const progressPart = Math.min(1, progress / 2)
    score = completion === null ? (focusPart + progressPart) / 2 : 0.6 * completion + 0.25 * focusPart + 0.15 * progressPart
  }
  return { day, completion, focus, progress, journaled, score, low: !!data.lowEnergy[day] }
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
const pctTxt = (v) => `${Math.round(v * 100)}%`

export const MIN_DAYS = 7

// Shown (clearly labelled) until there is enough real data
export const EXAMPLE_INSIGHTS = [
  { icon: '🔗', title: 'Gym → Read 10 pages', text: 'On days you go to the gym, you also read 86% of the time, versus 40% on days you skip it. Stack them: do them right after each other.' },
  { icon: '📅', title: 'Tue is your strongest day', text: 'You complete 92% of your habits on Tue but only 45% on Sat. Keep Sat light, or use Low Energy Mode then.' },
  { icon: '🌙', title: 'No phone in bed needs help', text: 'You do it 55% of the time, and Fri is the hardest day (20%). Plan it earlier on Fridays, or make it smaller that day.' },
  { icon: '⏱', title: 'Focus days are habit days', text: 'On days with a focus session you complete 84% of your habits, versus 58% without. One focus block seems to set the tone for your day.' },
  { icon: '✎', title: 'Reflecting pays off', text: 'The day after you journal, you complete 18% more of your habits.' },
  { icon: '📈', title: 'You are building momentum', text: 'Last 2 weeks: 78% of habits done, versus 61% the 2 weeks before.' },
  { icon: '🪫', title: 'Recurring energy drains', text: '"phone", "late", "exams" keep showing up in your journal. Can you remove or reduce one of them?' },
]

export function insights(data, days = 60) {
  const stats = lastDays(days).map((d) => dayStats(data, d))
  const tracked = stats.filter((s) => s.completion !== null)
  const out = []
  const firstCheck = Object.keys(data.checks).sort()[0]
  const have = firstCheck ? stats.filter((s) => s.day >= firstCheck && s.day < todayKey() && s.completion !== null).length : 0
  if (have < MIN_DAYS) return { ready: false, have, list: [] }
  const past = tracked.filter((s) => s.day < todayKey())
  const habits = active(data)

  // 1. Habit chains: doing A makes B more likely
  let chain = null
  for (const a of habits) {
    for (const b of habits) {
      if (a.id === b.id) continue
      const days2 = past.filter((s) => s.day >= a.createdAt && s.day >= b.createdAt && isScheduled(b, s.day))
      const withA = days2.filter((s) => isDone(data, a, s.day))
      const noA = days2.filter((s) => !isDone(data, a, s.day))
      if (withA.length < 4 || noA.length < 3) continue
      const pWith = withA.filter((s) => isDone(data, b, s.day)).length / withA.length
      const pNo = noA.filter((s) => isDone(data, b, s.day)).length / noA.length
      const lift = pWith - pNo
      if (!chain || lift > chain.lift) chain = { a, b, lift, pWith, pNo }
    }
  }
  if (chain && chain.lift >= 0.25) {
    out.push({
      icon: '🔗',
      weight: chain.lift,
      title: `${chain.a.name} → ${chain.b.name}`,
      text: `On days you do "${chain.a.name}", you also do "${chain.b.name}" ${pctTxt(chain.pWith)} of the time, versus ${pctTxt(chain.pNo)} on days you skip it. Stack them: do them right after each other.`,
    })
  }

  // 2. Most-missed habit and its weak day
  let weak = null
  for (const h of habits.filter((x) => x.schedule.type !== 'weekly')) {
    const due = past.filter((s) => s.day >= h.createdAt && isScheduled(h, s.day) && !(s.low && !h.core))
    if (due.length < 5) continue
    const rate = due.filter((s) => isDone(data, h, s.day)).length / due.length
    const byWd = WEEKDAYS.map((_, i) => {
      const d = due.filter((s) => weekday(s.day) === i)
      return d.length >= 2 ? d.filter((s) => isDone(data, h, s.day)).length / d.length : null
    })
    const worst = byWd.map((v, i) => ({ v, i })).filter((x) => x.v !== null).sort((x, y) => x.v - y.v)[0]
    if (!weak || rate < weak.rate) weak = { h, rate, worst }
  }
  if (weak && weak.rate < 0.8) {
    out.push({
      icon: weak.h.emoji,
      weight: 1 - weak.rate,
      title: `${weak.h.name} needs help`,
      text:
        `You do it ${pctTxt(weak.rate)} of the time` +
        (weak.worst && weak.worst.v < weak.rate - 0.15 ? `, and ${WEEKDAYS[weak.worst.i]} is the hardest day (${pctTxt(weak.worst.v)}). Plan it earlier on ${WEEKDAYS[weak.worst.i]}s, or make it smaller that day.` : '. Try making it smaller or linking it to something you already do.'),
    })
  }

  // 3. Best & worst weekday overall
  const byWd = WEEKDAYS.map((_, i) => avg(past.filter((s) => weekday(s.day) === i).map((s) => s.completion)))
  const valid = byWd.map((v, i) => ({ v, i })).filter((x) => x.v !== null)
  if (valid.length >= 5) {
    const best = valid.reduce((a, b) => (b.v > a.v ? b : a))
    const worst = valid.reduce((a, b) => (b.v < a.v ? b : a))
    if (best.v - worst.v > 0.15) {
      out.push({
        icon: '📅',
        weight: best.v - worst.v,
        title: `${WEEKDAYS[best.i]} is your strongest day`,
        text: `You complete ${pctTxt(best.v)} of your habits on ${WEEKDAYS[best.i]} but only ${pctTxt(worst.v)} on ${WEEKDAYS[worst.i]}. Keep ${WEEKDAYS[worst.i]} light, or use Low Energy Mode then.`,
      })
    }
  }

  // 4. Focus ↔ habits
  const withFocus = past.filter((s) => s.focus > 0)
  if (withFocus.length >= 3 && past.length - withFocus.length >= 3) {
    const a1 = avg(withFocus.map((s) => s.completion))
    const a0 = avg(past.filter((s) => s.focus === 0).map((s) => s.completion))
    if (Math.abs(a1 - a0) >= 0.12) {
      out.push({
        icon: '⏱',
        weight: Math.abs(a1 - a0),
        title: a1 > a0 ? 'Focus days are habit days' : 'Focus days crowd out habits',
        text: a1 > a0
          ? `On days with a focus session you complete ${pctTxt(a1)} of your habits, versus ${pctTxt(a0)} without. One focus block seems to set the tone for your day.`
          : `On days with focus sessions your habits drop to ${pctTxt(a1)} (versus ${pctTxt(a0)}). Do your habits before you start deep work.`,
      })
    }
  }

  // 5. Journaling → next day
  const pairs = past.map((s) => ({ j: hasJournal(data.entries[addDays(s.day, -1)]), c: s.completion }))
  const after = pairs.filter((p) => p.j)
  const notAfter = pairs.filter((p) => !p.j)
  if (after.length >= 3 && notAfter.length >= 3) {
    const d = avg(after.map((p) => p.c)) - avg(notAfter.map((p) => p.c))
    if (d >= 0.12) {
      out.push({ icon: '✎', weight: d, title: 'Reflecting pays off', text: `The day after you journal, you complete ${pctTxt(d)} more of your habits.` })
    }
  }

  // 6. Momentum: are the last 2 weeks better or worse than the 2 before?
  const recent = avg(past.slice(-14).map((s) => s.completion))
  const before = avg(past.slice(-28, -14).map((s) => s.completion))
  if (recent !== null && before !== null && past.length >= 21 && Math.abs(recent - before) >= 0.1) {
    out.push({
      icon: recent > before ? '📈' : '📉',
      weight: Math.abs(recent - before),
      title: recent > before ? 'You are building momentum' : 'Your consistency is slipping',
      text: `Last 2 weeks: ${pctTxt(recent)} of habits done, versus ${pctTxt(before)} the 2 weeks before.${recent < before ? ' Check your weekly review for what changed.' : ''}`,
    })
  }

  // 7. Garmin: sleep → next-day habits, workouts ↔ habits
  const g = data.garmin
  if (g?.enabled) {
    const rows = past.map((s) => ({ c: s.completion, sleep: g.days[s.day]?.sleepMin, trained: g.activities.some((a) => a.date === s.day && a.kind !== 'walk') }))
    const good = rows.filter((r) => r.sleep >= 420)
    const short = rows.filter((r) => r.sleep && r.sleep < 420)
    if (good.length >= 3 && short.length >= 3) {
      const d = avg(good.map((r) => r.c)) - avg(short.map((r) => r.c))
      if (Math.abs(d) >= 0.1) {
        out.push({
          icon: '🌙',
          weight: Math.abs(d) + 0.1,
          title: d > 0 ? 'Sleep drives your discipline' : 'Short nights don’t stop you',
          text: d > 0
            ? `After 7+ hours of sleep you complete ${pctTxt(avg(good.map((r) => r.c)))} of your habits, versus ${pctTxt(avg(short.map((r) => r.c)))} after shorter nights.`
            : `Interesting: you complete more habits after short nights (${pctTxt(avg(short.map((r) => r.c)))}). Still, keep an eye on recovery.`,
        })
      }
    }
    const tr = rows.filter((r) => r.trained)
    const rest = rows.filter((r) => !r.trained)
    if (tr.length >= 3 && rest.length >= 3) {
      const d = avg(tr.map((r) => r.c)) - avg(rest.map((r) => r.c))
      if (Math.abs(d) >= 0.12) {
        out.push({
          icon: '🏋️',
          weight: Math.abs(d),
          title: d > 0 ? 'Training days are your best days' : 'Training days drain your habits',
          text: d > 0
            ? `On days you work out you complete ${pctTxt(avg(tr.map((r) => r.c)))} of your habits, versus ${pctTxt(avg(rest.map((r) => r.c)))} on rest days.`
            : `On workout days your other habits drop to ${pctTxt(avg(tr.map((r) => r.c)))}. Do the small ones before you train.`,
        })
      }
    }
  }

  // 8. Recurring energy drains from the journal
  const drains = topWords(Object.entries(data.entries).filter(([d]) => d >= addDays(todayKey(), -days)).map(([, e]) => e.drain))
  if (drains.length) {
    out.push({ icon: '🪫', weight: 0.2, title: 'Recurring energy drains', text: `"${drains.slice(0, 3).join('", "')}" keep showing up in your journal. Can you remove or reduce one of them?` })
  }

  return { ready: true, have, list: out.sort((a, b) => b.weight - a.weight) }
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
  const gc = garminRange(data.garmin, period.start, period.end)
  const gp = garminRange(data.garmin, prevP.start, prevP.end)
  if (gc && (gc.activities || gc.avgSleepMin)) {
    let l = ''
    if (gc.activities) l += `Garmin: ${gc.activities} workout${gc.activities === 1 ? '' : 's'}, ${fmtMinutes(gc.trainingMin)} of training${gc.km ? `, ${gc.km} km` : ''}${gp?.trainingMin ? ` (last ${noun}: ${fmtMinutes(gp.trainingMin)})` : ''}.`
    if (gc.avgSleepMin) l += ` Average sleep ${Math.floor(gc.avgSleepMin / 60)}h ${String(Math.round(gc.avgSleepMin % 60)).padStart(2, '0')}m.`
    lines.push(l.trim())
  }
  if (cur.journals) lines.push(`You reflected in your journal on ${cur.journals} day${cur.journals === 1 ? '' : 's'}.`)
  if (cur.lowDays) lines.push(`You used Low Energy Mode on ${cur.lowDays} day${cur.lowDays === 1 ? '' : 's'}. Protecting your core habits on hard days is a win.`)
  if (cur.drains.length) lines.push(`Recurring energy drains: ${cur.drains.slice(0, 3).join(', ')}.`)

  // One concrete suggestion for next time
  let advice
  if (sorted.length && sorted.at(-1).rate < 0.5) advice = `Make "${sorted.at(-1).h.name}" easier next ${noun}: shrink it, or move it to fewer days.`
  else if (gc?.avgSleepMin && gc.avgSleepMin < 400) advice = `You averaged under 7 hours of sleep. An earlier bedtime is probably the easiest win for next ${noun}.`
  else if (cur.lowDays >= 3) advice = 'You had several low-energy days. Plan fewer things and protect your sleep.'
  else if (!cur.focus) advice = 'Try one 25-minute focus session on your most important micro-goal.'
  else if (cur.completion !== null && cur.completion >= 0.85) advice = 'You are crushing it. Consider adding one new small habit or a bigger goal.'
  else advice = 'Pick one micro-goal each morning and protect time for it.'

  if (!lines.length) lines.push(`Not much data for this ${noun} yet. Keep tracking and this review fills itself.`)
  return { cur, prev, lines, advice }
}
