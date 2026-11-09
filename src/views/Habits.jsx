import { useState } from 'react'
import { Card, Seg } from '../components/ui.jsx'
import { lastDays, prettyDate, todayKey, WEEKDAYS } from '../lib/dates.js'
import { ACTIVITY_KINDS, describeRule } from '../lib/garmin.js'
import { bestStreak, describeSchedule, isDone, isExcused, isScheduled, streakInfo, weekCount } from '../lib/habits.js'

const EMPTY = { name: '', emoji: '', schedule: { type: 'daily' }, core: false, garmin: null }

function GarminRule({ rule, onChange }) {
  const type = rule?.type || 'none'
  const setType = (t) =>
    onChange(t === 'none' ? null : t === 'activity' ? { type: t, kind: 'any', minMinutes: 20 } : t === 'steps' ? { type: t, min: 10000 } : { type: t, minHours: 7 })
  return (
    <div className="measure">
      <p className="label">⌚ Auto-complete with Garmin</p>
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="none">Off: I tick it myself</option>
        <option value="activity">When I log a workout</option>
        <option value="steps">When I reach a step count</option>
        <option value="sleep">When I sleep long enough</option>
      </select>
      {type === 'activity' && (
        <>
          <select value={rule.kind} onChange={(e) => onChange({ ...rule, kind: e.target.value })}>
            {Object.entries(ACTIVITY_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <div className="unit-input"><span>at least</span><input type="number" min="1" value={rule.minMinutes} onChange={(e) => onChange({ ...rule, minMinutes: Number(e.target.value) || 1 })} /><span>minutes</span></div>
        </>
      )}
      {type === 'steps' && (
        <div className="unit-input"><input type="number" min="100" step="500" value={rule.min} onChange={(e) => onChange({ ...rule, min: Number(e.target.value) || 1000 })} /><span>steps or more</span></div>
      )}
      {type === 'sleep' && (
        <div className="unit-input"><input type="number" min="1" max="12" step="0.5" value={rule.minHours} onChange={(e) => onChange({ ...rule, minHours: Number(e.target.value) || 7 })} /><span>hours or more</span></div>
      )}
    </div>
  )
}

function HabitForm({ initial = EMPTY, onSave, onCancel, submitLabel, garminOn }) {
  const [f, setF] = useState({ garmin: null, ...initial })
  const s = f.schedule
  const setSchedule = (type) =>
    setF({ ...f, schedule: type === 'daily' ? { type } : type === 'days' ? { type, days: s.days || [0, 2, 4] } : { type, times: s.times || 3 } })

  const submit = (e) => {
    e.preventDefault()
    if (!f.name.trim()) return
    if (s.type === 'days' && !s.days.length) return
    onSave({ ...f, name: f.name.trim(), emoji: f.emoji.trim() || '✦' })
  }

  return (
    <form className="stack-sm" onSubmit={submit}>
      <div className="row">
        <input className="emoji-input" placeholder="🙂" value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} maxLength={4} aria-label="Emoji" />
        <input className="grow" placeholder="Habit name, e.g. Pray in the morning" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
      </div>
      <Seg value={s.type} onChange={setSchedule} options={[['daily', 'Every day'], ['days', 'Specific days'], ['weekly', 'X per week']]} />
      {s.type === 'days' && (
        <div className="day-picker">
          {WEEKDAYS.map((d, i) => (
            <button
              type="button"
              key={d}
              className={s.days.includes(i) ? 'on' : ''}
              onClick={() => setF({ ...f, schedule: { ...s, days: s.days.includes(i) ? s.days.filter((x) => x !== i) : [...s.days, i].sort() } })}
            >
              {d[0]}
            </button>
          ))}
        </div>
      )}
      {s.type === 'weekly' && (
        <div className="row">
          <span className="grow muted">Times per week</span>
          <div className="stepper">
            <button type="button" onClick={() => setF({ ...f, schedule: { ...s, times: Math.max(1, s.times - 1) } })}>−</button>
            <b>{s.times}</b>
            <button type="button" onClick={() => setF({ ...f, schedule: { ...s, times: Math.min(7, s.times + 1) } })}>+</button>
          </div>
        </div>
      )}
      <label className="switch-row">
        <span className="grow">
          <b>Core habit</b>
          <span className="muted small block">Stays visible in Low Energy Mode. Pick your 1–3 most important.</span>
        </span>
        <input type="checkbox" checked={f.core} onChange={(e) => setF({ ...f, core: e.target.checked })} />
      </label>
      {garminOn && <GarminRule rule={f.garmin} onChange={(garmin) => setF({ ...f, garmin })} />}
      <div className="row tight end">
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
        <button className="primary">{submitLabel}</button>
      </div>
    </form>
  )
}

function Heat({ data, h, info }) {
  const days = lastDays(28)
  return (
    <div className="heat">
      {days.map((d) => {
        const done = isDone(data, h, d)
        let cls = 'off'
        if (done) cls = 'on'
        else if (info.frozen.has(d)) cls = 'frozen'
        else if (d < h.createdAt || isExcused(data, h, d)) cls = 'na'
        else if (h.schedule.type !== 'weekly' && !isScheduled(h, d)) cls = 'na'
        else if (d === todayKey()) cls = 'today'
        else if (h.schedule.type !== 'weekly') cls = 'miss'
        return <span key={d} className={cls} title={`${prettyDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}${cls === 'frozen' ? ' (freeze used)' : ''}`}>{cls === 'frozen' ? '❄' : ''}</span>
      })}
    </div>
  )
}

function HabitCard({ data, actions, h }) {
  const [editing, setEditing] = useState(false)
  const info = streakInfo(data, h)
  if (editing) {
    return (
      <Card title="Edit habit">
        <HabitForm initial={h} garminOn={!!data.garmin?.enabled} submitLabel="Save" onCancel={() => setEditing(false)} onSave={(f) => { actions.editHabit(h.id, f); setEditing(false) }} />
      </Card>
    )
  }
  return (
    <section className="card habit-card">
      <div className="card-head">
        <div className="row grow">
          <span className="emoji big">{h.emoji}</span>
          <div className="grow">
            <h2>{h.name} {h.core && <span className="tag">core</span>}</h2>
            <p className="muted small">
              {describeSchedule(h.schedule)}
              {h.schedule.type === 'weekly' && ` · ${weekCount(data, h, todayKey())}/${h.schedule.times} this week`}
              {h.garmin && data.garmin?.enabled && <span className="tag good">⌚ {describeRule(h.garmin)}</span>}
            </p>
          </div>
        </div>
        <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit">✎</button>
      </div>
      <div className="streak-row">
        <div><b>{info.count}</b><span>{info.unit === 'week' ? 'week' : 'day'} streak</span></div>
        <div><b>{bestStreak(data, h)}</b><span>best</span></div>
        <div><b>{'❄'.repeat(info.freezesLeft) || '–'}</b><span>freezes left</span></div>
      </div>
      <Heat data={data} h={h} info={info} />
      <div className="row tight end">
        <button className="ghost small" onClick={() => actions.editHabit(h.id, { archived: true })}>Pause</button>
      </div>
    </section>
  )
}

export default function Habits({ data, actions }) {
  const [adding, setAdding] = useState(false)
  const active = data.habits.filter((h) => !h.archived)
  const paused = data.habits.filter((h) => h.archived)

  return (
    <div className="stack">
      <header className="page-head">
        <h1>Habits</h1>
        {!adding && <button className="primary" onClick={() => setAdding(true)}>+ New habit</button>}
      </header>

      {adding && (
        <Card title="New habit">
          <HabitForm garminOn={!!data.garmin?.enabled} submitLabel="Add habit" onCancel={() => setAdding(false)} onSave={(f) => { actions.addHabit(f); setAdding(false) }} />
        </Card>
      )}

      <Card title="Streak freezes" icon="❄">
        <p className="muted small">Missed a day? A freeze saves your streak automatically. You get this many per habit, per week.</p>
        <Seg value={data.settings.freezesPerWeek} onChange={(v) => actions.setSettings({ freezesPerWeek: v })} options={[[0, 'None'], [1, '1 / week'], [2, '2 / week']]} />
      </Card>

      {active.map((h) => <HabitCard key={h.id} data={data} actions={actions} h={h} />)}

      <div className="legend">
        <span><i className="on" /> done</span>
        <span><i className="frozen" /> freeze</span>
        <span><i className="miss" /> missed</span>
        <span><i className="na" /> not scheduled</span>
      </div>

      {paused.length > 0 && (
        <Card title="Paused">
          <ul className="items">
            {paused.map((h) => (
              <li key={h.id}>
                <span className="grow">{h.emoji} {h.name}</span>
                <button className="pill" onClick={() => actions.editHabit(h.id, { archived: false })}>Resume</button>
                <button className="icon-btn danger" onClick={() => window.confirm(`Delete "${h.name}" and its history?`) && actions.deleteHabit(h.id)} aria-label="Delete">🗑</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
