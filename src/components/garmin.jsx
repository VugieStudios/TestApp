import { useState } from 'react'
import { Card } from './ui.jsx'
import { addDays, fmtMinutes, lastDays, shortDate, todayKey, weekStart, WEEKDAYS, weekday } from '../lib/dates.js'
import { garminRange, KIND_ICON } from '../lib/garmin.js'

const fmtSleep = (m) => (m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : '–')
const ago = (iso) => {
  if (!iso) return 'never'
  const min = Math.round((Date.now() - new Date(iso)) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  if (min < 60 * 24) return `${Math.round(min / 60)} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Profile: connect / sync / status ──
export function GarminCard({ data, actions, ui }) {
  const g = data.garmin
  const [showDebug, setShowDebug] = useState(false)
  const [copied, setCopied] = useState(false)
  const { syncing, sync } = ui.garmin

  if (!g?.enabled) {
    return (
      <Card title="Garmin Connect" icon="⌚">
        <p className="muted small">
          Pull your workouts, steps and sleep from Garmin. Habits can tick themselves off (for example “Move 30 min” when your watch logs a ride), and your stats, reviews and insights include your training and sleep.
        </p>
        <p className="muted small">First set up the Garmin bridge in Supabase (Claude gave you the steps), then connect here.</p>
        <button className="primary" disabled={syncing} onClick={async () => { actions.setGarminEnabled(true); await sync(60) }}>
          {syncing ? 'Connecting…' : 'Connect Garmin'}
        </button>
      </Card>
    )
  }

  const n = g.activities?.length || 0
  const daysWith = (k) => Object.values(g.days || {}).filter((d) => d[k] !== undefined).length
  const debugText = JSON.stringify({ lastSync: g.lastSync, error: g.error, debug: g.debug }, null, 2)

  return (
    <Card title="Garmin Connect" icon="⌚" right={<span className={`muted small ${g.error ? 'warn-text' : ''}`}>{g.error ? 'Problem' : `Synced ${ago(g.lastSync)}`}</span>}>
      {g.error && <div className="error-box">{g.error}</div>}
      {g.lastSync && (
        <div className="stat-row">
          <span>Workouts <b>{n}</b></span>
          <span>Days with steps <b>{daysWith('steps')}</b></span>
          <span>Nights of sleep <b>{daysWith('sleepMin')}</b></span>
        </div>
      )}
      {g.lastSync && n + daysWith('steps') + daysWith('sleepMin') === 0 && !g.error && (
        <p className="muted small">Connected, but no data could be read yet. Tap “Debug info”, copy it and send it to Claude.</p>
      )}
      <div className="row tight wrap">
        <button className="primary" disabled={syncing} onClick={() => sync()}>{syncing ? 'Syncing…' : 'Sync now'}</button>
        <button className="ghost" disabled={syncing} onClick={() => sync(60)}>Re-sync 60 days</button>
        <button className="ghost small" onClick={() => setShowDebug(!showDebug)}>Debug info</button>
      </div>
      {showDebug && (
        <div className="stack-sm">
          <pre className="debug">{debugText}</pre>
          <div className="row tight">
            <button className="small" onClick={() => { navigator.clipboard?.writeText(debugText); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? 'Copied ✓' : 'Copy'}</button>
            <button className="ghost small danger" onClick={() => window.confirm('Disconnect Garmin? Synced data stays until you sync again.') && actions.setGarminEnabled(false)}>Disconnect</button>
          </div>
        </div>
      )}
      <p className="muted small">Syncs automatically when you open the app and every 15 minutes while it's open. Link habits to Garmin in the Habits tab.</p>
    </Card>
  )
}

// ── Today widget ──
export function GarminWidget({ data, ui }) {
  const g = data.garmin
  if (!g?.enabled) return null
  const today = todayKey()
  const t = g.days?.[today] || {}
  const recent = (g.activities || []).filter((a) => a.date >= addDays(today, -6)).slice(0, 3)
  const week = garminRange(g, weekStart(today), today)
  return (
    <Card title="Garmin" icon="⌚" right={<span className="row tight"><button className="pill" disabled={ui.garmin.syncing} onClick={() => ui.garmin.sync()}>{ui.garmin.syncing ? '…' : '↻'}</button><button className="link small" onClick={() => ui.goTo('stats', 'body')}>Body →</button></span>}>
      <div className="g-tiles">
        <div><b>{t.steps !== undefined ? t.steps.toLocaleString() : '–'}</b><span>steps today</span></div>
        <div><b>{fmtSleep(t.sleepMin)}</b><span>sleep{t.sleepScore ? ` · ${t.sleepScore}` : ''}</span></div>
        <div><b>{fmtMinutes(week.trainingMin)}</b><span>trained this week</span></div>
      </div>
      {recent.length > 0 && (
        <ul className="items">
          {recent.map((a) => (
            <li key={a.id}>
              <span className="emoji">{KIND_ICON[a.kind]}</span>
              <div className="grow">
                <p>{a.name}</p>
                <p className="muted small">{shortDate(a.date)} · {fmtMinutes(a.minutes)}{a.km ? ` · ${a.km} km` : ''}{a.avgHr ? ` · ${Math.round(a.avgHr)} bpm` : ''}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {g.error && <p className="warn-text small">Garmin sync problem. See Profile.</p>}
    </Card>
  )
}

// ── Stats → Body ──
// Bar chart: hover (desktop) or tap (phone) a bar to see its exact value
function Bars({ days, values, max, fmt, color, goal }) {
  const [sel, setSel] = useState(null)
  const W = 320
  const H = 110
  const top = 18
  const bw = (W - 10) / days.length
  const shown = sel ?? days.length - 1
  const v0 = values[shown]
  return (
    <div className="bars-wrap">
      <p className="bars-caption">
        <b>{v0 ? fmt(v0) : 'No data'}</b>
        <span className="muted"> · {shortDate(days[shown])}{days[shown] === todayKey() ? ' (today)' : ''}</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H + top + 16}`} className="bars" onMouseLeave={() => setSel(null)}>
        <g transform={`translate(0 ${top})`}>
          {goal && <line x1="0" x2={W} y1={H - (goal / max) * H} y2={H - (goal / max) * H} className="goal-line" />}
          {days.map((d, i) => {
            const v = values[i] || 0
            const h = Math.max(v ? 2 : 0, (Math.min(v, max) / max) * H)
            const active = i === shown
            return (
              <g key={d} onMouseEnter={() => setSel(i)} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
                <rect x={5 + i * bw} y={-top} width={bw} height={H + top + 16} fill="transparent" />
                <rect x={5 + i * bw + 2} y={H - h} width={bw - 4} height={h} rx="3" fill={color} opacity={active ? 1 : 0.55} />
                {active && v > 0 && (
                  <text x={5 + i * bw + bw / 2} y={H - h - 5} textAnchor="middle" className="bar-label">
                    {fmt(v).split(' ')[0]}
                  </text>
                )}
                <text x={5 + i * bw + bw / 2} y={H + 12} textAnchor="middle" className={`axis ${active ? 'on' : ''}`}>{WEEKDAYS[weekday(d)][0]}</text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

function SyncLine({ g, ui }) {
  const { syncing, sync } = ui.garmin
  return (
    <div className="sync-line">
      <span className="muted small">{syncing ? 'Syncing with Garmin…' : `Synced ${ago(g.lastSync)}`}</span>
      <button className="pill" disabled={syncing} onClick={() => sync()}>↻ Sync</button>
    </div>
  )
}

export function BodyStats({ data, ui }) {
  const g = data.garmin
  if (!g?.enabled) {
    return (
      <Card title="Body" icon="⌚">
        <p className="muted">Connect Garmin in your Profile to see your training, steps and sleep here.</p>
      </Card>
    )
  }
  const today = todayKey()
  const days = lastDays(14)
  const thisWeek = garminRange(g, weekStart(today), today)
  const lastWeek = garminRange(g, addDays(weekStart(today), -7), addDays(weekStart(today), -1))
  const cmp = (a, b, f) => (a === null || b === null ? '' : a >= b ? `▲ ${f(a - b)}` : `▼ ${f(b - a)}`)

  return (
    <>
      <SyncLine g={g} ui={ui} />
      {g.error && <div className="error-box">{g.error}</div>}
      <Card title="This week vs last week" icon="⌚">
        <div className="review-stats">
          <div><b>{fmtMinutes(thisWeek.trainingMin)}</b><span>training <em className="muted">{cmp(thisWeek.trainingMin, lastWeek.trainingMin, fmtMinutes)}</em></span></div>
          <div><b>{thisWeek.km} km</b><span>distance <em className="muted">{cmp(thisWeek.km, lastWeek.km, (v) => `${v} km`)}</em></span></div>
          <div><b>{thisWeek.activities}</b><span>workouts</span></div>
          <div><b>{thisWeek.avgSteps ? Math.round(thisWeek.avgSteps).toLocaleString() : '–'}</b><span>avg steps</span></div>
          <div><b>{fmtSleep(thisWeek.avgSleepMin && Math.round(thisWeek.avgSleepMin))}</b><span>avg sleep</span></div>
          <div><b>{thisWeek.avgRestingHr ? Math.round(thisWeek.avgRestingHr) : '–'}</b><span>resting HR</span></div>
        </div>
      </Card>
      <Card title="Steps, last 14 days" icon="👣">
        <Bars days={days} values={days.map((d) => g.days[d]?.steps)} max={Math.max(12000, ...days.map((d) => g.days[d]?.steps || 0))} fmt={(v) => `${v.toLocaleString()} steps`} color="var(--accent)" goal={10000} />
      </Card>
      <Card title="Sleep, last 14 nights" icon="🌙">
        <Bars days={days} values={days.map((d) => g.days[d]?.sleepMin)} max={600} fmt={fmtSleep} color="var(--violet)" goal={480} />
        <p className="muted small">Line = 8 hours. Each bar is the night before that day.</p>
      </Card>
      <Card title="Recent workouts" icon="🏁">
        {g.activities.length === 0 && <p className="muted">No workouts synced yet.</p>}
        <ul className="items">
          {g.activities.slice(0, 12).map((a) => (
            <li key={a.id}>
              <span className="emoji">{KIND_ICON[a.kind]}</span>
              <div className="grow">
                <p>{a.name}</p>
                <p className="muted small">{shortDate(a.date)} · {fmtMinutes(a.minutes)}{a.km ? ` · ${a.km} km` : ''}{a.avgHr ? ` · ${Math.round(a.avgHr)} bpm` : ''}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
