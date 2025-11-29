import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './StatsTab.css'

function StatsTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStats()
    // Refresh stats every 5 seconds
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/stats')
      setStats(response.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  const getModelDisplayName = (entry) => {
    // Use model_display from API if available, otherwise fallback to generic names
    if (entry.model_display) {
      return entry.model_display
    }
    const names = {
      openai: 'OpenAI',
      anthropic: 'Claude',
      google: 'Gemini',
      grok: 'Grok'
    }
    return names[entry.model] || entry.model
  }

  if (loading) {
    return (
      <div className="stats-tab">
        <h2>Statistics</h2>
        <div className="loading">Loading statistics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="stats-tab">
        <h2>Statistics</h2>
        <div className="error">Error: {error}</div>
      </div>
    )
  }

  const handleClearStats = async () => {
    if (!window.confirm('Are you sure you want to clear all statistics? This action cannot be undone.')) {
      return
    }
    
    try {
      await axios.delete('/api/stats')
      await loadStats()
      alert('All statistics have been cleared!')
    } catch (err) {
      alert('Failed to clear statistics: ' + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className="stats-tab">
      <div className="stats-header">
        <h2>Statistics</h2>
        {stats?.total_battles > 0 && (
          <button className="clear-stats-button" onClick={handleClearStats}>
            Clear All Stats
          </button>
        )}
      </div>
      
      <div className="stats-summary">
        <div className="stat-card">
          <div className="stat-value">{stats?.total_battles || 0}</div>
          <div className="stat-label">Total Battles</div>
        </div>
      </div>

      <div className="leaderboard-section">
        <h3>Leaderboard</h3>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Model</th>
              <th>Wins</th>
              <th>Win Rate</th>
              <th>Average Score</th>
            </tr>
          </thead>
          <tbody>
            {stats?.leaderboard?.map((entry, index) => (
              <tr key={entry.model} className={index === 0 ? 'first-place' : ''}>
                <td className="rank">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </td>
                <td className="model-name">{getModelDisplayName(entry)}</td>
                <td className="wins">{entry.wins}</td>
                <td className="win-rate">{entry.win_rate}%</td>
                <td className="avg-score">
                  <div className="score-bar-container">
                    <span>{entry.average_score.toFixed(2)}</span>
                    <div className="score-bar">
                      <div
                        className="score-bar-fill"
                        style={{ width: `${(entry.average_score / 10) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {(!stats?.leaderboard || stats.leaderboard.length === 0) && (
              <tr>
                <td colSpan="5" className="no-data">
                  No battles yet. Run a battle in the Chat tab to see statistics!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default StatsTab

