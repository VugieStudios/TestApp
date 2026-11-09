import { useState } from 'react'
import { Card, Seg, XpChip } from '../components/ui.jsx'
import { daysUntil, shortDate, todayKey } from '../lib/dates.js'
import { breakdown, CATEGORIES, detectCategory, goalPace, goalProgress, guessMode, parseMeasurable } from '../lib/goals.js'
import { uid } from '../lib/store.js'
import { XP } from '../lib/game.js'

// textarea that grows with its text
const grow = (el) => {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function StepEditor({ steps, setSteps }) {
  const [text, setText] = useState('')
  return (
    <div className="stack-sm">
      <ol className="plan">
        {steps.map((s, i) => (
          <li key={s.id}>
            <span className="plan-n">{i + 1}</span>
            <textarea
              rows={1}
              ref={grow}
              value={s.text}
              onChange={(e) => { grow(e.target); setSteps(steps.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x))) }}
            />
            <span className="muted small nowrap">{s.plannedFor ? shortDate(s.plannedFor) : ''}</span>
            <button type="button" className="icon-btn" onClick={() => setSteps(steps.filter((x) => x.id !== s.id))} aria-label="Remove">✕</button>
          </li>
        ))}
      </ol>
      <div className="row">
        <input className="grow" placeholder="Add your own step" value={text} onChange={(e) => setText(e.target.value)} />
        <button
          type="button"
          onClick={() => {
            if (!text.trim()) return
            setSteps([...steps, { id: uid(), text: text.trim(), done: false, doneAt: null, plannedFor: steps.at(-1)?.plannedFor || todayKey(), minutes: 25 }])
            setText('')
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

function MeasureBox({ measure, setMeasure }) {
  const level = measure.mode === 'level'
  return (
    <div className="measure">
      <p className="label">Measurable goal: {measure.unit === '€' ? `€${measure.amount}` : `${measure.amount} ${measure.unit}`}</p>
      <Seg
        small
        value={measure.mode}
        onChange={(mode) => setMeasure({ ...measure, mode })}
        options={[['level', 'Reach a level'], ['total', 'Build up a total']]}
      />
      <p className="muted small">
        {level ? 'Like bench 65 kg or FTP 300 W: steps go up gradually from where you are now.' : 'Like 500 km this month or 12 books: the amount is split into chunks.'}
      </p>
      <label className="field">
        <span className="label">{level ? 'Where are you now?' : 'Already done so far'}</span>
        <div className="unit-input">
          <input type="number" inputMode="decimal" min="0" value={measure.start} placeholder={level ? 'e.g. 40' : '0'} onChange={(e) => setMeasure({ ...measure, start: e.target.value })} />
          <span>{measure.unit}</span>
        </div>
        {level && measure.start === '' && <span className="muted small">Leave empty and the plan starts with a test of your current level.</span>}
      </label>
    </div>
  )
}

function NewGoal({ actions, onClose, initial }) {
  const [f, setF] = useState(
    initial
      ? { title: initial.title, why: initial.why || '', horizon: initial.horizon, deadline: initial.deadline || '', category: initial.category }
      : { title: '', why: '', horizon: 'short', deadline: '', category: 'general' }
  )
  const [measure, setMeasure] = useState(() => {
    if (!initial) return null
    if (initial.measure) return initial.measure
    const m = parseMeasurable(initial.title)
    return m && { ...m, mode: guessMode(initial.title, m.unit), start: '' }
  })
  const [steps, setSteps] = useState(null)
  const [touchedCat, setTouchedCat] = useState(!!initial)

  // detect a number + unit in the title, keep the user's choices if the unit stays the same
  const setTitle = (title) => {
    setF({ ...f, title, category: touchedCat ? f.category : detectCategory(title) })
    const m = parseMeasurable(title)
    if (!m) return setMeasure(null)
    setMeasure((old) => ({ ...m, mode: old && old.unit === m.unit ? old.mode : guessMode(title, m.unit), start: old && old.unit === m.unit ? old.start : '' }))
  }

  const generate = (e) => {
    e?.preventDefault()
    if (!f.title.trim()) return
    setSteps(breakdown({ ...f, deadline: f.deadline || null, measure }))
  }

  const save = () => {
    const fields = { ...f, title: f.title.trim(), deadline: f.deadline || null, measure }
    if (initial) {
      actions.editGoal(initial.id, fields)
      actions.setSteps(initial.id, [...initial.steps.filter((x) => x.done), ...steps])
    } else {
      actions.addGoal({ ...fields, steps })
    }
    onClose()
  }

  if (steps) {
    return (
      <Card title="Your plan" icon="✦">
        <p className="muted small">
          {measure
            ? measure.mode === 'level'
              ? `Gradual steps from ${measure.start === '' ? 'your tested level' : `${measure.start} ${measure.unit}`} up to ${measure.amount} ${measure.unit}.`
              : `The remaining amount split into equal chunks.`
            : `Built from the ${CATEGORIES[f.category].label.toLowerCase()} template.`}{' '}
          Edit anything you like. Each step becomes a micro-goal on your dashboard on its date.
          {initial && initial.steps.some((x) => x.done) && ' Steps you already finished are kept.'}
        </p>
        <StepEditor steps={steps} setSteps={setSteps} />
        <div className="row tight end">
          <button className="ghost" onClick={() => setSteps(null)}>Back</button>
          <button className="primary" onClick={save} disabled={!steps.length}>{initial ? 'Save new plan' : 'Save goal'}</button>
        </div>
      </Card>
    )
  }

  return (
    <Card title={initial ? `Re-plan: ${initial.title}` : 'New goal'} icon="◎">
      <form className="stack-sm" onSubmit={generate}>
        <label className="field">
          <span className="label">What do you want to achieve?</span>
          <input autoFocus={!initial} value={f.title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bench 65 kg, Ride 500 km in December, Learn basic Spanish" />
        </label>
        {measure && <MeasureBox measure={measure} setMeasure={setMeasure} />}
        <label className="field">
          <span className="label">Why does it matter?</span>
          <input value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} placeholder="Your reason keeps you going on hard days" />
        </label>
        <Seg value={f.horizon} onChange={(horizon) => setF({ ...f, horizon })} options={[['short', 'Short-term (weeks)'], ['long', 'Long-term (months+)']]} />
        <div className="row wrap">
          <label className="field grow">
            <span className="label">Deadline</span>
            <input type="date" value={f.deadline} min={todayKey()} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
          </label>
          {!measure && (
            <label className="field grow">
              <span className="label">Type {!touchedCat && f.title && '(auto-detected)'}</span>
              <select value={f.category} onChange={(e) => { setTouchedCat(true); setF({ ...f, category: e.target.value }) }}>
                {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.icon} {c.label}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="row tight end">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!f.title.trim()}>Break it down →</button>
        </div>
      </form>
    </Card>
  )
}

function GoalCard({ g, actions, ui }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [editingPlan, setEditingPlan] = useState(null)
  const [replanning, setReplanning] = useState(false)
  const pct = Math.round(goalProgress(g) * 100)
  const pace = goalPace(g)
  const next = g.steps.find((s) => !s.done)
  const left = g.deadline ? daysUntil(g.deadline) : null

  if (replanning) return <NewGoal actions={actions} initial={g} onClose={() => setReplanning(false)} />

  if (editingPlan) {
    return (
      <Card title={`Edit plan: ${g.title}`}>
        <StepEditor steps={editingPlan} setSteps={setEditingPlan} />
        <div className="row tight end">
          <button className="ghost" onClick={() => setEditingPlan(null)}>Cancel</button>
          <button className="primary" onClick={() => { actions.setSteps(g.id, editingPlan); setEditingPlan(null) }}>Save plan</button>
        </div>
      </Card>
    )
  }

  return (
    <section className={`card goal ${g.done ? 'faded' : ''}`}>
      <div className="card-head">
        <div className="grow">
          <p className="eyebrow">{CATEGORIES[g.category]?.icon} {g.horizon === 'long' ? 'Long-term' : 'Short-term'}</p>
          <h2>{g.done && '🏆 '}{g.title}</h2>
          {g.why && <p className="why">“{g.why}”</p>}
        </div>
        <div className="goal-pct">{pct}%</div>
      </div>
      <div className="progress"><div style={{ width: `${pct}%` }} /></div>
      <div className="row wrap small muted">
        <span>{g.steps.filter((s) => s.done).length}/{g.steps.length} steps</span>
        {left !== null && !g.done && <span>· {left >= 0 ? `${left} days left` : `${-left} days overdue`}</span>}
        {!g.done && g.steps.length > 0 && (
          <span className={`tag ${pace < 0 ? 'warn' : 'good'}`}>{pace < 0 ? `${-pace} behind plan` : pace > 0 ? `${pace} ahead` : 'on track'}</span>
        )}
      </div>

      {next && !g.done && (
        <div className="next-step">
          <div className="grow">
            <p className="label">Next micro-goal</p>
            <p>{next.text}</p>
          </div>
          <div className="item-actions">
            <button className="pill" onClick={() => ui.kick({ type: 'step', id: next.id, goalId: g.id, label: next.text })}>1 min</button>
            <button className="pill" onClick={() => ui.focus({ type: 'step', id: next.id, goalId: g.id, label: next.text })}>▶</button>
            <button className="check" onClick={() => actions.toggleStep(g.id, next.id)} aria-label="Done" />
          </div>
        </div>
      )}

      <button className="link small left" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} all steps</button>
      {open && (
        <>
          <ul className="steps">
            {g.steps.map((s) => (
              <li key={s.id} className={s.done ? 'done' : ''}>
                <input type="checkbox" checked={s.done} onChange={() => actions.toggleStep(g.id, s.id)} />
                <span className="grow">{s.text}</span>
                <span className="muted small nowrap">{s.plannedFor && shortDate(s.plannedFor)}</span>
              </li>
            ))}
          </ul>
          {!g.done && (
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { actions.addStep(g.id, text.trim()); setText('') } }}>
              <input className="grow" placeholder="Add a step" value={text} onChange={(e) => setText(e.target.value)} />
              <button>Add</button>
            </form>
          )}
          <div className="row tight wrap end">
            <button className="ghost small" onClick={() => setEditingPlan(g.steps)}>Edit plan</button>
            {!g.done && <button className="ghost small" onClick={() => setReplanning(true)}>Re-plan</button>}
            <button className="ghost small" onClick={() => actions.editGoal(g.id, { done: !g.done })}>{g.done ? 'Reopen' : <>Mark achieved <XpChip n={XP.goal} /></>}</button>
            <button className="ghost small danger" onClick={() => window.confirm(`Delete "${g.title}"?`) && actions.deleteGoal(g.id)}>Delete</button>
          </div>
        </>
      )}
    </section>
  )
}

export default function Goals({ data, actions, ui, embedded }) {
  const [adding, setAdding] = useState(data.goals.length === 0)
  const [filter, setFilter] = useState('all')
  const list = data.goals.filter((g) => !g.done && (filter === 'all' || g.horizon === filter))
  const achieved = data.goals.filter((g) => g.done)

  return (
    <div className="stack">
      <header className="page-head">
        {embedded ? <p className="muted small">Big goals, broken into daily micro-goals</p> : <h1>Goals</h1>}
        {!adding && <button className="primary" onClick={() => setAdding(true)}>+ New goal</button>}
      </header>
      {adding && <NewGoal actions={actions} onClose={() => setAdding(false)} />}
      {data.goals.length > 0 && <Seg value={filter} onChange={setFilter} options={[['all', 'All'], ['short', 'Short-term'], ['long', 'Long-term']]} />}
      {list.map((g) => <GoalCard key={g.id} g={g} actions={actions} ui={ui} />)}
      {!adding && list.length === 0 && <p className="muted center">No active goals here.</p>}
      {achieved.length > 0 && (
        <>
          <h2 className="section-title">Achieved</h2>
          {achieved.map((g) => <GoalCard key={g.id} g={g} actions={actions} ui={ui} />)}
        </>
      )}
    </div>
  )
}
