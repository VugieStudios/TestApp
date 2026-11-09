import { useRef, useState } from 'react'
import { Card, Seg } from '../components/ui.jsx'
import { todayKey } from '../lib/dates.js'
import { supabase } from '../lib/supabase.js'
import { useTimer } from '../lib/timer.jsx'
import { GarminCard } from '../components/garmin.jsx'

export default function Settings({ data, actions, ui }) {
  const fileRef = useRef()
  const [resetting, setResetting] = useState(false)
  const timer = useTimer()
  const [confirmText, setConfirmText] = useState('')

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
      <header className="page-head"><h1>Settings</h1></header>
      <Card title="Today screen" icon="◉">
        <p className="muted small">Choose which sections you see on Today and in what order.</p>
        <button className="pill left" onClick={() => ui.goTo('today', 'customize')}>Customize Today →</button>
      </Card>

      <Card title="Focus & streaks" icon="⚙">
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
