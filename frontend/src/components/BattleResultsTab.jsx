import React, { useState, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './BattleResultsTab.css'

function BattleResultsTab({ battle, battles }) {
  const [selectedBattle, setSelectedBattle] = useState(battle)
  const [allBattles, setAllBattles] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSelectedBattle(battle)
    loadBattles()
  }, [battle])

  const loadBattles = async () => {
    try {
      const response = await axios.get('/api/battles')
      setAllBattles(response.data)
    } catch (err) {
      console.error('Failed to load battles:', err)
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

  const getModelDisplayName = (model) => {
    const names = {
      openai: 'OpenAI',
      anthropic: 'Claude',
      google: 'Gemini',
      grok: 'Grok'
    }
    return names[model] || model
  }

  if (!selectedBattle) {
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

