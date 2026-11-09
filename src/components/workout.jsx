import { useState } from 'react'
import { Card, XpChip } from './ui.jsx'
import { fmtMinutes, prettyDate, shortDate, todayKey, weekday, addDays, WEEKDAYS } from '../lib/dates.js'
import { hasPlan, isSessionDone, lastPerformance, logFor, sessionById, sessionsForDay, SPORTS, suggestion } from '../lib/training.js'
import { XP } from '../lib/game.js'

const fmtKg = (w) => (w === null || w === undefined || w === '' ? '' : `${Number(w)} kg`)

function setsSummary(sets) {
  return sets.map((s) => `${s.weight ? `${Number(s.weight)}×` : ''}${s.reps || '?'}`).join(', ')
}

// One exercise inside the logger
function ExerciseLog({ data, actions, date, session, exercise }) {
  const log = logFor(data, date, session.id)
  const saved = log?.sets?.[exercise.id]
  const sug = suggestion(data, exercise)
  const last = lastPerformance(data, exercise.name, date)
  const sets = saved || Array.from({ length: exercise.sets }, () => ({ weight: '', reps: '', done: false }))
  const placeholderW = sug?.weight ?? exercise.weight ?? ''
  const placeholderR = /^\d+$/.test(exercise.reps) ? exercise.reps : ''

  const save = (next) => actions.logSets(date, session.id, exercise.id, next)
  const setField = (i, k, v) => save(sets.map((s, j) => (j === i ? { ...s, [k]: v } : s)))
  const toggle = (i) =>
    save(
      sets.map((s, j) =>
        j === i ? { ...s, done: !s.done, weight: s.weight === '' && !s.done ? String(placeholderW) : s.weight, reps: s.reps === '' && !s.done ? placeholderR : s.reps } : s
      )
    )

  return (
    <div className="exlog">
      <div className="exlog-head">
        <b>{exercise.name}</b>
        <span className="muted small">{exercise.sets} × {exercise.reps}</span>
      </div>
      {(last || sug) && (
        <p className="muted small">
          {last && <>Last time ({shortDate(last.date)}): {setsSummary(last.sets)}. </>}
          {sug && <span className="accent-text">Try {fmtKg(sug.weight)}: {sug.why}.</span>}
        </p>
      )}
      <div className="set-grid">
        <span className="label">Set</span>
        <span className="label">kg</span>
        <span className="label">Reps</span>
        <span />
        {sets.map((s, i) => (
          <SetRow key={i} i={i} s={s} placeholderW={placeholderW} placeholderR={placeholderR} setField={setField} toggle={toggle} />
        ))}
      </div>
      <div className="row tight">
        <button className="pill" onClick={() => save([...sets, { weight: sets.at(-1)?.weight || '', reps: '', done: false }])}>+ Set</button>
        {sets.length > 1 && <button className="pill" onClick={() => save(sets.slice(0, -1))}>− Set</button>}
      </div>
    </div>
  )
}

function SetRow({ i, s, placeholderW, placeholderR, setField, toggle }) {
  return (
    <>
      <span className={`set-n ${s.done ? 'done' : ''}`}>{i + 1}</span>
      <input type="number" inputMode="decimal" step="0.5" value={s.weight} placeholder={String(placeholderW)} onChange={(e) => setField(i, 'weight', e.target.value)} />
      <input type="number" inputMode="numeric" value={s.reps} placeholder={placeholderR || 'reps'} onChange={(e) => setField(i, 'reps', e.target.value)} />
      <button className={`set-check ${s.done ? 'on' : ''}`} onClick={() => toggle(i)} aria-label={`Set ${i + 1} done`}>✓</button>
    </>
  )
}

export function WorkoutLogger({ data, actions, date, sessionId, onClose }) {
  const session = sessionById(data, sessionId)
  if (!session) return null
  const done = isSessionDone(data, date, session.id)
  return (
    <div className="stack-sm">
      <p className="muted small">{prettyDate(date)} · ~{fmtMinutes(session.minutes)}{session.details ? ` · ${session.details}` : ''}</p>
      {session.exercises.map((e) => (
        <ExerciseLog key={e.id} data={data} actions={actions} date={date} session={session} exercise={e} />
      ))}
      <p className="muted small">Tip: tap ✓ on an empty set to log the suggested weight and reps.</p>
      <div className="row tight end">
        {done ? (
          <button className="ghost" onClick={() => actions.markSession(date, session.id, false)}>Mark as not done</button>
        ) : (
          <button className="primary" onClick={() => { actions.markSession(date, session.id, true); onClose() }}>
            Finish workout <XpChip n={XP.session} />
          </button>
        )}
      </div>
    </div>
  )
}

// A planned session (Today widget and Train week view)
export function SessionRow({ data, actions, ui, date, session, compact }) {
  const [open, setOpen] = useState(false)
  const log = logFor(data, date, session.id)
  const done = !!log?.done
  const sport = SPORTS[session.sport]
  return (
    <li className={`session ${done ? 'done' : ''}`}>
      <span className="session-icon">{sport.icon}</span>
      <div className="grow" onClick={() => setOpen(!open)}>
        <p className="session-name">{session.name}</p>
        <p className="muted small">
          ~{fmtMinutes(session.minutes)}
          {session.sport === 'gym' && ` · ${session.exercises.length} exercises`}
          {done && log.source === 'garmin' && ' · ⌚ done via Garmin'}
        </p>
        {open && !compact && (
          <div className="session-more">
            {session.details && <p className="small">{session.details}</p>}
            {session.exercises.length > 0 && (
              <p className="muted small">{session.exercises.map((e) => `${e.name} ${e.sets}×${e.reps}`).join(' · ')}</p>
            )}
          </div>
        )}
      </div>
      {session.sport === 'gym' && (
        <button className={done ? 'pill' : 'primary small'} onClick={() => ui.logWorkout(date, session.id)}>{done ? 'View' : 'Log'}</button>
      )}
      <button className={`check ${done ? 'on' : ''}`} onClick={() => actions.markSession(date, session.id, !done)} aria-label={done ? 'Mark not done' : 'Mark done'}>
        {done ? '✓' : ''}
      </button>
    </li>
  )
}

// Next planned session after today
function nextSession(data) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(todayKey(), i)
    const s = sessionsForDay(data, d)
    if (s.length) return { d, s: s[0] }
  }
  return null
}

export function TrainingWidget({ data, actions, ui }) {
  const today = todayKey()
  if (!hasPlan(data)) {
    return (
      <Card title="Training" icon="🏋️">
        <p className="muted">No workout scheme yet. Build one for gym, cycling or running in a minute.</p>
        <button className="primary" onClick={() => ui.goTo('train')}>Create my scheme</button>
      </Card>
    )
  }
  const list = sessionsForDay(data, today)
  const next = nextSession(data)
  const done = list.filter((s) => isSessionDone(data, today, s.id)).length
  return (
    <Card title="Today’s training" icon="🏋️" right={<button className="link small" onClick={() => ui.goTo('train')}>Scheme →</button>}>
      {list.length === 0 ? (
        <p className="muted">
          Rest day 💤{next && <> Next: <b>{WEEKDAYS[weekday(next.d)]}</b>, {next.s.name}.</>}
        </p>
      ) : (
        <>
          {list.length > 1 && <span className="muted small">{done}/{list.length} done</span>}
          <ul className="sessions">
            {list.map((s) => <SessionRow key={s.id} data={data} actions={actions} ui={ui} date={today} session={s} />)}
          </ul>
        </>
      )}
    </Card>
  )
}
