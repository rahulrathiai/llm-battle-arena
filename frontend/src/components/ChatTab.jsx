import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import './ChatTab.css'

function ChatTab({ 
  chatSessions = [], 
  activeChatId, 
  messages: propMessages, 
  setMessages: propSetMessages, 
  onNewChat,
  onChatSelect,
  onBattleComplete, 
  onNavigateToResults 
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  
  // Always use prop messages for persistence (from parent App component)
  const messages = propMessages || []
  const setMessages = propSetMessages || (() => {})
  
  // Preprocess content to convert math blocks to $$ ... $$ format (for remark-math)
  const preprocessMath = (content) => {
    if (!content || typeof content !== 'string') return content
    let processed = content
    
    // Protect existing $$ blocks from being modified
    const protectedBlocks = []
    let blockIndex = 0
    processed = processed.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      const placeholder = `__PROTECTED_BLOCK_${blockIndex}__`
      protectedBlocks.push(match)
      blockIndex++
      return placeholder
    })
    
    // FIRST: Fix malformed math expressions that are missing opening delimiters
    // Handle: "> \frac{...} $$" or "\frac{...} $$" → "$$\frac{...}$$"
    // Use greedy matching to capture entire LaTeX expression including nested braces
    
    // Pattern: match from backslash command to $$ (greedy, captures everything including nested braces)
    processed = processed.replace(/(^>\s*|^)(\\[a-zA-Z]+[^$]*?)\s*\$\$/gm, (match, prefix, mathExpr) => {
      // Only process if it looks like LaTeX math (contains backslash command)
      if (/\\[a-zA-Z]+/.test(mathExpr)) {
        // Remove blockquote marker if present
        if (prefix.includes('>')) {
          return `$$${mathExpr}$$`
        }
        return `$$${mathExpr}$$`
      }
      return match
    })
    
    // First, convert complete \[ ... \] blocks to $$ ... $$
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, '$$$1$$')
    
    // Handle incomplete \[ blocks (missing closing \])
    processed = processed.replace(/\\\[([\s\S]*?)(?:\n\n|$)/g, (match, inner) => {
      if (/\\[a-zA-Z]+/.test(inner)) {
        return `$$${inner}$$`
      }
      return match
    })
    
    // Convert multi-line $ blocks that should be block math
    // Only convert if they span multiple lines or are clearly block math
    processed = processed.replace(/\$\s*([\s\S]+?)\s*\$/g, (match, inner) => {
      // Skip if it's already protected or doesn't contain LaTeX
      if (!/\\[a-zA-Z]+/.test(inner)) return match
      
      // Convert to block math if it has newlines, multiple fractions, or is long
      if (inner.includes('\n') || (inner.match(/\\frac/g) || []).length > 1 || inner.length > 100) {
        return `$$${inner}$$`
      }
      return match
    })
    
    // Convert inline math in parentheses like (T_{\text{math}}) = at start of lines
    processed = processed.replace(/^\(([A-Za-z_]+)_{\\text\{[^}]+\}}\)\s*=/gm, (match) => {
      const mathContent = match.replace(/^\(/, '').replace(/\)\s*=$/, '')
      return `\\(${mathContent}\\) =`
    })
    
    // Handle standalone math expressions in parentheses like (N \to \infty)
    processed = processed.replace(/\(([A-Za-z]+)\s*\\to\s*\\infty\)/g, (match) => {
      return match.replace(/^\(/, '\\(').replace(/\)$/, '\\)')
    })
    
    // Convert [ ... ] blocks that contain LaTeX commands to $$ ... $$
    processed = processed.replace(/\[\s*((?:[^\]]|\\\])+?)\s*\]/g, (match, inner) => {
      if (/\\[a-zA-Z]+\{/.test(inner) || /\\[a-zA-Z]+/.test(inner)) {
        return `$$${inner}$$`
      }
      return match
    })
    
    // Fix orphaned $$ markers - remove standalone $$ that appear alone (not between math)
    processed = processed.replace(/\s*\$\$\s+([A-Za-z])/g, ' $1')
    
    // Restore protected blocks
    protectedBlocks.forEach((block, index) => {
      processed = processed.replace(`__PROTECTED_BLOCK_${index}__`, block)
    })
    
    return processed
  }
  
  // Sort chat sessions by updatedAt (most recent first)
  const sortedChatSessions = [...chatSessions].sort((a, b) => b.updatedAt - a.updatedAt)
  
  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!prompt.trim() || loading) return

    const userPrompt = prompt.trim()
    setPrompt('')
    setError(null)

    // Add user message - ensure we always work with an array
    setMessages(prev => {
      const currentMessages = prev || []
      return [...currentMessages, { role: 'user', content: userPrompt }]
    })
    setLoading(true)

    try {
      // Build conversation history from previous messages in THIS chat session only
      // Format: [{role: 'user', content: '...'}, {role: 'assistant', content: '...'}]
      // Note: messages array comes from activeChatMessages which is already filtered to the active chat
      const conversationHistory = (messages || []).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      
      // Debug logging to verify context isolation
      if (conversationHistory.length > 0) {
        const battleIds = messages
          .filter(m => m.battleId)
          .map(m => m.battleId)
          .sort((a, b) => a - b)
        console.log(`📝 Conversation context for chat "${activeChatId}":`, {
          chatId: activeChatId,
          totalMessages: conversationHistory.length,
          battleIdsInThisChat: battleIds.length > 0 ? battleIds : 'none',
          willIncludeInContext: battleIds.length > 0 ? `Battles ${battleIds.join(', ')}` : 'none'
        })
      }

      // Build request payload - only include conversation_history if we have messages
      const requestPayload = { 
        prompt: userPrompt
      }
      if (conversationHistory.length > 0) {
        requestPayload.conversation_history = conversationHistory
      }
      
      const battleResponse = await axios.post('/api/battle', requestPayload)
      const battleData = battleResponse.data
      
      // Find winner response text
      const winnerResponse = battleData.responses.find(r => r.is_winner) || battleData.responses[0]
      if (winnerResponse) {
        setMessages(prev => [...(prev || []), { 
          role: 'assistant', 
          content: winnerResponse.text,
          battleId: battleData.id
        }])
      } else {
        setMessages(prev => [...(prev || []), { 
          role: 'assistant', 
          content: "No response received"
        }])
      }
      
      onBattleComplete(battleData)
    } catch (err) {
      console.error('Error in handleSubmit:', err)
      const errorMsg = err.response?.data?.detail || err.message || 'An error occurred'
      setError(errorMsg)
      setMessages(prev => [...(prev || []), { 
        role: 'assistant', 
        content: `Error: ${errorMsg}`
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="chat-tab">
      <div className="chat-layout">
        {/* Sidebar */}
        <div className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <button className="new-chat-button" onClick={onNewChat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Chat
            </button>
            <button 
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="chat-list">
            {sortedChatSessions.length === 0 ? (
              <div className="no-chats">
                <p>No chats yet. Start a new conversation!</p>
              </div>
            ) : (
              sortedChatSessions.map((chat) => (
                <button
                  key={chat.id}
                  className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
                  onClick={() => onChatSelect(chat.id)}
                  title={chat.title}
                >
                  <div className="chat-item-title">{chat.title}</div>
                  <div className="chat-item-date">{formatDate(chat.updatedAt)}</div>
                </button>
              ))
            )}
          </div>
        </div>
        
        {/* Main chat area */}
        <div className="chat-main">
          {!sidebarOpen && (
            <button 
              className="sidebar-open-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          )}
          
          <div className="chat-container">
            <div className="chat-messages">
              {(!messages || messages.length === 0) && !loading && (
                <div className="welcome-message">
                  <h2>How can I help you today?</h2>
                  <p>Ask me anything and I'll provide the best answer from our LLM battle arena.</p>
                </div>
              )}
              
              {(messages || []).map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <div className="message-content">
                    {message.role === 'user' ? (
                      <div className="message-text user-message">{message.content}</div>
                    ) : (
                      <div className="message-text assistant-message">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]} 
                          rehypePlugins={[rehypeKatex]}
                        >
                          {preprocessMath(message.content)}
                        </ReactMarkdown>
                        {message.battleId && onNavigateToResults && (
                          <div className="view-details-link">
                            <button 
                              onClick={() => onNavigateToResults()}
                              className="details-button"
                            >
                              View battle details →
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="message assistant">
                  <div className="message-content">
                    <div className="loading-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <div className="loading-text">Running battle and analyzing responses...</div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              <form onSubmit={handleSubmit} className="chat-input-form">
                <div className="input-wrapper">
                  <textarea
                    ref={inputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e)
                      }
                    }}
                    placeholder="Message..."
                    className="chat-input"
                    rows="1"
                    disabled={loading}
                  />
                  <button 
                    type="submit" 
                    className="send-button" 
                    disabled={loading || !prompt.trim()}
                    aria-label="Send message"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </form>
              <div className="input-footer">
                <span>Press Enter to send, Shift+Enter for new line</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatTab
