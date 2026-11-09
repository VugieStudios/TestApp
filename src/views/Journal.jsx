import { useState } from 'react'
import { prettyDate } from '../dates.js'

const FIELDS = [
  ['gratitude', 'Grateful for'],
  ['win', 'Win'],
  ['improve', 'Do better at'],
  ['notes', 'Notes'],
]

export default function Journal({ data }) {
  const [query, setQuery] = useState('')
  const q = query.toLowerCase()

  const days = Object.keys(data.entries)
    .sort()
    .reverse()
    .filter((d) => {
      const e = data.entries[d]
      const hasText = FIELDS.some(([k]) => e[k]?.trim())
      if (!hasText) return false
      return !q || FIELDS.some(([k]) => e[k]?.toLowerCase().includes(q))
    })

  return (
    <div className="stack">
      <h1>Journal</h1>
      <input placeholder="Search your entries…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {days.length === 0 && (
        <p className="muted">{q ? 'No entries match that search.' : 'Your reflections from the Today page show up here.'}</p>
      )}

      {days.map((d) => {
        const e = data.entries[d]
        return (
          <article key={d} className="card">
            <div className="card-head">
              <h2>{prettyDate(d, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
            </div>
            {FIELDS.filter(([k]) => e[k]?.trim()).map(([k, label]) => (
              <p key={k} className="entry">
                <span className="label">{label}</span>
                {e[k]}
              </p>
            ))}
          </article>
        )
      })}
    </div>
  )
}
