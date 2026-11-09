import { useState } from 'react'
import { daysUntil, prettyDate } from '../dates.js'

function Goal({ goal, actions }) {
  const [step, setStep] = useState('')
  const done = goal.steps.filter((s) => s.done).length
  const pct = goal.steps.length ? Math.round((done / goal.steps.length) * 100) : 0
  const left = goal.deadline ? daysUntil(goal.deadline) : null

  const addStep = (e) => {
    e.preventDefault()
    if (!step.trim()) return
    actions.addStep(goal.id, step.trim())
    setStep('')
  }

  return (
    <section className={`card ${goal.done ? 'faded' : ''}`}>
      <div className="card-head">
        <h2>{goal.done ? '✅ ' : ''}{goal.title}</h2>
        <span className="muted small">{pct}%</span>
      </div>
      {goal.why && <p className="why">Why: {goal.why}</p>}
      {goal.deadline && (
        <p className="muted small">
          By {prettyDate(goal.deadline, { day: 'numeric', month: 'long', year: 'numeric' })}
          {!goal.done && left >= 0 && ` · ${left} days left`}
          {!goal.done && left < 0 && ` · ${-left} days overdue`}
        </p>
      )}
      <div className="progress">
        <div style={{ width: `${pct}%` }} />
      </div>

      <ul className="checklist">
        {goal.steps.map((s) => (
          <li key={s.id}>
            <label className={s.done ? 'done' : ''}>
              <input type="checkbox" checked={s.done} onChange={() => actions.toggleStep(goal.id, s.id)} />
              <span className="grow">{s.text}</span>
              <button className="ghost small" onClick={(e) => { e.preventDefault(); actions.deleteStep(goal.id, s.id) }} aria-label="Remove step">✕</button>
            </label>
          </li>
        ))}
      </ul>

      {!goal.done && (
        <form className="row" onSubmit={addStep}>
          <input className="grow" placeholder="Add a small next step (+20 XP each)" value={step} onChange={(e) => setStep(e.target.value)} />
          <button>Add</button>
        </form>
      )}

      <div className="row tight end">
        <button className="ghost small" onClick={() => actions.editGoal(goal.id, { done: !goal.done })}>
          {goal.done ? 'Reopen' : 'Mark achieved 🏆 +100 XP'}
        </button>
        <button className="ghost small danger" onClick={() => window.confirm(`Delete "${goal.title}"?`) && actions.deleteGoal(goal.id)}>
          Delete
        </button>
      </div>
    </section>
  )
}

export default function Goals({ data, actions }) {
  const [form, setForm] = useState({ title: '', why: '', deadline: '' })
  const [open, setOpen] = useState(data.goals.length === 0)

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    actions.addGoal({ title: form.title.trim(), why: form.why.trim(), deadline: form.deadline || null })
    setForm({ title: '', why: '', deadline: '' })
    setOpen(false)
  }

  const active = data.goals.filter((g) => !g.done)
  const achieved = data.goals.filter((g) => g.done)

  return (
    <div className="stack">
      <div className="card-head">
        <h1>Goals</h1>
        {!open && <button className="primary" onClick={() => setOpen(true)}>New goal</button>}
      </div>

      {open && (
        <form className="card stack-sm" onSubmit={submit}>
          <label className="field">
            <span className="label">What do you want to achieve?</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Ride 200 km in one day" autoFocus />
          </label>
          <label className="field">
            <span className="label">Why does it matter to you?</span>
            <input value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} placeholder="Your reason keeps you going on hard days" />
          </label>
          <label className="field">
            <span className="label">Deadline (optional)</span>
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </label>
          <div className="row tight end">
            {data.goals.length > 0 && <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>}
            <button className="primary">Create goal</button>
          </div>
        </form>
      )}

      {active.map((g) => <Goal key={g.id} goal={g} actions={actions} />)}

      {achieved.length > 0 && (
        <>
          <h2 className="section-title">Achieved 🎉</h2>
          {achieved.map((g) => <Goal key={g.id} goal={g} actions={actions} />)}
        </>
      )}
    </div>
  )
}
