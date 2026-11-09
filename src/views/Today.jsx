import { useState } from 'react'
import { Card, Ring, XpChip } from '../components/ui.jsx'
import { SessionRow } from '../components/workout.jsx'
import { DEFAULT_DASHBOARD } from '../lib/store.js'
import { fmtMinutes, prettyDate, todayKey, weekStart } from '../lib/dates.js'
import { habitsForDay, isDone, streakInfo, weekCount } from '../lib/habits.js'
import { microGoals } from '../lib/goals.js'
import { hasJournal, questsFor, XP } from '../lib/game.js'
import { hasPlan, isSessionDone, sessionsForDay } from '../lib/training.js'
import { insights } from '../lib/analytics.js'
import { garminRange } from '../lib/garmin.js'
import { fmtTime, useTimer } from '../lib/timer.jsx'

function greeting() {
  const h = new Date().getHours()
  return h < 6 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// Everything to do today, in one place
function agendaFor(data, low) {
  const today = todayKey()
  const habits = habitsForDay(data, today, low)
  const sessions = low ? [] : sessionsForDay(data, today)
  const micro = microGoals(data, low ? 1 : 3)
  const microDoneToday = data.goals.reduce((n, g) => n + g.steps.filter((s) => s.done && s.doneAt === today).length, 0)
  const tasks = low ? [] : data.tasks.filter((t) => !t.done)
  const tasksDoneToday = data.tasks.filter((t) => t.done && t.doneAt === today).length
  const done =
    habits.filter((h) => isDone(data, h, today)).length + sessions.filter((s) => isSessionDone(data, today, s.id)).length + microDoneToday + tasksDoneToday
  const total = habits.length + sessions.length + micro.length + microDoneToday + Math.min(tasks.length, 5) + tasksDoneToday
  return { today, habits, sessions, micro, tasks, done, total }
}

// ── Summary ─────────────────────────────────────────────────────────────────

function Summary({ data, game, agenda, ui }) {
  const q = questsFor(data)
  const g = data.garmin?.enabled ? data.garmin : null
  const t = g?.days?.[todayKey()] || {}
  const week = g ? garminRange(g, weekStart(todayKey()), todayKey()) : null
  const pct = agenda.total ? agenda.done / agenda.total : 0
  return (
    <section className="summary-card">
      <Ring progress={pct} size={84} stroke={7}>
        <div className="sum-ring"><b>{agenda.done}</b><span>/{agenda.total}</span></div>
      </Ring>
      <div className="grow">
        <button className="sum-level" onClick={() => ui.goTo('progress', 'achievements')}>
          <span>Level {game.level} · {game.rank.name}</span>
          <span className="sum-xp"><i style={{ width: `${game.progress * 100}%` }} /></span>
        </button>
        <p className="muted small">
          <b className="gold-text">+{game.xpToday} XP</b> today
          {agenda.total > 0 && agenda.done === agenda.total ? ' · everything done 🎉' : agenda.total ? ` · ${agenda.total - agenda.done} to go` : ''}
        </p>
        <div className="quest-dots" title="Daily quests">
          {q.list.map((x) => <span key={x.id} className={x.done ? 'on' : ''} title={x.text} />)}
          <span className="muted small">{q.allDone ? `Quests done +${XP.allQuests}` : `Quests ${q.list.filter((x) => x.done).length}/${q.list.length}`}</span>
        </div>
      </div>
      {g && (
        <div className="sum-chips" onClick={() => ui.goTo('progress', 'body')}>
          <span>👣 {t.steps !== undefined ? t.steps.toLocaleString() : '–'}</span>
          <span>🌙 {t.sleepMin ? `${Math.floor(t.sleepMin / 60)}h${String(t.sleepMin % 60).padStart(2, '0')}` : '–'}</span>
          <span>⚡ {fmtMinutes(week?.trainingMin || 0)} this week</span>
        </div>
      )}
    </section>
  )
}

// ── Agenda ──────────────────────────────────────────────────────────────────

function Group({ title, right, children }) {
  return (
    <div className="agenda-group">
      <div className="agenda-label"><span>{title}</span>{right}</div>
      {children}
    </div>
  )
}

function Agenda({ data, actions, ui, agenda, low }) {
  const [text, setText] = useState('')
  const [showAllTasks, setShowAllTasks] = useState(false)
  const { today, habits, sessions, micro, tasks } = agenda
  const nothing = !habits.length && !sessions.length && !micro.length && !tasks.length

  return (
    <Card title={low ? 'Just the essentials' : 'Today’s plan'} icon="◉" right={<span className="muted small">{agenda.done}/{agenda.total} done</span>} className="agenda">
      {nothing && (
        <div className="empty-plan">
          <p className="muted">Nothing planned yet. Start with one of these:</p>
          <div className="row tight wrap">
            <button className="pill" onClick={() => ui.goTo('habits')}>↻ Add a habit</button>
            {!hasPlan(data) && <button className="pill" onClick={() => ui.goTo('train')}>⚡ Workout scheme</button>}
            <button className="pill" onClick={() => ui.goTo('goals')}>◎ Set a goal</button>
          </div>
        </div>
      )}

      {sessions.length > 0 && (
        <Group title="Workout">
          <ul className="sessions">
            {sessions.map((s) => <SessionRow key={s.id} data={data} actions={actions} ui={ui} date={today} session={s} />)}
          </ul>
        </Group>
      )}

      {habits.length > 0 && (
        <Group title={low ? 'Core habits' : 'Habits'} right={<span className="muted small">{habits.filter((h) => isDone(data, h, today)).length}/{habits.length}</span>}>
          <ul className="rows">
            {habits.map((h) => {
              const d = isDone(data, h, today)
              const s = streakInfo(data, h)
              return (
                <li key={h.id} className={d ? 'done' : ''} onClick={() => actions.toggleCheck(today, h.id)}>
                  <span className="row-emoji">{h.emoji}</span>
                  <div className="grow">
                    <p className="row-title">{h.name}</p>
                    <p className="muted small">
                      {h.schedule.type === 'weekly' && `${weekCount(data, h, today)}/${h.schedule.times} this week · `}
                      {s.count > 0 ? `🔥 ${s.count}` : 'start a streak'}
                      {h.garmin && data.garmin?.enabled && ' · ⌚ auto'}
                    </p>
                  </div>
                  <span className={`check ${d ? 'on' : ''}`}>{d ? '✓' : ''}</span>
                </li>
              )
            })}
          </ul>
        </Group>
      )}

      {micro.length > 0 && (
        <Group title="Micro-goals">
          <ul className="rows">
            {micro.map(({ goal, step, overdue }) => {
              const target = { type: 'step', id: step.id, goalId: goal.id, label: step.text }
              return (
                <li key={step.id}>
                  <span className="row-emoji">◎</span>
                  <div className="grow">
                    <p className="row-title">{step.text}</p>
                    <p className="muted small">{goal.title}{overdue && <span className="tag warn">overdue</span>}</p>
                  </div>
                  <button className="mini" onClick={() => ui.kick(target)} title="Just start: 1-minute rule">1m</button>
                  <button className="mini" onClick={() => ui.focus(target)} title="Focus on this">▶</button>
                  <button className="check" onClick={() => actions.toggleStep(goal.id, step.id)} aria-label="Done" />
                </li>
              )
            })}
          </ul>
        </Group>
      )}

      {!low && (
        <Group title="Tasks" right={tasks.length > 5 && <button className="link small" onClick={() => setShowAllTasks(!showAllTasks)}>{showAllTasks ? 'Less' : `All ${tasks.length}`}</button>}>
          <ul className="rows">
            {(showAllTasks ? tasks : tasks.slice(0, 5)).map((t) => {
              const target = { type: 'task', id: t.id, label: t.text }
              return (
                <li key={t.id}>
                  <span className="row-emoji">☐</span>
                  <p className="row-title grow">{t.text}</p>
                  <button className="mini" onClick={() => ui.kick(target)} title="Just start: 1-minute rule">1m</button>
                  <button className="mini" onClick={() => ui.focus(target)} title="Focus on this">▶</button>
                  <button className="check" onClick={() => actions.toggleTask(t.id)} aria-label="Done" />
                </li>
              )
            })}
          </ul>
          <form className="add-row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { actions.addTask(text.trim()); setText('') } }}>
            <input placeholder="+ Add a task" value={text} onChange={(e) => setText(e.target.value)} />
          </form>
        </Group>
      )}
    </Card>
  )
}

// ── Focus (compact) ─────────────────────────────────────────────────────────

function FocusBar({ data, actions }) {
  const t = useTimer()
  const minutes = data.focus.filter((f) => f.date === todayKey()).reduce((n, f) => n + f.minutes, 0)
  const running = t.status !== 'idle'
  const finishedOpen =
    t.finished &&
    (t.finished.type === 'step'
      ? data.goals.some((g) => g.steps.some((s) => s.id === t.finished.id && !s.done))
      : t.finished.type === 'task'
        ? data.tasks.some((x) => x.id === t.finished.id && !x.done)
        : false)
  return (
    <section className={`card focus-bar ${running ? 'running' : ''}`}>
      <div className="row">
        {running ? (
          <Ring progress={t.progress} size={52} stroke={5} color={t.phase === 'break' ? 'var(--violet)' : 'var(--accent)'}>
            <span className="tiny">{t.phase === 'break' ? '☕' : '⏱'}</span>
          </Ring>
        ) : (
          <span className="focus-icon">⏱</span>
        )}
        <div className="grow">
          {running ? (
            <>
              <p className="timer-inline">{fmtTime(t.remaining)} <span className="muted small">{t.phase === 'break' ? 'break' : t.status === 'paused' ? 'paused' : 'focus'}</span></p>
              <p className="muted small ellipsis">{t.target?.label || 'Free focus'}</p>
            </>
          ) : (
            <>
              <p className="row-title">Focus session</p>
              <p className="muted small">{data.settings.focusMinutes} min{minutes ? ` · ${minutes} min today` : ''} · tap ▶ on a task to focus on it</p>
            </>
          )}
        </div>
        {t.status === 'idle' && <button className="primary small" onClick={() => t.start(null)}>Start</button>}
        {t.status === 'running' && t.phase === 'work' && <button className="small" onClick={t.pause}>Pause</button>}
        {t.status === 'paused' && <button className="primary small" onClick={t.resume}>Resume</button>}
        {running && t.phase === 'work' && <button className="ghost small" onClick={t.stopAndLog}>Stop</button>}
        {t.phase === 'break' && t.status !== 'idle' && <button className="ghost small" onClick={t.skipBreak}>Skip</button>}
      </div>
      {finishedOpen && (
        <div className="notice">
          <span className="grow">Session done! Mark “{t.finished.label}” as complete?</span>
          <button className="primary small" onClick={() => { actions.completeTarget(t.finished); t.clearFinished() }}>Yes</button>
          <button className="ghost small" onClick={t.clearFinished}>Not yet</button>
        </div>
      )}
    </section>
  )
}

// ── Reflect + inbox shortcut ───────────────────────────────────────────────

function Reflect({ data, ui }) {
  const done = hasJournal(data.entries[todayKey()])
  const inbox = data.dumps.filter((d) => !d.processed).length
  return (
    <section className="card shortcuts">
      <button className="shortcut" onClick={() => ui.goTo('mind', 'journal')}>
        <span className="row-emoji">✎</span>
        <span className="grow">
          <span className="row-title">{done ? 'Reflected today' : 'Reflect on your day'}</span>
          <span className="muted small block">{done ? 'Tap to read or add more' : 'Win, energy drains, gratitude · 2 min'}</span>
        </span>
        {done ? <span className="check on">✓</span> : <XpChip n={XP.journal} />}
      </button>
      {inbox > 0 && (
        <button className="shortcut" onClick={() => ui.goTo('mind', 'inbox')}>
          <span className="row-emoji">🌀</span>
          <span className="grow">
            <span className="row-title">{inbox} thought{inbox === 1 ? '' : 's'} in your inbox</span>
            <span className="muted small block">Turn them into tasks or let them go</span>
          </span>
          <span className="muted">›</span>
        </button>
      )}
    </section>
  )
}

function InsightLine({ data, ui }) {
  const ins = insights(data)
  const top = ins.ready ? ins.list[0] : null
  return (
    <button className="card insight-line" onClick={() => ui.goTo('progress', 'insights')}>
      <span className="insight-icon">{top ? top.icon : '✦'}</span>
      <span className="grow">
        <span className="row-title">{top ? top.title : ins.ready ? 'No clear patterns yet' : 'Insights are on the way'}</span>
        <span className="muted small block">{top ? top.text : ins.ready ? 'Keep tracking, patterns show up over time.' : `${ins.have}/7 days tracked. Tap to see examples.`}</span>
      </span>
      <span className="muted">›</span>
    </button>
  )
}

// ── Sections & customize ───────────────────────────────────────────────────

const SECTIONS = {
  summary: { name: 'Summary (progress, level, quests, Garmin)', low: true },
  agenda: { name: 'Today’s plan (workout, habits, micro-goals, tasks)', low: true },
  focus: { name: 'Focus timer' },
  reflect: { name: 'Reflect & inbox shortcut', low: true },
  insight: { name: 'Insight of the day' },
}

function Customize({ layout, setLayout, onClose }) {
  const move = (i, dir) => {
    const next = [...layout]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setLayout(next)
  }
  return (
    <section className="card customize">
      <div className="card-head">
        <h2>Customize Today</h2>
        <button className="primary small" onClick={onClose}>Done</button>
      </div>
      <ul className="layout-list">
        {layout.map((w, i) => (
          <li key={w.id} className={w.hidden ? 'hidden' : ''}>
            <span className="grow">{SECTIONS[w.id].name}</span>
            <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === layout.length - 1} aria-label="Move down">↓</button>
            <button className={`toggle ${w.hidden ? '' : 'on'}`} onClick={() => setLayout(layout.map((x) => (x.id === w.id ? { ...x, hidden: !x.hidden } : x)))} aria-label={w.hidden ? 'Show' : 'Hide'}>
              <i />
            </button>
          </li>
        ))}
      </ul>
      <button className="pill left" onClick={() => setLayout(DEFAULT_DASHBOARD)}>Reset to default</button>
    </section>
  )
}

