import React, { useState, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './BattleResultsTab.css'

function BattleResultsTab({ battle, battles, onBattleDeleted }) {
  const [selectedBattle, setSelectedBattle] = useState(battle)
  const [allBattles, setAllBattles] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadBattles = async () => {
    try {
      const response = await axios.get('/api/battles')
      setAllBattles(response.data)
      return response.data
    } catch (err) {
      console.error('Failed to load battles:', err)
      return []
    }
  }

  const handleBattleSelect = async (battleId) => {
    if (battleId === selectedBattle?.id) return
    
    setLoading(true)
    try {
      const response = await axios.get(`/api/battle/${battleId}`)
      setSelectedBattle(response.data)
    } catch (err) {
      console.error('Failed to load battle:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load battles on mount and select the most recent one
  useEffect(() => {
    const initializeBattles = async () => {
      // Always load the battles list
      const battlesList = await loadBattles()
      
      // If we have battles, select the first (most recent) one
      // This ensures we always show data when navigating to this tab
      if (battlesList.length > 0) {
        // Only load if we don't already have this battle selected, or if battle prop is provided
        if (battle) {
          setSelectedBattle(battle)
        } else {
          // Select the first battle
          await handleBattleSelect(battlesList[0].id)
        }
      }
    }
    
    initializeBattles()
  }, []) // Run on mount only

  // Update when battle prop changes (e.g., after a new battle is created)
  useEffect(() => {
    if (battle) {
      setSelectedBattle(battle)
      loadBattles() // Reload battles list too
    }
  }, [battle])

  const handleDeleteBattle = async (battleId) => {
    if (!window.confirm(`Are you sure you want to delete Battle #${battleId}? This action cannot be undone.`)) {
      return
    }
    
    setDeleting(true)
    try {
      await axios.delete(`/api/battle/${battleId}`)
      
      // Reload battles list to get the updated list
      const updatedBattlesResponse = await axios.get('/api/battles')
      const updatedBattles = updatedBattlesResponse.data
      setAllBattles(updatedBattles)
      
      // If we deleted the currently selected battle, clear it or select another
      if (selectedBattle?.id === battleId) {
        if (updatedBattles.length > 0) {
          // Select the first available battle
          await handleBattleSelect(updatedBattles[0].id)
        } else {
          setSelectedBattle(null)
        }
      }
      
      // Notify parent component to refresh stats
      if (onBattleDeleted) {
        onBattleDeleted()
      }
      
      alert('Battle deleted successfully!')
    } catch (err) {
      alert('Failed to delete battle: ' + (err.response?.data?.detail || err.message))
    } finally {
      setDeleting(false)
    }
  }

  const getModelDisplayName = (model) => {
    const names = {
      openai: 'OpenAI',
      anthropic: 'Claude',
      google: 'Gemini',
      grok: 'Grok'
    }
    return names[model] || model
  }

  // Show loading state while initializing
  if (loading && !selectedBattle && allBattles.length === 0) {
    return (
      <div className="battle-results-tab">
        <h2>Battle Results</h2>
        <div className="loading">Loading battles...</div>
      </div>
    )
  }

  // Show empty state if no battles exist
  if (!selectedBattle && allBattles.length === 0) {
    return (
      <div className="battle-results-tab">
        <h2>Battle Results</h2>
        <p>Run a battle in the Chat tab to see results here.</p>
      </div>
    )
  }

  return (
    <div className="battle-results-tab">
      <h2>Battle Results</h2>

      {allBattles.length > 0 && (
        <div className="battle-selector">
          <label>Select Battle: </label>
          <select
            value={selectedBattle?.id || ''}
            onChange={(e) => handleBattleSelect(parseInt(e.target.value))}
            disabled={loading}
          >
            {allBattles.map((b) => (
              <option key={b.id} value={b.id}>
                Battle #{b.id}: {b.prompt}
              </option>
            ))}
          </select>
          {selectedBattle && (
            <button
              className="delete-battle-button"
              onClick={() => handleDeleteBattle(selectedBattle.id)}
              disabled={deleting || loading}
              title="Delete this battle"
            >
              {deleting ? 'Deleting...' : '🗑️ Delete'}
            </button>
          )}
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}

      {selectedBattle && (
        <>
          <div className="prompt-section">
            <h3>Original Prompt:</h3>
            <p className="prompt-text">{selectedBattle.prompt}</p>
          </div>

          <div className="responses-section">
            <h3>Responses (Ranked by Score):</h3>
            {selectedBattle.responses.map((response, index) => (
              <div
                key={index}
                className={`response-card ${response.is_winner ? 'winner' : ''}`}
              >
                <div className="response-header">
                  <div className="header-left">
                    {response.is_winner && (
                      <span className="winner-icon">🏆</span>
                    )}
                    <h4>
                      #{index + 1} - {response.model_display || getModelDisplayName(response.model)}
                      {response.is_winner && <span className="winner-text"> (Winner)</span>}
                    </h4>
                  </div>
                  <div className="score">Average Score: {response.average_score.toFixed(2)}/10</div>
                </div>
                
                <div className="ratings-breakdown">
                  <strong>Ratings Given By Each Judge:</strong>
                  <div className="ratings-list">
                    {Object.entries(response.ratings || {}).map(([judge, ratingData]) => {
                      const score = typeof ratingData === 'object' && ratingData !== null ? ratingData.score : ratingData;
                      const reasoning = typeof ratingData === 'object' && ratingData !== null ? ratingData.reasoning : null;
                      return (
                        <div key={judge} className="rating-item">
                          <div className="rating-header">
                            <span className="rating-badge">
                              {getModelDisplayName(judge)}: {score.toFixed(1)}/10
                            </span>
                          </div>
                          {reasoning && reasoning.trim() && (
                            <div className="rating-reasoning">
                              <strong>Reasoning:</strong> {reasoning}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="response-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {response.text}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default BattleResultsTab
