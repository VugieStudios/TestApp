import { useState } from 'react'
import { Seg } from '../components/ui.jsx'
import Habits from './Habits.jsx'
import Train from './Train.jsx'
import Goals from './Goals.jsx'

// Everything you set up once and then follow: habits, your workout scheme and goals
export default function Plan(props) {
  const [tab, setTab] = useState(['habits', 'training', 'goals'].includes(props.sub) ? props.sub : 'habits')
  return (
    <div className="stack">
      <header className="page-head"><h1>Plan</h1></header>
      <Seg value={tab} onChange={setTab} options={[['habits', '↻ Habits'], ['training', '⚡ Training'], ['goals', '◎ Goals']]} />
      {tab === 'habits' && <Habits {...props} embedded />}
      {tab === 'training' && <Train {...props} embedded />}
      {tab === 'goals' && <Goals {...props} embedded />}
    </div>
  )
}
