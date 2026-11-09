import { useState } from 'react'
import { WIDGETS, PRESETS } from '../widgets/index.jsx'
import { DEFAULT_DASHBOARD } from '../lib/store.js'
import { prettyDate, todayKey } from '../lib/dates.js'

function greeting() {
  const h = new Date().getHours()
  return h < 6 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Customize({ layout, setLayout, onClose }) {
  const move = (i, dir) => {
    const next = [...layout]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setLayout(next)
  }
  return (
    <section className="card customize">
      <div className="card-head">
        <h2>Customize dashboard</h2>
        <button className="primary small" onClick={onClose}>Done</button>
      </div>
      <div className="row tight wrap">
        <span className="muted small">Presets:</span>
        {Object.entries(PRESETS).map(([name, ids]) => (
          <button key={name} className="pill" onClick={() => setLayout(ids.map((id) => ({ id, hidden: false })))}>{name}</button>
        ))}
        <button className="pill" onClick={() => setLayout(DEFAULT_DASHBOARD)}>Reset</button>
      </div>
      <ul className="layout-list">
        {layout.map((w, i) => (
          <li key={w.id} className={w.hidden ? 'hidden' : ''}>
            <span className="grow">{WIDGETS[w.id].name}</span>
            <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === layout.length - 1} aria-label="Move down">↓</button>
            <button
              className={`toggle ${w.hidden ? '' : 'on'}`}
              onClick={() => setLayout(layout.map((x) => (x.id === w.id ? { ...x, hidden: !x.hidden } : x)))}
              aria-label={w.hidden ? 'Show' : 'Hide'}
            >
              <i />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function Today(props) {
  const { data, actions } = props
  const [editing, setEditing] = useState(false)
  const today = todayKey()
  const low = !!data.lowEnergy[today]
  const layout = data.settings.dashboard
  const visible = layout.filter((w) => !w.hidden && (!low || WIDGETS[w.id].low))
  const hiddenByLow = low ? layout.filter((w) => !w.hidden && !WIDGETS[w.id].low).length : 0

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <p className="eyebrow">{prettyDate(today)}</p>
          <h1>{low ? 'Take it easy' : greeting()}</h1>
        </div>
        <button className={`low-btn ${low ? 'on' : ''}`} onClick={() => actions.setLowEnergy(!low)}>
          <span>🔋</span>
          {low ? 'Low energy: on' : 'Low energy'}
        </button>
      </header>

      {low && (
        <div className="low-banner">
          <b>Low Energy Mode</b>
          <p>Only your core habits and one micro-goal today. {hiddenByLow} widgets hidden. Other habits won’t break their streaks. Doing the minimum is still a win.</p>
        </div>
      )}

      {editing && <Customize layout={layout} setLayout={(d) => actions.setSettings({ dashboard: d })} onClose={() => setEditing(false)} />}

      {visible.map((w) => {
        const W = WIDGETS[w.id].component
        return <W key={w.id} {...props} low={low} />
      })}

      {!editing && (
        <button className="ghost customize-btn" onClick={() => { setEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          ⚙ Customize dashboard
        </button>
      )}
    </div>
  )
}
