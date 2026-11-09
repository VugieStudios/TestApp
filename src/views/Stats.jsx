import { useMemo, useState } from 'react'
import { Card, Seg, XpChip } from '../components/ui.jsx'
import { addDays, addMonths, fmtMinutes, monthEnd, monthKey, monthStart, prettyDate, range, shortDate, todayKey, weekday, weekStart } from '../lib/dates.js'
import { dayStats, EXAMPLE_INSIGHTS, insights, MIN_DAYS, periodFor, review, shiftPeriod } from '../lib/analytics.js'
import { XP } from '../lib/game.js'

const METRICS = [
  ['score', 'Day score'],
  ['completion', 'Habits'],
  ['focus', 'Focus'],
]

function norm(s, metric) {
  if (!s) return -1
  const v = s[metric]
  if (v === null || v === undefined) return -1
  if (metric === 'focus') return v > 0 ? Math.min(1, v / 50) : -1
  return v
}

function Calendar({ data }) {
  const [month, setMonth] = useState(monthKey(todayKey()))
  const [metric, setMetric] = useState('score')
  const [picked, setPicked] = useState(null)
  const today = todayKey()
  const start = monthStart(month)
  const days = range(start, monthEnd(month))
  const lead = weekday(start)
  const stats = useMemo(() => Object.fromEntries(days.map((d) => [d, d <= today ? dayStats(data, d) : null])), [data, month]) // eslint-disable-line react-hooks/exhaustive-deps
  const p = picked && stats[picked]
  const label = new Date(start + 'T12:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <Card>
      <div className="card-head">
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">‹</button>
        <h2>{label}</h2>
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= monthKey(today)} aria-label="Next month">›</button>
      </div>
      <Seg small value={metric} onChange={setMetric} options={METRICS} />
      <div className="grid7">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="wd">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={'x' + i} />)}
        {days.map((d) => (
          <button
            key={d}
            className={`cell lg ${d === today ? 'today' : ''} ${picked === d ? 'picked' : ''} ${stats[d]?.low ? 'low' : ''}`}
            style={{ '--v': norm(stats[d], metric) }}
            onClick={() => setPicked(d === picked ? null : d)}
            disabled={d > today}
          >
            {Number(d.slice(8))}
          </button>
        ))}
      </div>
      <div className="scale-legend"><span>low</span><i /><span>high</span><span className="muted small">· 🔋 = low-energy day</span></div>
      {p && (
        <div className="day-detail">
          <b>{prettyDate(picked)}</b>
          <div className="stat-row">
            <span>Habits <b>{p.completion === null ? '–' : `${Math.round(p.completion * 100)}%`}</b></span>
            <span>Focus <b>{fmtMinutes(p.focus)}</b></span>
            <span>Steps & tasks <b>{p.progress}</b></span>
            <span>Journal <b>{p.journaled ? '✓' : '–'}</b></span>
          </div>
          {data.entries[picked]?.win && <p className="muted small">Win: {data.entries[picked].win}</p>}
        </div>
      )}
    </Card>
  )
}

function Trend({ data }) {
  // 8-week trend: habit completion, focus time and journaling
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(weekStart(todayKey()), -7 * (7 - i)))
  const rows = weeks.map((w) => {
    const s = range(w, addDays(w, 6)).filter((d) => d <= todayKey()).map((d) => dayStats(data, d))
    const a = (k, f = (x) => x) => {
      const v = s.map((x) => x[k]).filter((x) => x !== null)
      return v.length ? f(v.reduce((p, c) => p + c, 0) / v.length) : null
    }
    return {
      w,
      completion: a('completion'),
      focus: s.length ? Math.min(1, s.reduce((n, x) => n + x.focus, 0) / s.length / 50) : null,
      journal: s.length ? s.filter((x) => x.journaled).length / s.length : null,
    }
  })
  const W = 320
  const H = 110
  const x = (i) => 10 + (i * (W - 20)) / 7
  const y = (v) => H - 10 - v * (H - 20)
  const path = (k) => rows.map((r, i) => (r[k] === null ? null : `${x(i)},${y(r[k])}`)).filter(Boolean).join(' ')
  return (
    <Card title="8-week trend" icon="↗">
      <svg viewBox={`0 0 ${W} ${H}`} className="trend">
        {[0, 0.5, 1].map((v) => <line key={v} x1="10" x2={W - 10} y1={y(v)} y2={y(v)} />)}
        <polyline className="t-comp" points={path('completion')} />
        <polyline className="t-focus" points={path('focus')} />
        <polyline className="t-journal" points={path('journal')} />
      </svg>
      <div className="legend">
        <span><i className="l-comp" /> Habits</span>
        <span><i className="l-focus" /> Focus</span>
        <span><i className="l-journal" /> Journaling</span>
        <span className="muted small">{shortDate(weeks[0])} → now</span>
      </div>
    </Card>
  )
}

