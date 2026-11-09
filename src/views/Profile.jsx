import { useRef } from 'react'
import { lastDays, prettyDate, todayKey } from '../dates.js'
import { streak } from '../store.js'
import { RANKS, XP } from '../game.js'
import { PlayerCard } from '../components/Game.jsx'

export default function Profile({ data, actions, game }) {
  const days30 = lastDays(30)
  const fileRef = useRef()
  const habits = data.habits.filter((h) => !h.archived)
  const rate = (habitId) => Math.round((days30.filter((d) => data.checks[d]?.[habitId]).length / 30) * 100)
  const daily = days30.map((d) => (habits.length ? habits.filter((h) => data.checks[d]?.[h.id]).length / habits.length : 0))
  const unlocked = game.badges.filter((b) => b.unlocked).length
  const nextRank = RANKS.find((r) => r.level > game.level)

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `grow-backup-${todayKey()}.json`
    a.click()
  }

  const importData = (e) => {
    const file = e.target.files[0]
    if (!file) return
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text)
        if (window.confirm('Replace everything in the app with this backup?')) actions.replaceAll(parsed)
      } catch {
        window.alert("That file isn't a valid backup.")
      }
    })
    e.target.value = ''
  }

  return (
    <div className="stack">
      <PlayerCard game={game} />

      <div className="stat-grid">
        <div className="stat"><b>{game.bestStreak}</b><span>Best streak</span></div>
        <div className="stat"><b>{game.perfectDays}</b><span>Perfect days</span></div>
        <div className="stat"><b>{game.totalChecks}</b><span>Habits done</span></div>
        <div className="stat"><b>{game.goalsDone}</b><span>Goals achieved</span></div>
      </div>

      {nextRank && (
        <section className="card next-rank">
          <span className="big">{nextRank.icon}</span>
          <div className="grow">
            <p className="muted small">Next rank</p>
            <h2>{nextRank.name}</h2>
          </div>
          <span className="muted small">at level {nextRank.level}</span>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>🏅 Badges</h2>
          <span className="muted small">{unlocked}/{game.badges.length}</span>
        </div>
        <div className="badge-grid">
          {game.badges.map((b) => (
            <div key={b.id} className={`badge ${b.unlocked ? 'on' : ''}`} title={b.desc}>
              <span className="badge-icon">{b.unlocked ? b.icon : '🔒'}</span>
              <b>{b.name}</b>
              <span>{b.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>📅 Last 30 days</h2>
          <span className="muted small">brighter = more habits done</span>
        </div>
        <div className="month">
          {days30.map((d, i) => (
            <div key={d} className="month-day" title={`${prettyDate(d, { day: 'numeric', month: 'short' })}: ${Math.round(daily[i] * 100)}%`} style={{ '--fill': daily[i] }} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>📊 Habit consistency</h2>
        {habits.length === 0 && <p className="muted">No active habits.</p>}
        {habits.map((h) => (
          <div key={h.id} className="bar-row">
            <span className="grow">{h.emoji} {h.name}</span>
            <span className="muted small">🔥{streak(data.checks, h.id)}</span>
            <div className="bar"><div style={{ width: `${rate(h.id)}%` }} /></div>
            <span className="small pct">{rate(h.id)}%</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>💡 How to earn XP</h2>
        <ul className="xp-rules">
          <li><span>Complete a habit</span><b>+{XP.habit}</b></li>
          <li><span>All habits in a day</span><b>+{XP.perfectDay}</b></li>
          <li><span>Write a reflection</span><b>+{XP.reflection}</b></li>
          <li><span>Finish a goal step</span><b>+{XP.step}</b></li>
          <li><span>Finish all daily quests</span><b>+{XP.allQuests}</b></li>
          <li><span>Achieve a goal</span><b>+{XP.goal}</b></li>
        </ul>
      </section>

      <section className="card">
        <h2>💾 Your data</h2>
        <div className="row tight wrap">
          <button onClick={exportData}>Download backup</button>
          <button className="ghost" onClick={() => fileRef.current.click()}>Restore backup</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
        </div>
      </section>
    </div>
  )
}
