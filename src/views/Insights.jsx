import { useRef } from 'react'
import { lastDays, prettyDate, todayKey } from '../dates.js'
import { streak } from '../store.js'

export default function Insights({ data, actions }) {
  const days30 = lastDays(30)
  const days7 = lastDays(7)
  const fileRef = useRef()
  const habits = data.habits.filter((h) => !h.archived)

  const rate = (habitId, days) => Math.round((days.filter((d) => data.checks[d]?.[habitId]).length / days.length) * 100)

  // Share of all habits done per day, for the last 30 days
  const daily = days30.map((d) => {
    if (!habits.length) return 0
    return habits.filter((h) => data.checks[d]?.[h.id]).length / habits.length
  })
  const perfectDays = daily.filter((v) => v === 1 && habits.length).length

  const goals = data.goals
  const stepsDone = goals.reduce((n, g) => n + g.steps.filter((s) => s.done).length, 0)

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `grow-backup-${todayKey()}.json`
    a.click()
  }

  const importData = (e) => {
    const file = e.target.files[0]
    if (!file) return
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text)
        if (window.confirm('Replace everything in the app with this backup?')) actions.replaceAll(parsed)
      } catch {
        window.alert("That file isn't a valid backup.")
      }
    })
    e.target.value = ''
  }

  return (
    <div className="stack">
      <h1>Insights</h1>

      <section className="card">
        <div className="card-head">
          <h2>Last 30 days</h2>
          <span className="muted small">{perfectDays} perfect days</span>
        </div>
        <div className="month">
          {days30.map((d, i) => (
            <div
              key={d}
              className="month-day"
              title={`${prettyDate(d, { day: 'numeric', month: 'short' })}: ${Math.round(daily[i] * 100)}%`}
              style={{ '--fill': daily[i] }}
            />
          ))}
        </div>
        <p className="muted small">Brighter = more habits done that day.</p>
      </section>

      <section className="card">
        <h2>Habit consistency</h2>
        {habits.length === 0 && <p className="muted">No active habits.</p>}
        {habits.map((h) => (
          <div key={h.id} className="bar-row">
            <span className="grow">{h.emoji} {h.name}</span>
            <span className="muted small">🔥{streak(data.checks, h.id)}</span>
            <div className="bar"><div style={{ width: `${rate(h.id, days30)}%` }} /></div>
            <span className="small pct">{rate(h.id, days30)}%</span>
          </div>
        ))}
        <p className="muted small">Bar shows the last 30 days. This week overall: {habits.length ? Math.round(habits.reduce((n, h) => n + rate(h.id, days7), 0) / habits.length) : 0}%.</p>
      </section>

      <section className="card">
        <h2>Goals</h2>
        <div className="stats">
          <span><b>{goals.filter((g) => !g.done).length}</b> active</span>
          <span><b>{goals.filter((g) => g.done).length}</b> achieved</span>
          <span><b>{stepsDone}</b> steps completed</span>
        </div>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted">Download a backup now and then, or use it to move your data to another device.</p>
        <div className="row tight wrap">
          <button onClick={exportData}>Download backup</button>
          <button className="ghost" onClick={() => fileRef.current.click()}>Restore backup</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
        </div>
      </section>
    </div>
  )
}
