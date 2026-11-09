import { useMemo } from 'react'

export function PlayerCard({ game, compact = false }) {
  return (
    <section className={`player ${compact ? 'compact' : ''}`}>
      <div className="avatar">
        <span>{game.rank.icon}</span>
        <div className="lvl-badge">{game.level}</div>
      </div>
      <div className="grow">
        <div className="player-top">
          <div>
            <p className="rank">{game.rank.name}</p>
            <p className="muted small">Level {game.level} · {game.xp.toLocaleString()} XP total</p>
          </div>
          <div className={`flame ${game.streak > 0 ? 'lit' : ''}`} title="Days in a row with at least one habit">
            🔥<b>{game.streak}</b>
          </div>
        </div>
        <div className="xpbar">
          <div style={{ width: `${Math.max(3, game.progress * 100)}%` }} />
          <span>{game.into} / {game.needed} XP</span>
        </div>
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
      Array.from({ length: 60 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.4,
        color: ['#5ad19a', '#f2c94c', '#9b7bff', '#ff7aa8', '#4cc3ff'][i % 5],
        rotate: Math.random() * 360,
      })),
    []
  )
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

// Shows one celebration at a time: a level-up or a new badge
export function Celebration({ item, onClose }) {
  if (!item) return null
  return (
    <div className="overlay" onClick={onClose}>
      <Confetti />
      <div className="celebrate" onClick={(e) => e.stopPropagation()}>
        {item.type === 'level' ? (
          <>
            <p className="eyebrow gold">LEVEL UP!</p>
            <div className="big-icon pop">{item.rank.icon}</div>
            <h1>Level {item.level}</h1>
            <p className="muted">{item.rankChanged ? `New rank: ${item.rank.name}!` : `Keep growing, ${item.rank.name}.`}</p>
          </>
        ) : (
          <>
            <p className="eyebrow gold">BADGE UNLOCKED</p>
            <div className="big-icon pop">{item.badge.icon}</div>
            <h1>{item.badge.name}</h1>
            <p className="muted">{item.badge.desc}</p>
          </>
        )}
        <button className="primary big" onClick={onClose}>Awesome!</button>
      </div>
    </div>
  )
}
