import { useState } from 'react'
import { Card, Seg, Sheet } from '../components/ui.jsx'
import { SessionRow } from '../components/workout.jsx'
import { addDays, fmtMinutes, shortDate, todayKey, weekday, weekStart, WEEKDAYS } from '../lib/dates.js'
import { adherence, emptyTraining, exerciseProgress, generatePlan, hasPlan, newSession, sessionById, SPORTS } from '../lib/training.js'
import { uid } from '../lib/store.js'

// ── Setup wizard ────────────────────────────────────────────────────────────

function DayPicker({ value, onChange, taken = [] }) {
  return (
    <div className="day-picker">
      {WEEKDAYS.map((d, i) => (
        <button
          type="button"
          key={d}
          className={`${value.includes(i) ? 'on' : ''} ${!value.includes(i) && taken.includes(i) ? 'taken' : ''}`}
          onClick={() => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i].sort())}
        >
          {d.slice(0, 2)}
        </button>
      ))}
    </div>
  )
}

function Setup({ data, actions, onDone, onCancel }) {
  const [choice, setChoice] = useState({ gym: [0, 2, 4], ride: [1, 5], run: [], other: [] })
  const [on, setOn] = useState({ gym: true, ride: true, run: false, other: false })
  const [focus, setFocus] = useState('strength')
  const [level, setLevel] = useState('intermediate')
  const [preview, setPreview] = useState(null)

  const active = Object.fromEntries(Object.entries(choice).map(([k, v]) => [k, on[k] ? v : []]))
  const taken = (sport) => Object.entries(active).filter(([k]) => k !== sport).flatMap(([, v]) => v)

  if (preview) {
    return (
      <Card title="Your weekly scheme" icon="✦">
        <p className="muted small">Here's the plan. You can change days, sessions and exercises after saving.</p>
        <WeekList data={{ ...data, training: preview }} preview />
        <div className="row tight end">
          <button className="ghost" onClick={() => setPreview(null)}>Back</button>
          <button className="primary" onClick={() => { actions.setTraining(preview); onDone() }}>Save scheme</button>
        </div>
      </Card>
    )
  }

  return (
    <Card title="Create your workout scheme" icon="🏋️">
      <p className="muted small">Choose what you train and on which days. The app builds a weekly plan you can fully edit.</p>
      {Object.entries(SPORTS).map(([k, sp]) => (
        <div key={k} className={`sport-pick ${on[k] ? 'on' : ''}`}>
          <label className="row">
            <input type="checkbox" checked={on[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} />
            <span className="grow"><b>{sp.icon} {sp.label}</b></span>
            {on[k] && <span className="muted small">{active[k].length}× / week</span>}
          </label>
          {on[k] && <DayPicker value={choice[k]} taken={taken(k)} onChange={(v) => setChoice({ ...choice, [k]: v })} />}
        </div>
      ))}
      {on.gym && (
        <div className="field">
          <span className="label">Gym focus</span>
          <Seg small value={focus} onChange={setFocus} options={[['strength', 'Strength'], ['muscle', 'Muscle'], ['general', 'General']]} />
        </div>
      )}
      <div className="field">
        <span className="label">Level</span>
        <Seg small value={level} onChange={setLevel} options={[['beginner', 'Beginner'], ['intermediate', 'Intermediate']]} />
      </div>
      <div className="row tight wrap end">
        {onCancel && <button className="ghost" onClick={onCancel}>Cancel</button>}
        <button className="ghost" onClick={() => { actions.setTraining({ ...emptyTraining(), sports: Object.keys(on).filter((k) => on[k]) }); onDone() }}>
          Build it myself
        </button>
        <button className="primary" disabled={!Object.values(active).some((v) => v.length)} onClick={() => setPreview(generatePlan({ choice: active, focus, level }))}>
          Generate →
        </button>
      </div>
    </Card>
  )
}

// ── Session editor ──────────────────────────────────────────────────────────

function SessionEditor({ initial, onSave, onDelete, onClose }) {
  const [s, setS] = useState(initial)
  const setEx = (id, ch) => setS({ ...s, exercises: s.exercises.map((e) => (e.id === id ? { ...e, ...ch } : e)) })
  const move = (i, dir) => {
    const ex = [...s.exercises]
    const j = i + dir
    if (j < 0 || j >= ex.length) return
    ;[ex[i], ex[j]] = [ex[j], ex[i]]
    setS({ ...s, exercises: ex })
  }
  return (
    <div className="stack-sm">
      <div className="row">
        <select value={s.sport} onChange={(e) => setS({ ...s, sport: e.target.value })} style={{ maxWidth: 150 }}>
          {Object.entries(SPORTS).map(([k, sp]) => <option key={k} value={k}>{sp.icon} {sp.short}</option>)}
        </select>
        <input className="grow" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Session name" />
      </div>
      <div className="unit-input">
        <span>Duration</span>
        <input type="number" min="5" step="5" value={s.minutes} onChange={(e) => setS({ ...s, minutes: Number(e.target.value) || 0 })} />
        <span>min</span>
      </div>
      <label className="field">
        <span className="label">{s.sport === 'gym' ? 'Notes' : 'What to do (intensity, intervals, route…)'}</span>
        <textarea rows={2} value={s.details} onChange={(e) => setS({ ...s, details: e.target.value })} />
      </label>
      {s.sport === 'gym' && (
        <div className="stack-sm">
          <span className="label">Exercises</span>
          <div className="ex-edit head"><span>Exercise</span><span>Sets</span><span>Reps</span><span /></div>
          {s.exercises.map((e, i) => (
            <div key={e.id} className="ex-edit">
              <input value={e.name} onChange={(ev) => setEx(e.id, { name: ev.target.value })} />
              <input type="number" min="1" value={e.sets} onChange={(ev) => setEx(e.id, { sets: Number(ev.target.value) || 1 })} />
              <input value={e.reps} onChange={(ev) => setEx(e.id, { reps: ev.target.value })} />
              <div className="row tight">
                <button className="icon-btn" onClick={() => move(i, -1)} aria-label="Up">↑</button>
                <button className="icon-btn" onClick={() => setS({ ...s, exercises: s.exercises.filter((x) => x.id !== e.id) })} aria-label="Remove">✕</button>
              </div>
            </div>
          ))}
          <button className="pill left" onClick={() => setS({ ...s, exercises: [...s.exercises, { id: uid(), name: '', sets: 3, reps: '10', weight: null }] })}>+ Exercise</button>
        </div>
      )}
      <div className="row tight end">
        {onDelete && <button className="ghost danger" onClick={() => window.confirm(`Delete "${s.name}"?`) && onDelete(s.id)}>Delete</button>}
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button className="primary" onClick={() => onSave({ ...s, exercises: s.exercises.filter((e) => e.name.trim()) })}>Save</button>
      </div>
    </div>
  )
}

// ── Week view ───────────────────────────────────────────────────────────────

function WeekList({ data, actions, ui, preview, editMode, onEdit, onAdd }) {
  const t = data.training
  const today = todayKey()
  const ws = weekStart(today)
  return (
    <ul className="week">
      {WEEKDAYS.map((name, i) => {
        const date = addDays(ws, i)
        const sessions = (t.days[i] || []).map((id) => sessionById(data, id)).filter(Boolean)
        const isToday = i === weekday(today)
        return (
          <li key={name} className={isToday ? 'today' : ''}>
            <div className="week-day">
              <b>{name}</b>
              <span className="muted small">{shortDate(date)}</span>
            </div>
            <div className="grow">
              {sessions.length === 0 && <p className="muted small rest">Rest</p>}
              {preview ? (
                sessions.map((s) => (
                  <p key={s.id} className="small">
                    {SPORTS[s.sport].icon} <b>{s.name}</b> <span className="muted">· {fmtMinutes(s.minutes)}{s.exercises.length ? ` · ${s.exercises.map((e) => e.name).join(', ')}` : ''}</span>
                  </p>
                ))
              ) : (
                <ul className="sessions">
                  {sessions.map((s) => (
                    <div key={s.id} className="week-session">
                      {date <= today && !editMode ? (
                        <SessionRow data={data} actions={actions} ui={ui} date={date} session={s} compact />
                      ) : (
                        <li className="session">
                          <span className="session-icon">{SPORTS[s.sport].icon}</span>
                          <div className="grow"><p className="session-name">{s.name}</p><p className="muted small">~{fmtMinutes(s.minutes)}</p></div>
                        </li>
                      )}
                      {editMode && (
                        <div className="row tight session-tools">
                          <button className="icon-btn" onClick={() => onEdit(s)} aria-label="Edit session">✎</button>
                          <button className="icon-btn" onClick={() => actions.setTrainingDay(i, t.days[i].filter((x) => x !== s.id))} aria-label="Remove from day">✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                </ul>
              )}
            </div>
            {editMode && <button className="pill add-day" onClick={() => onAdd(i)} aria-label={`Add to ${name}`}>＋ Add</button>}
          </li>
        )
      })}
    </ul>
  )
}

function AddToDay({ data, actions, dayIndex, onNew, onClose }) {
  const t = data.training
  const library = t.sessions.filter((s) => !s.archived)
  const add = (id) => {
    actions.setTrainingDay(dayIndex, [...t.days[dayIndex], id])
    onClose()
  }
  return (
    <div className="stack-sm">
      {library.length > 0 && <span className="label">Your sessions</span>}
      <ul className="items">
        {library.map((s) => (
          <li key={s.id}>
            <span>{SPORTS[s.sport].icon}</span>
            <span className="grow">{s.name} <span className="muted small">· {fmtMinutes(s.minutes)}</span></span>
            <button className="pill" onClick={() => add(s.id)}>Add</button>
          </li>
        ))}
      </ul>
      <span className="label">Or create a new one</span>
      <div className="row tight wrap">
        {Object.entries(SPORTS).map(([k, sp]) => (
          <button key={k} className="pill" onClick={() => onNew(k)}>{sp.icon} New {sp.short.toLowerCase()}</button>
        ))}
      </div>
    </div>
  )
}

// ── Progress ────────────────────────────────────────────────────────────────

function Spark({ values }) {
  if (values.length < 2) return null
  const W = 90
  const H = 26
  const min = Math.min(...values)
  const max = Math.max(...values)
  const y = (v) => (max === min ? H / 2 : H - 3 - ((v - min) / (max - min)) * (H - 6))
  return (
    <svg width={W} height={H} className="spark">
      <polyline points={values.map((v, i) => `${(i / (values.length - 1)) * (W - 4) + 2},${y(v)}`).join(' ')} />
    </svg>
  )
}

function Progress({ data }) {
  const today = todayKey()
  const weeks = Array.from({ length: 6 }, (_, i) => addDays(weekStart(today), -7 * (5 - i)))
  const adh = weeks.map((w) => ({ w, ...adherence(data, w, addDays(w, 6)) }))
  const lifts = exerciseProgress(data)
  return (
    <>
      <Card title="Sessions done per week" icon="✓">
        <div className="adherence">
          {adh.map((a) => (
            <div key={a.w}>
              <div className="adh-bar"><i style={{ height: a.planned ? `${(a.done / a.planned) * 100}%` : 0 }} /></div>
              <b>{a.planned ? `${a.done}/${a.planned}` : '–'}</b>
              <span className="muted">{shortDate(a.w)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Strength progress" icon="📈">
        {lifts.length === 0 && <p className="muted">Log a gym workout to see your lifts here. Your best set and estimated 1-rep max are tracked per exercise.</p>}
        <ul className="items">
          {lifts.map((l) => (
            <li key={l.name}>
              <div className="grow">
                <p><b>{l.name}</b></p>
                <p className="muted small">
                  Last: {l.last.weight} kg × {l.last.reps} · Best: {l.best.weight} kg × {l.best.reps}
                  {l.best.e1rm ? ` (≈ ${l.best.e1rm} kg 1RM)` : ''}
                  {l.history.length > 1 && l.last.weight !== l.first.weight && ` · ${l.last.weight > l.first.weight ? '+' : ''}${Math.round((l.last.weight - l.first.weight) * 10) / 10} kg since ${shortDate(l.first.date)}`}
                </p>
              </div>
              <Spark values={l.history.map((h) => h.e1rm || h.weight)} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Train({ data, actions, ui }) {
  const [tab, setTab] = useState('week')
  const [setup, setSetup] = useState(false)
  const [editing, setEditing] = useState(null) // session being edited
  const [addDay, setAddDay] = useState(null)
  const [newForDay, setNewForDay] = useState(null)
  const [editMode, setEditMode] = useState(false)

  if (!hasPlan(data) && !data.training?.sports?.length || setup) {
    return (
      <div className="stack">
        <header className="page-head"><h1>Train</h1></header>
        <Setup data={data} actions={actions} onDone={() => setSetup(false)} onCancel={hasPlan(data) ? () => setSetup(false) : null} />
        <p className="muted small center">Grow can’t send workouts to your Garmin watch (Garmin only allows reading), but sessions tick themselves off when your watch logs a matching ride, run or strength workout.</p>
      </div>
    )
  }

  const t = data.training
  const wk = adherence(data, weekStart(todayKey()), addDays(weekStart(todayKey()), 6))
  const planned = t.days.flat().length

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>Train</h1>
          <p className="muted small">{planned} sessions per week{wk?.planned ? ` · ${wk.done}/${wk.planned} done so far this week` : ''}</p>
        </div>
        <button className="ghost small" onClick={() => window.confirm('Generate a new scheme? Your workout history is kept.') && setSetup(true)}>New scheme</button>
      </header>
      <Seg value={tab} onChange={setTab} options={[['week', 'This week'], ['sessions', 'Sessions'], ['progress', 'Progress']]} />

      {tab === 'week' && (
        <Card
          title={editMode ? 'Edit your week' : 'This week'}
          right={<button className={editMode ? 'primary small' : 'pill'} onClick={() => setEditMode(!editMode)}>{editMode ? 'Done' : '✎ Edit week'}</button>}
        >
          {editMode && <p className="muted small">Add sessions to days, remove them, or tap ✎ to change a session (name, duration, exercises).</p>}
          <WeekList data={data} actions={actions} ui={ui} editMode={editMode} onEdit={setEditing} onAdd={setAddDay} />
        </Card>
      )}

      {tab === 'sessions' && (
        <Card title="Your sessions" icon="🗂" right={<button className="pill" onClick={() => setEditing(newSession('gym'))}>+ New</button>}>
          <ul className="items">
            {t.sessions.filter((s) => !s.archived).map((s) => {
              const days = t.days.map((ids, i) => (ids.includes(s.id) ? WEEKDAYS[i] : null)).filter(Boolean)
              return (
                <li key={s.id}>
                  <span>{SPORTS[s.sport].icon}</span>
                  <div className="grow">
                    <p>{s.name}</p>
                    <p className="muted small">{fmtMinutes(s.minutes)} · {days.length ? days.join(', ') : 'not scheduled'}</p>
                  </div>
                  <button className="icon-btn" onClick={() => setEditing(s)} aria-label="Edit">✎</button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {tab === 'progress' && <Progress data={data} />}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing && sessionById(data, editing.id) ? 'Edit session' : 'New session'}>
        {editing && (
          <SessionEditor
            key={editing.id}
            initial={editing}
            onClose={() => setEditing(null)}
            onDelete={sessionById(data, editing.id) ? (id) => { actions.deleteTrainingSession(id); setEditing(null) } : null}
            onSave={(s) => {
              actions.saveTrainingSession(s)
              if (newForDay !== null && !t.days[newForDay].includes(s.id)) actions.setTrainingDay(newForDay, [...t.days[newForDay], s.id])
              setNewForDay(null)
              setEditing(null)
            }}
          />
        )}
      </Sheet>

      <Sheet open={addDay !== null} onClose={() => setAddDay(null)} title={addDay !== null ? `Add to ${WEEKDAYS[addDay]}` : ''}>
        {addDay !== null && (
          <AddToDay
            data={data}
            actions={actions}
            dayIndex={addDay}
            onClose={() => setAddDay(null)}
            onNew={(sport) => { setNewForDay(addDay); setAddDay(null); setEditing(newSession(sport)) }}
          />
        )}
      </Sheet>
    </div>
  )
}
