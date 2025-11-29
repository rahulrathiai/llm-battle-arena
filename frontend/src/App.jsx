import React, { useState } from 'react'
import ChatTab from './components/ChatTab'
import BattleResultsTab from './components/BattleResultsTab'
import StatsTab from './components/StatsTab'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [currentBattle, setCurrentBattle] = useState(null)
  const [battles, setBattles] = useState([])
  const [statsRefreshKey, setStatsRefreshKey] = useState(0)

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
          <BattleResultsTab 
            key="battle-results" 
            battle={currentBattle} 
            battles={battles}
            onBattleDeleted={() => {
              // Refresh stats when a battle is deleted
              setStatsRefreshKey(prev => prev + 1)
              // Update battles list
              setBattles([])
              // Clear current battle if it was deleted
              setCurrentBattle(null)
            }}
          />
        )}
        {activeTab === 'stats' && <StatsTab key={statsRefreshKey} />}
      </div>
    </div>
  )
}

export default App

