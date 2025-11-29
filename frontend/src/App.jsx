import React, { useState } from 'react'
import ChatTab from './components/ChatTab'
import BattleResultsTab from './components/BattleResultsTab'
import StatsTab from './components/StatsTab'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [currentBattle, setCurrentBattle] = useState(null)
  const [battles, setBattles] = useState([])

  const tabs = [
    { id: 'chat', label: 'Chat' },
    { id: 'results', label: 'Battle Results' },
    { id: 'stats', label: 'Stats' },
  ]

  return (
    <div className="app">
      <div className="app-header">
        <h1>🤖 LLM Battle Arena</h1>
        <p>Compare responses from Gemini, OpenAI, Claude, and Grok</p>
      </div>

      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'chat' && (
          <ChatTab
            onBattleComplete={(battle) => {
              setCurrentBattle(battle)
              setBattles([battle, ...battles])
              setActiveTab('results')
            }}
          />
        )}
        {activeTab === 'results' && (
          <BattleResultsTab battle={currentBattle} battles={battles} />
        )}
        {activeTab === 'stats' && <StatsTab />}
      </div>
    </div>
  )
}

export default App

