import { useState } from 'react'
import { lastDays, prettyDate } from '../dates.js'
import { streak, bestStreak } from '../store.js'

export default function Habits({ data, actions }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const days = lastDays(14)

  const add = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    actions.addHabit(name.trim(), emoji.trim())
    setName('')
    setEmoji('')
  }

  const active = data.habits.filter((h) => !h.archived)
  const archived = data.habits.filter((h) => h.archived)

  return (
    <div className="stack">
      <h1>Habits</h1>

      <form className="card row" onSubmit={add}>
        <input className="emoji-input" placeholder="🙂" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
        <input className="grow" placeholder="New habit, e.g. Pray in the morning" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary">Add</button>
      </form>

      {active.map((h) => (
        <section key={h.id} className="card">
          <div className="card-head">
            <h2>
              {h.emoji} {h.name}
            </h2>
            <div className="row tight">
              <button className="ghost small" onClick={() => actions.editHabit(h.id, { archived: true })}>Pause</button>
            </div>
          </div>
          <div className="stats">
            <span>🔥 {streak(data.checks, h.id)} day streak</span>
            <span className="muted">Best: {bestStreak(data.checks, h.id)}</span>
          </div>
          <div className="heat">
            {days.map((d) => (
              <button
                key={d}
                title={prettyDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}
                className={data.checks[d]?.[h.id] ? 'on' : ''}
                onClick={() => actions.toggleCheck(d, h.id)}
              >
                {prettyDate(d, { weekday: 'narrow' })}
              </button>
            ))}
          </div>
          <p className="muted small">Last 14 days. Tap a day to fix a missed check.</p>
        </section>
      ))}

      {archived.length > 0 && (
        <section className="card">
          <h2>Paused</h2>
          <ul className="plain">
            {archived.map((h) => (
              <li key={h.id} className="row">
                <span className="grow">
                  {h.emoji} {h.name}
                </span>
                <button className="ghost small" onClick={() => actions.editHabit(h.id, { archived: false })}>Resume</button>
                <button
                  className="ghost small danger"
                  onClick={() => window.confirm(`Delete "${h.name}" and its history?`) && actions.deleteHabit(h.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
