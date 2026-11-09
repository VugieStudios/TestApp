import { useState } from 'react'
import { Card, Ring, XpChip } from '../components/ui.jsx'
import { PlayerCard } from '../components/game.jsx'
import { GarminWidget } from '../components/garmin.jsx'
import { todayKey } from '../lib/dates.js'
import { habitsForDay, isDone, streakInfo, weekCount } from '../lib/habits.js'
import { microGoals } from '../lib/goals.js'
import { questsFor, XP } from '../lib/game.js'
import { EXAMPLE_INSIGHTS, insights, MIN_DAYS } from '../lib/analytics.js'
import { fmtTime, useTimer } from '../lib/timer.jsx'

const stepTarget = (goal, step) => ({ type: 'step', id: step.id, goalId: goal.id, label: step.text })
const taskTarget = (t) => ({ type: 'task', id: t.id, label: t.text })

function Actions({ target, ui, onDone }) {
  return (
    <div className="item-actions">
      <button className="pill" onClick={() => ui.kick(target)} title="1-minute rule">1 min</button>
      <button className="pill" onClick={() => ui.focus(target)} title="Focus on this">▶</button>
      {onDone && <button className="check" onClick={onDone} aria-label="Done" />}
    </div>
  )
}

// ── Player ──
export function PlayerWidget({ game, low }) {
  return <PlayerCard game={game} compact={low} />
}

// ── Daily quests ──
export function QuestsWidget({ data }) {
  const q = questsFor(data)
  const done = q.list.filter((x) => x.done).length
  return (
    <Card title="Daily quests" icon="◈" className={`quests ${q.allDone ? 'complete' : ''}`} right={<span className="muted small">{done}/{q.list.length}</span>}>
      <ul className="quest-list">
        {q.list.map((x) => (
          <li key={x.id} className={x.done ? 'done' : ''}>
            <span className="tick">{x.done ? '✓' : ''}</span>
            <span className="grow">
              {x.text}
              {x.progress && !x.done && <span className="muted small"> · {x.progress}</span>}
            </span>
            <XpChip n={x.xp} />
          </li>
        ))}
      </ul>
      <div className={`bonus ${q.allDone ? 'open' : ''}`}>
        <span>{q.allDone ? 'Daily bonus earned' : 'Complete all quests for a daily bonus'}</span>
        <XpChip n={XP.allQuests} done={q.allDone} />
      </div>
    </Card>
  )
}

// ── Habits ──
export function HabitsWidget({ data, actions, ui, low }) {
  const today = todayKey()
  const habits = habitsForDay(data, today, low)
  const done = habits.filter((h) => isDone(data, h, today)).length
  return (
    <Card
      title={low ? 'Core habits' : 'Habits'}
      icon="◉"
      right={<span className="muted small">{done}/{habits.length}</span>}
    >
      <div className="progress"><div style={{ width: habits.length ? `${(done / habits.length) * 100}%` : 0 }} /></div>
      {habits.length === 0 && (
        <p className="muted">
          {low ? 'No core habits set. Mark 1–2 habits as core in the Habits tab.' : 'Nothing scheduled today.'}{' '}
          <button className="link" onClick={() => ui.goTo('habits')}>Manage habits</button>
        </p>
      )}
      <ul className="habit-rows">
        {habits.map((h) => {
          const d = isDone(data, h, today)
          const s = streakInfo(data, h)
          const weekly = h.schedule.type === 'weekly'
          return (
            <li key={h.id} className={d ? 'done' : ''}>
              <button className="habit-check" onClick={() => actions.toggleCheck(today, h.id)} aria-label={`Toggle ${h.name}`}>
                <span className="emoji">{h.emoji}</span>
              </button>
              <div className="grow" onClick={() => actions.toggleCheck(today, h.id)}>
                <p className="habit-name">{h.name}</p>
                <p className="muted small">
                  {weekly && `${weekCount(data, h, today)}/${h.schedule.times} this week · `}
                  {s.count > 0 ? `🔥 ${s.count} ${s.unit}${s.count === 1 ? '' : 's'}` : 'Start a streak'}
                  {s.frozen.size > 0 && ' · ❄ saved'}
                  {h.garmin && data.garmin?.enabled && ' · ⌚ auto'}
                </p>
              </div>
              <XpChip n={XP.habit} done={d} />
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

// ── Micro-goals ──
export function MicroWidget({ data, actions, ui, low }) {
  const list = microGoals(data, low ? 1 : 3)
  return (
    <Card title="Today’s micro-goals" icon="◎" right={<button className="link small" onClick={() => ui.goTo('goals')}>Goals →</button>}>
      {list.length === 0 && (
        <p className="muted">No micro-goals yet. <button className="link" onClick={() => ui.goTo('goals')}>Set a goal</button> and the app breaks it into small daily steps.</p>
      )}
      <ul className="items">
        {list.map(({ goal, step, overdue }) => (
          <li key={step.id}>
            <div className="grow">
              <p>{step.text}</p>
              <p className="muted small">
                {goal.title} · ~{step.minutes} min
                {overdue && <span className="tag warn">overdue</span>}
              </p>
            </div>
            <Actions target={stepTarget(goal, step)} ui={ui} onDone={() => actions.toggleStep(goal.id, step.id)} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ── Focus timer ──
export function FocusWidget({ data, actions }) {
  const t = useTimer()
  const today = todayKey()
  const minutes = data.focus.filter((f) => f.date === today).reduce((n, f) => n + f.minutes, 0)
  const options = [
    ...microGoals(data, 5).map(({ goal, step }) => stepTarget(goal, step)),
    ...data.tasks.filter((x) => !x.done).slice(0, 8).map(taskTarget),
  ]
  const running = t.status !== 'idle'
  const finishedOpen = t.finished && (t.finished.type === 'step' ? data.goals.some((g) => g.steps.some((s) => s.id === t.finished.id && !s.done)) : t.finished.type === 'task' ? data.tasks.some((x) => x.id === t.finished.id && !x.done) : false)

  return (
    <Card title="Focus" icon="⏱" right={<span className="muted small">{minutes} min today</span>} className="focus-card">
      <div className="focus-body">
        <Ring progress={t.progress} size={150} stroke={8} color={t.phase === 'break' ? 'var(--violet)' : 'var(--accent)'}>
          <div className="timer-num">{fmtTime(t.remaining)}</div>
          <div className="muted small">{t.phase === 'break' ? 'Break' : running ? 'Focus' : `${data.settings.focusMinutes} min`}</div>
        </Ring>
        <div className="focus-side">
          <label className="field">
            <span className="label">Working on</span>
            <select
              value={t.target ? `${t.target.type}:${t.target.id}` : ''}
              onChange={(e) => t.setTarget(options.find((o) => `${o.type}:${o.id}` === e.target.value) || null)}
              disabled={running && t.phase === 'work'}
            >
              <option value="">Free focus</option>
              {t.target && !options.some((o) => o.id === t.target.id) && <option value={`${t.target.type}:${t.target.id}`}>{t.target.label}</option>}
              {options.map((o) => (
                <option key={o.id} value={`${o.type}:${o.id}`}>{o.type === 'step' ? '◎ ' : '☐ '}{o.label}</option>
              ))}
            </select>
          </label>
          <div className="row tight wrap">
            {t.status === 'idle' && <button className="primary" onClick={() => t.start()}>Start</button>}
            {t.status === 'running' && t.phase === 'work' && <button onClick={t.pause}>Pause</button>}
            {t.status === 'paused' && <button className="primary" onClick={t.resume}>Resume</button>}
            {running && t.phase === 'work' && <button className="ghost" onClick={t.stopAndLog}>Stop & save</button>}
            {t.phase === 'break' && <button className="ghost" onClick={t.skipBreak}>Skip break</button>}
          </div>
        </div>
      </div>
      {finishedOpen && (
        <div className="notice">
          <span className="grow">Session done! Mark “{t.finished.label}” as complete?</span>
          <button className="primary small" onClick={() => { actions.completeTarget(t.finished); t.clearFinished() }}>Yes</button>
          <button className="ghost small" onClick={t.clearFinished}>Not yet</button>
        </div>
      )}
    </Card>
  )
}

// ── Tasks ──
export function TasksWidget({ data, actions, ui }) {
  const [text, setText] = useState('')
  const open = data.tasks.filter((x) => !x.done)
  const doneToday = data.tasks.filter((x) => x.done && x.doneAt === todayKey())
  return (
    <Card title="Tasks" icon="☐" right={<button className="link small" onClick={() => ui.goTo('mind')}>All →</button>}>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { actions.addTask(text.trim()); setText('') } }}>
        <input className="grow" placeholder="Add a task…" value={text} onChange={(e) => setText(e.target.value)} />
      </form>
      {open.length === 0 && <p className="muted small">No open tasks. Convert brain-dump thoughts into tasks.</p>}
      <ul className="items">
        {open.slice(0, 5).map((x) => (
          <li key={x.id}>
            <p className="grow">{x.text}</p>
            <Actions target={taskTarget(x)} ui={ui} onDone={() => actions.toggleTask(x.id)} />
          </li>
        ))}
      </ul>
      {(open.length > 5 || doneToday.length > 0) && (
        <p className="muted small">{open.length > 5 && `+${open.length - 5} more · `}{doneToday.length} done today</p>
      )}
    </Card>
  )
}

// ── Guided journal ──
const DEEP_PROMPTS = [
  'What would make tomorrow 1% better?',
  'What are you avoiding, and why?',
  'What did you learn about yourself today?',
  'Who made your day better, and did you tell them?',
  'What is one thing you can let go of?',
  'If today was a chapter title, what would it be?',
  'What would you do today if you weren’t afraid?',
  'Where did you spend energy that didn’t pay off?',
  'What are you proud of this week?',
  'What does “a good life” look like for you this month?',
  'What small promise to yourself did you keep?',
  'What would your future self thank you for?',
  'What drained you that you can say “no” to next time?',
  'What is one thing you want to remember about today?',
]
export const deepPrompt = (day) => DEEP_PROMPTS[Number(day.replaceAll('-', '')) % DEEP_PROMPTS.length]

export const JOURNAL_PROMPTS = [
  { key: 'win', label: 'Today’s win', ph: 'Even a small one counts' },
  { key: 'drain', label: 'Energy drains', ph: 'What took more energy than it should?' },
  { key: 'gratitude', label: 'Grateful for', ph: 'One thing or person' },
]

export function JournalWidget({ data, actions }) {
  const today = todayKey()
  const e = data.entries[today] || {}
  const has = ['win', 'drain', 'gratitude', 'deep'].some((k) => e[k]?.trim())
  return (
    <Card title="Journal" icon="✎" right={<XpChip n={XP.journal} done={has} />}>
      {JOURNAL_PROMPTS.map((p) => (
        <label key={p.key} className="field">
          <span className="label">{p.label}</span>
          <textarea rows={2} placeholder={p.ph} value={e[p.key] || ''} onChange={(ev) => actions.saveEntry(today, { [p.key]: ev.target.value })} />
        </label>
      ))}
      <label className="field">
        <span className="label">Today’s question: {deepPrompt(today)}</span>
        <textarea rows={2} value={e.deep || ''} onChange={(ev) => actions.saveEntry(today, { deep: ev.target.value })} />
      </label>
    </Card>
  )
}

// ── Brain dump ──
export function DumpWidget({ data, actions, ui }) {
  const [text, setText] = useState('')
  const inbox = data.dumps.filter((d) => !d.processed)
  const save = () => {
    if (!text.trim()) return
    actions.addDump(text.trim())
    setText('')
  }
  return (
    <Card title="Brain dump" icon="🌀" right={<span className="muted small">{inbox.length} in inbox</span>}>
      <textarea
        rows={2}
        placeholder="What's on your mind? Press Enter to dump it."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } }}
      />
      <ul className="items">
        {inbox.slice(0, 3).map((d) => (
          <li key={d.id}>
            <p className="grow">{d.text}</p>
            <button className="pill" onClick={() => actions.dumpToTask(d.id)}>→ Task</button>
            <button className="icon-btn" onClick={() => actions.editDump(d.id, { processed: true })} title="Archive">✓</button>
          </li>
        ))}
      </ul>
      {inbox.length > 3 && <button className="link small" onClick={() => ui.goTo('mind')}>See all {inbox.length} →</button>}
    </Card>
  )
}

// ── Insights ──
export function InsightsWidget({ data, ui }) {
  const ins = insights(data)
  return (
    <Card title="Insights" icon="✦" right={<button className="link small" onClick={() => ui.goTo('stats')}>More →</button>}>
      {!ins.ready ? (
        <>
          <p className="muted">Your real insights unlock after {MIN_DAYS} days of tracking ({ins.have}/{MIN_DAYS}). Here's what they look like:</p>
          <div className="progress"><div style={{ width: `${(ins.have / MIN_DAYS) * 100}%` }} /></div>
          {EXAMPLE_INSIGHTS.slice(0, 2).map((x, i) => (
            <div key={i} className="insight example">
              <span className="insight-icon">{x.icon}</span>
              <div><b>{x.title} <span className="tag">example</span></b><p className="muted small">{x.text}</p></div>
            </div>
          ))}
        </>
      ) : ins.list.length === 0 ? (
        <p className="muted">No clear patterns yet. Keep tracking.</p>
      ) : (
        ins.list.slice(0, 2).map((x, i) => (
          <div key={i} className="insight">
            <span className="insight-icon">{x.icon}</span>
            <div><b>{x.title}</b><p className="muted small">{x.text}</p></div>
          </div>
        ))
      )}
    </Card>
  )
}

export const WIDGETS = {
  player: { name: 'Level & XP', component: PlayerWidget, low: true },
  quests: { name: 'Daily quests', component: QuestsWidget, low: true },
  habits: { name: 'Habits', component: HabitsWidget, low: true },
  garmin: { name: 'Garmin (steps, sleep, workouts)', component: GarminWidget },
  micro: { name: 'Micro-goals', component: MicroWidget, low: true },
  focus: { name: 'Focus timer', component: FocusWidget },
  tasks: { name: 'Tasks', component: TasksWidget },
  journal: { name: 'Journal', component: JournalWidget, low: true },
  dump: { name: 'Brain dump', component: DumpWidget, low: true },
  insights: { name: 'Insights', component: InsightsWidget },
}

export const PRESETS = {
  Balanced: ['player', 'quests', 'habits', 'garmin', 'micro', 'focus', 'tasks', 'journal', 'dump', 'insights'],
  'Deep work': ['focus', 'micro', 'tasks', 'habits', 'quests', 'dump', 'player', 'garmin', 'journal', 'insights'],
  Wellbeing: ['journal', 'dump', 'habits', 'garmin', 'quests', 'insights', 'player', 'micro', 'focus', 'tasks'],
}

