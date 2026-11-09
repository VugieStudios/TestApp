import { useRef } from 'react'
import { lastDays, prettyDate, todayKey } from '../dates.js'

function TrendChart({ days, entries }) {
  const W = 600
  const H = 160
  const pad = 24
  const x = (i) => pad + (i * (W - pad * 2)) / (days.length - 1)
  const y = (v) => H - pad - ((v - 1) * (H - pad * 2)) / 4

  const line = (key) => {
    let d = ''
    let pen = false
    days.forEach((day, i) => {
      const v = entries[day]?.[key]
      if (v) {
        d += `${pen ? 'L' : 'M'}${x(i)},${y(v)} `
        pen = true
      } else pen = false
    })
    return d
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Mood and energy over the last 30 days">
      {[1, 3, 5].map((v) => (
        <g key={v}>
          <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} className="grid" />
          <text x={4} y={y(v) + 4} className="axis">{v}</text>
        </g>
      ))}
      <path d={line('mood')} className="series mood" />
      <path d={line('energy')} className="series energy" />
      {days.map((day, i) =>
        ['mood', 'energy'].map((k) =>
          entries[day]?.[k] ? <circle key={day + k} cx={x(i)} cy={y(entries[day][k])} r={3} className={`dot ${k}`} /> : null
        )
      )}
      <text x={pad} y={H - 4} className="axis">{prettyDate(days[0], { day: 'numeric', month: 'short' })}</text>
      <text x={W - pad} y={H - 4} className="axis" textAnchor="end">Today</text>
    </svg>
  )
}

function avg(values) {
  const v = values.filter(Boolean)
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'
}

export default function Insights({ data, actions }) {
  const days30 = lastDays(30)
  const days7 = lastDays(7)
  const fileRef = useRef()
  const habits = data.habits.filter((h) => !h.archived)

  const rate = (habitId, days) => Math.round((days.filter((d) => data.checks[d]?.[habitId]).length / days.length) * 100)

  // Mood on days you hit all habits vs. days you didn't
  const tracked = days30.filter((d) => data.entries[d]?.mood && habits.length)
  const allDone = tracked.filter((d) => habits.every((h) => data.checks[d]?.[h.id]))
  const notAll = tracked.filter((d) => !allDone.includes(d))

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
          <h2>Mood & energy, last 30 days</h2>
        </div>
        <div className="legend">
          <span><i className="swatch mood" /> Mood</span>
          <span><i className="swatch energy" /> Energy</span>
        </div>
        <TrendChart days={days30} entries={data.entries} />
        <div className="stats">
          <span>7-day mood avg: <b>{avg(days7.map((d) => data.entries[d]?.mood))}</b></span>
          <span>7-day energy avg: <b>{avg(days7.map((d) => data.entries[d]?.energy))}</b></span>
        </div>
      </section>

      {allDone.length >= 3 && notAll.length >= 3 && (
        <section className="card">
          <h2>Do your habits lift your mood?</h2>
          <p>
            On days you finished every habit your mood averaged <b>{avg(allDone.map((d) => data.entries[d].mood))}</b>,
            compared to <b>{avg(notAll.map((d) => data.entries[d].mood))}</b> on other days.
          </p>
        </section>
      )}

      <section className="card">
        <h2>Habit consistency</h2>
        {habits.length === 0 && <p className="muted">No active habits.</p>}
        {habits.map((h) => (
          <div key={h.id} className="bar-row">
            <span className="grow">{h.emoji} {h.name}</span>
            <span className="muted small">7d {rate(h.id, days7)}%</span>
            <div className="bar"><div style={{ width: `${rate(h.id, days30)}%` }} /></div>
            <span className="small">{rate(h.id, days30)}%</span>
          </div>
        ))}
        <p className="muted small">Bar shows the last 30 days.</p>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted">
          Everything is saved in this browser only. Download a backup now and then, or use it to move your data to another device.
        </p>
        <div className="row tight">
          <button onClick={exportData}>Download backup</button>
          <button className="ghost" onClick={() => fileRef.current.click()}>Restore backup</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
        </div>
      </section>
    </div>
  )
}