function Insights({ data }) {
  const ins = insights(data)
  return (
    <>
      <Trend data={data} />
      {!ins.ready ? (
        <>
          <Card title="Pattern insights" icon="✦">
            <p className="muted">After {MIN_DAYS} days of tracking, the app starts spotting patterns: which habits help each other, your strong and weak days, and how focus and journaling affect your consistency.</p>
            <div className="progress"><div style={{ width: `${(ins.have / MIN_DAYS) * 100}%` }} /></div>
            <p className="muted small">{ins.have}/{MIN_DAYS} days · below are examples of what you'll see</p>
          </Card>
          {EXAMPLE_INSIGHTS.map((x, i) => (
            <section key={i} className="card insight big example">
              <span className="insight-icon">{x.icon}</span>
              <div><h2>{x.title} <span className="tag">example</span></h2><p className="muted">{x.text}</p></div>
            </section>
          ))}
        </>
      ) : ins.list.length === 0 ? (
        <Card title="Pattern insights" icon="✦"><p className="muted">No strong patterns in the last 60 days yet. Keep tracking.</p></Card>
      ) : (
        ins.list.map((x, i) => (
          <section key={i} className="card insight big">
            <span className="insight-icon">{x.icon}</span>
            <div><h2>{x.title}</h2><p className="muted">{x.text}</p></div>
          </section>
        ))
      )}
    </>
  )
}

const fmtPct = (v) => (v === null ? '–' : `${Math.round(v * 100)}%`)
const delta = (a, b, kind = 'pct') => {
  if (a === null || b === null || a === undefined || b === undefined) return null
  const d = a - b
  if (Math.abs(d) < (kind === 'pct' ? 0.01 : 0.05)) return null
  const txt = kind === 'pct' ? `${Math.round(Math.abs(d) * 100)}%` : kind === 'num' ? Math.abs(d).toFixed(1) : Math.abs(Math.round(d))
  return <span className={`delta ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'} {txt}</span>
}

function Reviews({ data, actions, game }) {
  const [kind, setKind] = useState('week')
  const [period, setPeriod] = useState(() => periodFor('week', addDays(todayKey(), -7)))
  const switchKind = (k) => {
    setKind(k)
    setPeriod(periodFor(k, k === 'week' ? addDays(todayKey(), -7) : monthStart(addMonths(monthKey(todayKey()), -1))))
  }
  const r = review(data, game, period)
  const c = r.cur
  const ended = period.end < todayKey()
  const done = data.reviews[period.key]
  const isFuture = period.start > todayKey()

  return (
    <>
      <Seg value={kind} onChange={switchKind} options={[['week', 'Weekly'], ['month', 'Monthly']]} />
      <Card className="review">
        <div className="card-head">
          <button className="icon-btn" onClick={() => setPeriod(shiftPeriod(period, -1))} aria-label="Previous">‹</button>
          <div className="center">
            <p className="eyebrow">{kind === 'week' ? 'Weekly review' : 'Monthly review'}{!ended && ' · in progress'}</p>
            <h2>{period.label}</h2>
          </div>
          <button className="icon-btn" onClick={() => setPeriod(shiftPeriod(period, 1))} disabled={isFuture || !ended} aria-label="Next">›</button>
        </div>

        <div className="review-stats">
          <div><b>{fmtPct(c.completion)}</b><span>habits {delta(c.completion, r.prev.completion)}</span></div>
          <div><b>{fmtMinutes(c.focus)}</b><span>focus {delta(c.focus, r.prev.focus, 'min')}</span></div>
          <div><b>{c.steps}</b><span>micro-goals {delta(c.steps, r.prev.steps, 'min')}</span></div>
          <div><b>{c.tasks}</b><span>tasks done {delta(c.tasks, r.prev.tasks, 'min')}</span></div>
          <div><b>{c.journals}</b><span>journal days {delta(c.journals, r.prev.journals, 'min')}</span></div>
          <div><b>+{c.xp}</b><span>XP earned</span></div>
        </div>

        <div className="summary">
          {r.lines.map((l, i) => <p key={i}>{l}</p>)}
          <p className="advice"><b>Focus for next {kind}:</b> {r.advice}</p>
        </div>

        {c.habits.length > 0 && (
          <div className="stack-sm">
            <p className="label">Habits</p>
            {[...c.habits].sort((a, b) => b.rate - a.rate).map(({ h, rate }) => (
              <div key={h.id} className="bar-row">
                <span className="grow">{h.emoji} {h.name}</span>
                <div className="bar"><div style={{ width: `${rate * 100}%` }} /></div>
                <span className="small pct">{Math.round(rate * 100)}%</span>
              </div>
            ))}
          </div>
        )}

        {c.wins.length > 0 && (
          <div className="stack-sm">
            <p className="label">Your wins</p>
            <ul className="wins">
              {c.wins.slice(-6).map((w) => <li key={w.d}><span className="muted small">{shortDate(w.d)}</span> {w.text}</li>)}
            </ul>
          </div>
        )}

        {ended && (
          done ? (
            <p className="reviewed">✓ Reviewed on {shortDate(done)}</p>
          ) : (
            <button className="primary" onClick={() => actions.completeReview(period.key)}>
              Complete review <XpChip n={kind === 'week' ? XP.weeklyReview : XP.monthlyReview} />
            </button>
          )
        )}
      </Card>
    </>
  )
}

export default function Stats(props) {
  const [tab, setTab] = useState('calendar')
  const pending = useMemo(() => {
    const w = periodFor('week', addDays(todayKey(), -7))
    const m = periodFor('month', monthStart(addMonths(monthKey(todayKey()), -1)))
    return [w, m].filter((p) => !props.data.reviews[p.key]).length
  }, [props.data.reviews])
  return (
    <div className="stack">
      <header className="page-head"><h1>Stats</h1></header>
      <Seg value={tab} onChange={setTab} options={[['calendar', 'Calendar'], ['insights', 'Insights'], ['reviews', `Reviews${pending ? ` (${pending})` : ''}`]]} />
      {tab === 'calendar' && <Calendar {...props} />}
      {tab === 'insights' && <Insights {...props} />}
      {tab === 'reviews' && <Reviews {...props} />}
    </div>
  )
}
