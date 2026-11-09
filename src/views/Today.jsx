import { prettyDate, todayKey, daysUntil } from '../dates.js'
import { streak } from '../store.js'
import { questsFor, XP } from '../game.js'
import { PlayerCard } from '../components/Game.jsx'

const PROMPTS = [
  { key: 'gratitude', label: "I'm grateful for…" },
  { key: 'win', label: "Today's win" },
  { key: 'improve', label: 'Tomorrow I want to do better at…' },
]

export default function Today({ data, actions, goTo, game }) {
  const date = todayKey()
  const habits = data.habits.filter((h) => !h.archived)
  const checks = data.checks[date] || {}
  const entry = data.entries[date] || {}
  const quests = questsFor(data, date)
  const questsDone = quests.list.filter((q) => q.done).length

  const nextSteps = data.goals
    .filter((g) => !g.done)
    .map((g) => ({ goal: g, step: g.steps.find((s) => !s.done) }))
    .filter((x) => x.step)
    .slice(0, 3)

  return (
    <div className="stack">
      <PlayerCard game={game} />

      <section className={`card quests ${quests.allDone ? 'complete' : ''}`}>
        <div className="card-head">
          <h2>📜 Daily quests</h2>
          <span className="muted small">{prettyDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
        </div>
        <ul className="quest-list">
          {quests.list.map((q) => (
            <li key={q.id} className={q.done ? 'done' : ''}>
              <span className="quest-icon">{q.done ? '✔' : q.icon}</span>
              <span className="grow">
                {q.text}
                {q.progress && !q.done && <span className="muted small"> · {q.progress}</span>}
              </span>
              <span className="xp-chip">+{q.xp}</span>
            </li>
          ))}
        </ul>
        <div className={`chest ${quests.allDone ? 'open' : ''}`}>
          <span className="chest-icon">{quests.allDone ? '🎁' : '🔒'}</span>
          <span className="grow">
            {quests.allDone ? 'Bonus chest opened!' : `Finish all quests for a bonus chest (${questsDone}/3)`}
          </span>
          <span className="xp-chip gold">+{XP.allQuests}</span>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>⚔️ Habits</h2>
          <span className="muted small">{habits.filter((h) => checks[h.id]).length}/{habits.length}</span>
        </div>
        {habits.length === 0 && (
          <p className="muted">
            No habits yet. <button className="link" onClick={() => goTo('habits')}>Add one</button>
          </p>
        )}
        <div className="habit-grid">
          {habits.map((h) => {
            const s = streak(data.checks, h.id)
            const done = !!checks[h.id]
            return (
              <button key={h.id} className={`habit-tile ${done ? 'done' : ''}`} onClick={() => actions.toggleCheck(date, h.id)}>
                <span className="tile-emoji">{h.emoji}</span>
                <span className="tile-name">{h.name}</span>
                <span className="tile-foot">
                  {s > 0 ? <span className="streak">🔥 {s}</span> : <span />}
                  <span className="xp-chip">{done ? '✔' : `+${XP.habit}`}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>✍️ Reflect</h2>
          <span className="xp-chip">+{XP.reflection}</span>
        </div>
        {PROMPTS.map((p) => (
          <label key={p.key} className="field">
            <span className="label">{p.label}</span>
            <textarea rows={2} value={entry[p.key] || ''} onChange={(e) => actions.saveEntry(date, { [p.key]: e.target.value })} />
          </label>
        ))}
        <label className="field">
          <span className="label">Anything else on your mind</span>
          <textarea rows={3} value={entry.notes || ''} onChange={(e) => actions.saveEntry(date, { notes: e.target.value })} />
        </label>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>🎯 Next goal steps</h2>
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
                  <span className="xp-chip">+{XP.step}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
