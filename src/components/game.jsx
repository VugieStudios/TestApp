import { useEffect, useMemo, useState } from 'react'
import { Ring } from './ui.jsx'
import { RANKS } from '../lib/game.js'
import { chime, fmtTime } from '../lib/timer.jsx'

export function PlayerCard({ game, compact }) {
  const next = RANKS.find((r) => r.level > game.level)
  return (
    <section className={`player ${compact ? 'compact' : ''}`}>
      <Ring progress={game.progress} size={compact ? 64 : 84} stroke={compact ? 5 : 6} color="var(--gold)" track="rgba(255,255,255,.08)">
        <div className="lvl">
          <small>LVL</small>
          <b>{game.level}</b>
        </div>
      </Ring>
      <div className="grow">
        <div className="player-top">
          <div>
            <p className="rank">{game.rank.name}</p>
            <p className="muted small">
              {game.into.toLocaleString()} / {game.needed.toLocaleString()} XP
              {next && !compact && ` · ${next.name} at level ${next.level}`}
            </p>
          </div>
        </div>
        {!compact && (
          <div className="player-stats">
            <span><b>+{game.xpToday}</b> today</span>
            <span><b>+{game.xpWeek}</b> this week</span>
            <span><b>{game.bestStreak}</b> best streak</span>
          </div>
        )}
      </div>
    </section>
  )
}

export function XpFloats({ floats }) {
  return (
    <div className="xp-floats" aria-live="polite">
      {floats.map((f) => (
        <div key={f.id} className="xp-float">+{f.amount} XP</div>
      ))}
    </div>
  )
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 1.5,
        color: ['#3ddc97', '#f5c451', '#8b7cff', '#e2e8f0'][i % 4],
      })),
    []
  )
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }} />
      ))}
    </div>
  )
}

export function LevelUp({ item, onClose }) {
  if (!item) return null
  return (
    <div className="overlay" onClick={onClose}>
      <Confetti />
      <div className="celebrate" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow gold">LEVEL UP</p>
        <Ring progress={1} size={120} stroke={7} color="var(--gold)">
          <div className="lvl big"><small>LVL</small><b>{item.level}</b></div>
        </Ring>
        <h1>{item.rankChanged ? item.rank.name : `Level ${item.level}`}</h1>
        <p className="muted">{item.rankChanged ? `New rank unlocked at level ${item.level}.` : 'Consistency compounds. Keep going.'}</p>
        <button className="primary big" onClick={onClose}>Continue</button>
      </div>
    </div>
  )
}

export function BadgeToast({ badge, onDone }) {
  useEffect(() => {
    if (!badge) return
    const id = setTimeout(onDone, 3500)
    return () => clearTimeout(id)
  }, [badge, onDone])
  if (!badge) return null
  return (
    <div className="toast" onClick={onDone} role="status">
      <span className="toast-icon">{badge.icon}</span>
      <div>
        <p className="eyebrow gold">Badge unlocked</p>
        <b>{badge.name}</b>
        <p className="muted small">{badge.desc}</p>
      </div>
    </div>
  )
}

// The 1-minute rule: just start for 60 seconds.
export function Kickstart({ target, onClose, onFinish, onContinue }) {
  const [left, setLeft] = useState(60)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!target) return
    setLeft(60)
    setDone(false)
    const start = Date.now()
    const id = setInterval(() => {
      const l = Math.max(0, 60 - Math.floor((Date.now() - start) / 1000))
      setLeft(l)
      if (l === 0) {
        clearInterval(id)
        setDone(true)
        chime(2)
        onFinish(target)
      }
    }, 250)
    return () => clearInterval(id)
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return null
  return (
    <div className="overlay">
      <div className="celebrate kick">
        <p className="eyebrow">1-MINUTE RULE</p>
        <h2 className="kick-title">{target.label}</h2>
        <Ring progress={(60 - left) / 60} size={170} stroke={9}>
          <div className="timer-num">{done ? '✓' : fmtTime(left * 1000)}</div>
        </Ring>
        {!done ? (
          <>
            <p className="muted">Just start. Nothing else. You're allowed to stop after 60 seconds.</p>
            <button className="ghost" onClick={onClose}>Cancel</button>
          </>
        ) : (
          <>
            <p>You started. That was the hardest part. 💪</p>
            <div className="row tight wrap center">
              <button className="primary" onClick={() => onContinue(target)}>Keep going: focus session</button>
              <button className="ghost" onClick={onClose}>Done for now</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
