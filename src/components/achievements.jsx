import { Card } from './ui.jsx'
import { PlayerCard } from './game.jsx'
import { RANKS, XP } from '../lib/game.js'
import { fmtMinutes } from '../lib/dates.js'

export function Achievements({ game }) {
  const unlocked = game.badges.filter((b) => b.unlocked).length
  return (
    <>
      <PlayerCard game={game} />
      <div className="stat-grid">
        <div className="stat"><b>{game.totalChecks}</b><span>habits done</span></div>
        <div className="stat"><b>{game.workouts}</b><span>workouts</span></div>
        <div className="stat"><b>{fmtMinutes(game.focusMinutes)}</b><span>focused</span></div>
        <div className="stat"><b>{game.stepsDone}</b><span>micro-goals</span></div>
      </div>
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
      <Card title="How you earn XP" icon="✦">
        <ul className="xp-rules">
          <li><span>Complete a habit</span><b>+{XP.habit}</b></li>
          <li><span>Complete all habits of the day</span><b>+{XP.completeDay}</b></li>
          <li><span>Finish a planned workout</span><b>+{XP.session}</b></li>
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
    </>
  )
}
