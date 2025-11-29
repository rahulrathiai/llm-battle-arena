import React, { useState } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './ChatTab.css'

function ChatTab({ onBattleComplete }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const battleResponse = await axios.post('/api/battle', { prompt })
      const battleData = battleResponse.data
      
      // Find winner response text
      const winnerResponse = battleData.responses.find(r => r.is_winner)
      if (winnerResponse) {
        setResponse(winnerResponse.text)
      } else {
        setResponse(battleData.responses[0]?.text || "No response received")
      }
      
      onBattleComplete(battleData)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-tab">
      <h2>Chat with the Best Response</h2>
      <p className="subtitle">Enter a prompt and see which LLM provides the best response</p>

      <form onSubmit={handleSubmit} className="chat-form">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here..."
          className="prompt-input"
          rows="6"
          disabled={loading}
        />
        <button type="submit" className="submit-button" disabled={loading || !prompt.trim()}>
          {loading ? 'Running Battle...' : 'Run Battle'}
        </button>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Running battle... This may take a minute as we query 4 LLMs and have them rate each other.</p>
        </div>
      )}

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {response && typeof response === 'string' && (
        <div className="response-container">
          <h3>Winner's Response:</h3>
          <div className="response-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {response}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatTab

