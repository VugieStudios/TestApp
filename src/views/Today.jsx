import { prettyDate, todayKey, daysUntil } from '../dates.js'
import { streak } from '../store.js'

const PROMPTS = [
  { key: 'gratitude', label: "I'm grateful for…" },
  { key: 'win', label: "Today's win" },
  { key: 'improve', label: 'Tomorrow I want to do better at…' },
]

export default function Today({ data, actions, goTo }) {
  const date = todayKey()
  const habits = data.habits.filter((h) => !h.archived)
  const checks = data.checks[date] || {}
  const entry = data.entries[date] || {}
  const doneCount = habits.filter((h) => checks[h.id]).length

  const nextSteps = data.goals
    .filter((g) => !g.done)
    .map((g) => ({ goal: g, step: g.steps.find((s) => !s.done) }))
    .filter((x) => x.step)
    .slice(0, 3)

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">{prettyDate(date)}</p>
        <h1>Today</h1>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Habits</h2>
          <span className="muted">
            {doneCount}/{habits.length}
          </span>
        </div>
        <div className="progress">
          <div style={{ width: habits.length ? `${(doneCount / habits.length) * 100}%` : 0 }} />
        </div>
        {habits.length === 0 && (
          <p className="muted">
            No habits yet. <button className="link" onClick={() => goTo('habits')}>Add one</button>
          </p>
        )}
        <ul className="checklist">
          {habits.map((h) => {
            const s = streak(data.checks, h.id)
            return (
              <li key={h.id}>
                <label className={checks[h.id] ? 'done' : ''}>
                  <input type="checkbox" checked={!!checks[h.id]} onChange={() => actions.toggleCheck(date, h.id)} />
                  <span className="emoji">{h.emoji}</span>
                  <span className="grow">{h.name}</span>
                  {s > 0 && <span className="streak">🔥 {s}</span>}
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <h2>Reflect</h2>
        {PROMPTS.map((p) => (
          <label key={p.key} className="field">
            <span className="label">{p.label}</span>
            <textarea
              rows={2}
              value={entry[p.key] || ''}
              onChange={(e) => actions.saveEntry(date, { [p.key]: e.target.value })}
            />
          </label>
        ))}
        <label className="field">
          <span className="label">Anything else on your mind</span>
          <textarea rows={4} value={entry.notes || ''} onChange={(e) => actions.saveEntry(date, { notes: e.target.value })} />
        </label>
        <p className="muted small">Saves automatically.</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Next steps on your goals</h2>
          <button className="link" onClick={() => goTo('goals')}>All goals</button>
        </div>
        {nextSteps.length === 0 ? (
          <p className="muted">Nothing lined up. Add a goal with a first step to see it here.</p>
        ) : (
          <ul className="checklist">
            {nextSteps.map(({ goal, step }) => (
              <li key={step.id}>
                <label>
                  <input type="checkbox" checked={false} onChange={() => actions.toggleStep(goal.id, step.id)} />
                  <span className="grow">
                    {step.text}
                    <span className="muted small block">
                      {goal.title}
                      {goal.deadline && ` · ${daysUntil(goal.deadline)} days left`}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
