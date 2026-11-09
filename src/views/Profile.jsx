import { useRef, useState } from 'react'
import { Card, Seg } from '../components/ui.jsx'
import { PlayerCard } from '../components/game.jsx'
import { RANKS, XP } from '../lib/game.js'
import { fmtMinutes, todayKey } from '../lib/dates.js'
import { supabase } from '../lib/supabase.js'
import { useTimer } from '../lib/timer.jsx'
import { GarminCard } from '../components/garmin.jsx'

export default function Profile({ data, actions, game, ui }) {
  const fileRef = useRef()
  const [resetting, setResetting] = useState(false)
  const timer = useTimer()
  const [confirmText, setConfirmText] = useState('')
  const unlocked = game.badges.filter((b) => b.unlocked).length

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
        if (window.confirm('Replace everything with this backup?')) actions.replaceAll(parsed)
      } catch {
        window.alert("That file isn't a valid backup.")
      }
    })
    e.target.value = ''
  }

  return (
    <div className="stack">
      <header className="page-head"><h1>Profile</h1></header>
      <PlayerCard game={game} />

      <div className="stat-grid">
        <div className="stat"><b>{game.totalChecks}</b><span>habits done</span></div>
        <div className="stat"><b>{fmtMinutes(game.focusMinutes)}</b><span>focused</span></div>
        <div className="stat"><b>{game.stepsDone}</b><span>micro-goals</span></div>
        <div className="stat"><b>{game.goalsDone}</b><span>goals achieved</span></div>
      </div>

      <Card title="Ranks" icon="♛">
        <div className="ranks">
          {RANKS.map((r) => (
            <div key={r.name} className={`rank-step ${game.level >= r.level ? 'reached' : ''} ${game.rank.name === r.name ? 'current' : ''}`}>
              <b>{r.level}</b>
              <span>{r.name}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Badges" icon="◆" right={<span className="muted small">{unlocked}/{game.badges.length}</span>}>
        <div className="badge-grid">
          {game.badges.map((b) => (
            <div key={b.id} className={`badge ${b.unlocked ? 'on' : ''}`} title={b.desc}>
              <span className="badge-icon">{b.icon}</span>
              <b>{b.name}</b>
              <span>{b.desc}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="How you earn XP" icon="✦">
        <ul className="xp-rules">
          <li><span>Complete a habit</span><b>+{XP.habit}</b></li>
          <li><span>Complete all habits of the day</span><b>+{XP.completeDay}</b></li>
          <li><span>Finish a micro-goal</span><b>+{XP.step}</b></li>
          <li><span>Achieve a goal</span><b>+{XP.goal}</b></li>
          <li><span>Focus</span><b>+{XP.focusMinute}/min · +{XP.focusSession} per session</b></li>
          <li><span>1-minute rule start</span><b>+{XP.kick}</b></li>
          <li><span>Finish a task</span><b>+{XP.task}</b></li>
          <li><span>Journal</span><b>+{XP.journal}</b></li>
          <li><span>All daily quests</span><b>+{XP.allQuests}</b></li>
          <li><span>Weekly / monthly review</span><b>+{XP.weeklyReview} / +{XP.monthlyReview}</b></li>
          <li><span>Streak reward: 7 / 30 / 100 days</span><b>+{XP.streak7} / +{XP.streak30} / +{XP.streak100}</b></li>
        </ul>
      </Card>

      <Card title="Settings" icon="⚙">
        <div className="setting">
          <span className="grow">Focus length</span>
          <Seg small value={data.settings.focusMinutes} onChange={(v) => actions.setSettings({ focusMinutes: v })} options={[[15, '15'], [25, '25'], [45, '45'], [60, '60']]} />
        </div>
        <div className="setting">
          <span className="grow">Break length</span>
          <Seg small value={data.settings.breakMinutes} onChange={(v) => actions.setSettings({ breakMinutes: v })} options={[[5, '5'], [10, '10'], [15, '15']]} />
        </div>
        <div className="setting">
          <span className="grow">Streak freezes per week</span>
          <Seg small value={data.settings.freezesPerWeek} onChange={(v) => actions.setSettings({ freezesPerWeek: v })} options={[[0, '0'], [1, '1'], [2, '2']]} />
        </div>
      </Card>

      <GarminCard data={data} actions={actions} ui={ui} />

      <Card title="Data" icon="⬇">
        <p className="muted small">Your data syncs to your account automatically. A backup file is extra safety.</p>
        <div className="row tight wrap">
          <button onClick={exportData}>Download backup</button>
          <button className="ghost" onClick={() => fileRef.current.click()}>Restore backup</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
        </div>
      </Card>

      <Card title="Reset account" icon="⚠" className="danger-zone">
        {!resetting ? (
          <>
            <p className="muted small">Delete all habits, goals, journal entries, XP and badges and start from zero. Your login stays the same. Tip: download a backup first.</p>
            <button className="ghost danger" onClick={() => setResetting(true)}>Reset my account…</button>
          </>
        ) : (
          <>
            <p className="small">This can't be undone. Type <b>RESET</b> to confirm.</p>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESET" autoCapitalize="characters" />
            <div className="row tight end">
              <button className="ghost" onClick={() => { setResetting(false); setConfirmText('') }}>Cancel</button>
              <button
                className="danger-btn"
                disabled={confirmText.trim().toUpperCase() !== 'RESET'}
                onClick={() => { timer.clear(); actions.resetAll(); setResetting(false); setConfirmText(''); window.scrollTo({ top: 0 }) }}
              >
                Delete everything
              </button>
            </div>
          </>
        )}
      </Card>

      <button className="ghost danger" onClick={() => supabase.auth.signOut()}>Log out</button>
    </div>
  )
}
