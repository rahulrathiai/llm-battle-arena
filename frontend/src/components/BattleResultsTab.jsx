import React, { useState, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import './BattleResultsTab.css'

function BattleResultsTab({ battle, battles, activeChatId, onAddToChat, onBattleDeleted }) {
  const [selectedBattle, setSelectedBattle] = useState(battle)
  const [allBattles, setAllBattles] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // Load chat sessions to check if battle is already in a chat
  const [chatSessions, setChatSessions] = useState([])
  
  // Preprocess content to convert math blocks to $$ ... $$ format (for remark-math)
  const preprocessMath = (content) => {
    if (!content || typeof content !== 'string') return content
    let processed = content
    
    // Step 1: Protect existing $$ blocks from being modified
    const protectedBlocks = []
    let blockIndex = 0
    processed = processed.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      const placeholder = `__MATH_BLOCK_${blockIndex}__`
      protectedBlocks.push(match)
      blockIndex++
      return placeholder
    })
    
    // Step 2: Protect existing $ inline math (single dollar)
    const protectedInline = []
    let inlineIndex = 0
    processed = processed.replace(/\$[^\$\n]+?\$/g, (match) => {
      // Only protect if it's not multi-line and looks like complete inline math
      if (!match.includes('\n') && match.length < 100) {
        const placeholder = `__MATH_INLINE_${inlineIndex}__`
        protectedInline.push(match)
        inlineIndex++
        return placeholder
      }
      return match
    })
    
    // Step 3: Convert complete \[ ... \] blocks to $$ ... $$
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, '$$$1$$')
    
    // Step 4: Handle incomplete \[ blocks (missing closing \])
    processed = processed.replace(/\\\[([\s\S]*?)(?:\n\n|$)/g, (match, inner) => {
      if (/\\[a-zA-Z]+/.test(inner)) {
        return `$$${inner}$$`
      }
      return match
    })
    
    // Step 5: Convert multi-line $ blocks that should be block math
    processed = processed.replace(/\$\s*([\s\S]+?)\s*\$/g, (match, inner) => {
      if (!/\\[a-zA-Z]+/.test(inner)) return match
      if (inner.includes('\n') || (inner.match(/\\frac/g) || []).length > 1 || inner.length > 100) {
        return `$$${inner}$$`
      }
      return match
    })
    
    // Step 6: Convert inline math in parentheses like (T_{\text{math}}) = at start of lines
    processed = processed.replace(/^\(([A-Za-z_]+)_{\\text\{[^}]+\}}\)\s*=/gm, (match) => {
      const mathContent = match.replace(/^\(/, '').replace(/\)\s*=$/, '')
      return `\\(${mathContent}\\) =`
    })
    
    // Step 7: Handle standalone math expressions in parentheses like (N \to \infty)
    processed = processed.replace(/\(([A-Za-z]+)\s*\\to\s*\\infty\)/g, (match) => {
      return match.replace(/^\(/, '\\(').replace(/\)$/, '\\)')
    })
    
    // Step 8: Convert [ ... ] blocks that contain LaTeX commands to $$ ... $$
    processed = processed.replace(/\[\s*((?:[^\]]|\\\])+?)\s*\]/g, (match, inner) => {
      if (/\\[a-zA-Z]+\{/.test(inner) || /\\[a-zA-Z]+/.test(inner)) {
        return `$$${inner}$$`
      }
      return match
    })
    
    // Step 9: Restore protected blocks
    protectedInline.forEach((block, index) => {
      processed = processed.replace(`__MATH_INLINE_${index}__`, block)
    })
    protectedBlocks.forEach((block, index) => {
      processed = processed.replace(`__MATH_BLOCK_${index}__`, block)
    })
    
    return processed
  }
  
  useEffect(() => {
    const saved = localStorage.getItem('chatSessions')
    if (saved) {
      try {
        setChatSessions(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading chat sessions:', e)
      }
    }
  }, [])
  
  // Check if battle is already in the current active chat
  const isBattleInChat = (battleId) => {
    if (!activeChatId) return false
    const activeChat = chatSessions.find(session => session.id === activeChatId)
    if (!activeChat || !activeChat.messages) return false
    return activeChat.messages.some(msg => msg.battleId === battleId)
  }
  
  const handleAddToChat = () => {
    if (selectedBattle && onAddToChat) {
      onAddToChat(selectedBattle)
      // Reload chat sessions after a short delay to update the check
      setTimeout(() => {
        const saved = localStorage.getItem('chatSessions')
        if (saved) {
          try {
            setChatSessions(JSON.parse(saved))
          } catch (e) {
            console.error('Error reloading chat sessions:', e)
          }
        }
      }, 200)
    }
  }

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

  const formatTiebreakerMethod = (method) => {
    const methods = {
      'max_score': 'Highest Maximum Score',
      'lowest_variance': 'Most Consistent (Lowest Variance)',
      'head_to_head': 'Head-to-Head Comparison',
      'alphabetical_fallback': 'Alphabetical Order (Perfect Tie)'
    }
    return methods[method] || method
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
            <>
              {onAddToChat && !isBattleInChat(selectedBattle.id) && (
                <button
                  className="add-to-chat-button"
                  onClick={handleAddToChat}
                  disabled={loading}
                  title="Add this battle to your current chat"
                >
                  💬 Add to Chat
                </button>
              )}
              <button
                className="delete-battle-button"
                onClick={() => handleDeleteBattle(selectedBattle.id)}
                disabled={deleting || loading}
                title="Delete this battle"
              >
                {deleting ? 'Deleting...' : '🗑️ Delete'}
              </button>
            </>
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

          {selectedBattle.tiebreaker_info?.tie_occurred && (
            <div className="tiebreaker-info">
              <strong>⚔️ Tie Detected!</strong> Multiple models achieved the same average score.
              {selectedBattle.tiebreaker_info.method !== 'average_score' && (
                <span className="tiebreaker-method">
                  {' '}Winner determined by: <strong>{formatTiebreakerMethod(selectedBattle.tiebreaker_info.method)}</strong>
                </span>
              )}
            </div>
          )}

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
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                  >
                    {preprocessMath(response.text)}
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