export default function Today(props) {
  const { data, actions, sub } = props
  const [editing, setEditing] = useState(sub === 'customize')
  const today = todayKey()
  const low = !!data.lowEnergy[today]
  const agenda = agendaFor(data, low)
  const layout = data.settings.dashboard
  const visible = layout.filter((w) => !w.hidden && (!low || SECTIONS[w.id].low))

  const render = (id) => {
    if (id === 'summary') return <Summary key={id} {...props} agenda={agenda} />
    if (id === 'agenda') return <Agenda key={id} {...props} agenda={agenda} low={low} />
    if (id === 'focus') return <FocusBar key={id} {...props} />
    if (id === 'reflect') return <Reflect key={id} {...props} />
    if (id === 'insight') return <InsightLine key={id} {...props} />
    return null
  }

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <p className="eyebrow">{prettyDate(today)}</p>
          <h1>{low ? 'Take it easy' : greeting()}</h1>
        </div>
        <button className={`low-btn ${low ? 'on' : ''}`} onClick={() => actions.setLowEnergy(!low)} title="Low Energy Mode: only the essentials today">
          🔋 {low ? 'Low energy on' : 'Low energy'}
        </button>
      </header>

      {low && (
        <div className="low-banner">
          <b>Low Energy Mode</b>
          <p>Only your core habits and one micro-goal. Other habits won’t break their streaks. Doing the minimum is still a win.</p>
        </div>
      )}

      {editing && <Customize layout={layout} setLayout={(d) => actions.setSettings({ dashboard: d })} onClose={() => setEditing(false)} />}
      {visible.map((w) => render(w.id))}
      {!editing && <button className="ghost small customize-btn" onClick={() => { setEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>⚙ Customize this screen</button>}
    </div>
  )
}
