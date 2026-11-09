import { useState } from 'react'
import { Card, Seg } from '../components/ui.jsx'
import { DumpWidget, JournalWidget, CheckinWidget, TasksWidget, JOURNAL_PROMPTS } from '../widgets/index.jsx'
import { prettyDate } from '../lib/dates.js'

function Inbox({ data, actions }) {
  const [showDone, setShowDone] = useState(false)
  const list = data.dumps.filter((d) => showDone || !d.processed)
  return (
    <Card title="Dump inbox" icon="🌀" right={<button className="link small" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide archived' : 'Show archived'}</button>}>
      {list.length === 0 && <p className="muted">Inbox zero. Your head is clear. ✨</p>}
      <ul className="items">
        {list.map((d) => (
          <li key={d.id} className={d.processed ? 'faded' : ''}>
            <div className="grow">
              <p>{d.text}</p>
              <p className="muted small">{new Date(d.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            {!d.processed && <button className="pill" onClick={() => actions.dumpToTask(d.id)}>→ Task</button>}
            {!d.processed && <button className="icon-btn" onClick={() => actions.editDump(d.id, { processed: true })} title="Archive">✓</button>}
            <button className="icon-btn" onClick={() => actions.deleteDump(d.id)} title="Delete">✕</button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function AllTasks({ data, actions }) {
  const done = data.tasks.filter((t) => t.done)
  return (
    <Card title="Completed tasks" icon="✓">
      {done.length === 0 && <p className="muted small">Nothing yet.</p>}
      <ul className="items">
        {done.slice(0, 20).map((t) => (
          <li key={t.id} className="faded">
            <input type="checkbox" checked onChange={() => actions.toggleTask(t.id)} />
            <p className="grow strike">{t.text}</p>
            <button className="icon-btn" onClick={() => actions.deleteTask(t.id)} aria-label="Delete">✕</button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function History({ data }) {
  const [q, setQ] = useState('')
  const fields = [...JOURNAL_PROMPTS, { key: 'deep', label: 'Question' }, { key: 'improve', label: 'Do better at' }, { key: 'notes', label: 'Notes' }]
  const days = Object.keys(data.entries)
    .sort()
    .reverse()
    .filter((d) => {
      const e = data.entries[d]
      const any = fields.some((f) => e[f.key]?.trim())
      return any && (!q || fields.some((f) => e[f.key]?.toLowerCase().includes(q.toLowerCase())))
    })
  return (
    <div className="stack">
      <input placeholder="Search your journal…" value={q} onChange={(e) => setQ(e.target.value)} />
      {days.length === 0 && <p className="muted center">{q ? 'No matches.' : 'Your journal entries will appear here.'}</p>}
      {days.map((d) => {
        const e = data.entries[d]
        return (
          <article key={d} className="card">
            <div className="card-head">
              <h2>{prettyDate(d, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
              <span className="muted small">{e.mood ? `mood ${e.mood}/5` : ''} {e.energy ? `· energy ${e.energy}/5` : ''}</span>
            </div>
            {fields.filter((f) => e[f.key]?.trim()).map((f) => (
              <p key={f.key} className="entry"><span className="label">{f.label}</span>{e[f.key]}</p>
            ))}
          </article>
        )
      })}
    </div>
  )
}

export default function Mind(props) {
  const [tab, setTab] = useState('now')
  return (
    <div className="stack">
      <header className="page-head"><h1>Mind</h1></header>
      <Seg value={tab} onChange={setTab} options={[['now', 'Today'], ['inbox', 'Dump & tasks'], ['history', 'Journal history']]} />
      {tab === 'now' && (
        <>
          <CheckinWidget {...props} />
          <JournalWidget {...props} />
          <DumpWidget {...props} />
        </>
      )}
      {tab === 'inbox' && (
        <>
          <Inbox {...props} />
          <TasksWidget {...props} />
          <AllTasks {...props} />
        </>
      )}
      {tab === 'history' && <History {...props} />}
    </div>
  )
}
