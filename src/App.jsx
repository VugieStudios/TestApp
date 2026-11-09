import { useState } from 'react'
import { useStore } from './store.js'
import Today from './views/Today.jsx'
import Habits from './views/Habits.jsx'
import Goals from './views/Goals.jsx'
import Journal from './views/Journal.jsx'
import Insights from './views/Insights.jsx'

const TABS = [
  { id: 'today', label: 'Today', icon: '☀️' },
  { id: 'habits', label: 'Habits', icon: '🔁' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
  { id: 'journal', label: 'Journal', icon: '📓' },
  { id: 'insights', label: 'Insights', icon: '📈' },
]

export default function App() {
  const [data, actions] = useStore()
  const [tab, setTab] = useState('today')

  const View = { today: Today, habits: Habits, goals: Goals, journal: Journal, insights: Insights }[tab]

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">🌱 Grow</span>
        <nav className="tabs desktop-only">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        <View data={data} actions={actions} goTo={setTab} />
      </main>

      <nav className="bottom-nav mobile-only">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
