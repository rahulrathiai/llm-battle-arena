import React, { useState, useEffect, useRef } from 'react'
import ChatTab from './components/ChatTab'
import BattleResultsTab from './components/BattleResultsTab'
import StatsTab from './components/StatsTab'
import { useTheme } from './ThemeContext'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [currentBattle, setCurrentBattle] = useState(null)
  const [battles, setBattles] = useState([])
  const [statsRefreshKey, setStatsRefreshKey] = useState(0)
  
  // Load chat sessions from localStorage
  const loadChatSessions = () => {
    const saved = localStorage.getItem('chatSessions')
    if (saved) {
      return JSON.parse(saved)
    }
    // If no saved sessions, check for old chatMessages format and migrate
    const oldMessages = localStorage.getItem('chatMessages')
    if (oldMessages) {
      try {
        const messages = JSON.parse(oldMessages)
        if (Array.isArray(messages) && messages.length > 0) {
          const firstChat = {
            id: Date.now().toString(),
            title: messages[0]?.content?.substring(0, 50) || 'New Chat',
            messages: messages,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          localStorage.setItem('chatSessions', JSON.stringify([firstChat]))
          localStorage.removeItem('chatMessages')
          return [firstChat]
        }
      } catch (e) {
        console.error('Error migrating old chat messages:', e)
        // Clear invalid data
        localStorage.removeItem('chatMessages')
      }
    }
    return []
  }
  
  const [chatSessions, setChatSessions] = useState(loadChatSessions)
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = localStorage.getItem('activeChatId')
    return saved || null
  })
  // Track pending new chat ID to avoid creating duplicate chats during rapid updates
  const pendingChatIdRef = useRef(null)
  const { theme, toggleTheme } = useTheme()
  
  // Get active chat messages
  const activeChat = chatSessions.find(c => c.id === activeChatId) || (chatSessions.length > 0 ? chatSessions[0] : null)
  const activeChatMessages = Array.isArray(activeChat?.messages) ? activeChat.messages : []
  
  // Save chat sessions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions))
  }, [chatSessions])
  
  // Save active chat ID
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('activeChatId', activeChatId)
    }
  }, [activeChatId])
  
  // Update active chat ID if current one is deleted
  useEffect(() => {
    if (activeChatId && !chatSessions.find(c => c.id === activeChatId)) {
      setActiveChatId(chatSessions.length > 0 ? chatSessions[0].id : null)
    } else if (!activeChatId && chatSessions.length > 0) {
      setActiveChatId(chatSessions[0].id)
    }
  }, [chatSessions, activeChatId])
  
  const handleNewChat = () => {
    const newChat = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setChatSessions([newChat, ...chatSessions])
    setActiveChatId(newChat.id)
  }
  
  const handleChatSelect = (chatId) => {
    setActiveChatId(chatId)
  }
  
  const handleUpdateChatMessages = (messagesOrUpdater) => {
    // Check if we have an active chat or a pending one
    const effectiveChatId = activeChatId || pendingChatIdRef.current
    const needsNewChat = !effectiveChatId
    
    // Use functional update to always work with latest state
    setChatSessions(prevSessions => {
      // Support both direct array and updater function (like React setState)
      let messagesArray
      
      if (typeof messagesOrUpdater === 'function') {
        // It's an updater function - get current messages from the latest chat sessions
        if (needsNewChat) {
          // No active chat - start with empty array
          const updatedMessages = messagesOrUpdater([])
          messagesArray = Array.isArray(updatedMessages) ? updatedMessages : []
        } else {
          // Get current messages from active or pending chat
          const targetChatId = effectiveChatId
          const currentActiveChat = prevSessions.find(c => c.id === targetChatId)
          const currentMessages = (currentActiveChat && Array.isArray(currentActiveChat.messages)) 
            ? currentActiveChat.messages 
            : []
          const updatedMessages = messagesOrUpdater(currentMessages)
          messagesArray = Array.isArray(updatedMessages) ? updatedMessages : []
        }
      } else {
        // It's a direct array
        messagesArray = Array.isArray(messagesOrUpdater) ? messagesOrUpdater : []
      }
      
      if (needsNewChat) {
        // If no active chat, create a new one with the messages
        // Use pending chat ID if one exists (from a previous rapid update)
        const newChatId = pendingChatIdRef.current || Date.now().toString()
        pendingChatIdRef.current = newChatId
        
        const firstUserMessage = messagesArray.find(m => m.role === 'user')
        const title = firstUserMessage ? firstUserMessage.content.substring(0, 50).trim() || 'New Chat' : 'New Chat'
        
        // Check if chat already exists (from previous rapid update)
        const existingChat = prevSessions.find(c => c.id === newChatId)
        if (existingChat) {
          // Update existing chat instead of creating new one
          return prevSessions.map(chat => 
            chat.id === newChatId 
              ? { ...chat, messages: messagesArray, updatedAt: Date.now() }
              : chat
          )
        }
        
        const newChat = {
          id: newChatId,
          title: title,
          messages: messagesArray,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        // Set active chat ID immediately
        setActiveChatId(newChatId)
        // Clear pending ref after a short delay
        setTimeout(() => { pendingChatIdRef.current = null }, 1000)
        return [newChat, ...prevSessions]
      }
      
      // Clear pending ref if we have an active chat
      pendingChatIdRef.current = null
      
      return prevSessions.map(chat => {
        if (chat.id === effectiveChatId) {
          const updatedChat = {
            ...chat,
            messages: messagesArray,
            updatedAt: Date.now()
          }
          // Auto-generate title from first user message if it's still "New Chat"
          if (updatedChat.title === 'New Chat' && messagesArray.length > 0) {
            const firstUserMessage = messagesArray.find(m => m.role === 'user')
            if (firstUserMessage) {
              updatedChat.title = firstUserMessage.content.substring(0, 50).trim() || 'New Chat'
            }
          }
          return updatedChat
        }
        return chat
      })
    })
  }

  const tabs = [
    { id: 'chat', label: 'Chat' },
    { id: 'results', label: 'Battle Results' },
    { id: 'stats', label: 'Stats' },
  ]

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-content">
          <div>
            <h1>🤖 LLM Battle Arena</h1>
            <p>Compare responses from Gemini, OpenAI, Claude, and Grok</p>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
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
            chatSessions={chatSessions}
            activeChatId={activeChatId}
            messages={activeChatMessages}
            setMessages={handleUpdateChatMessages}
            onNewChat={handleNewChat}
            onChatSelect={handleChatSelect}
            onBattleComplete={(battle) => {
              setCurrentBattle(battle)
              setBattles([battle, ...battles])
              // Don't redirect - stay on Chat tab to show the answer
            }}
            onNavigateToResults={() => setActiveTab('results')}
          />
        )}
        {activeTab === 'results' && (
          <BattleResultsTab 
            key="battle-results" 
            battle={currentBattle} 
            battles={battles}
            activeChatId={activeChatId}
            onAddToChat={(battleData) => {
              // Get winner response
              const winnerResponse = battleData.responses.find(r => r.is_winner) || battleData.responses[0]
              if (!winnerResponse) return
              
              // Prepare new messages
              const userMessage = { role: 'user', content: battleData.prompt }
              const assistantMessage = { 
                role: 'assistant', 
                content: winnerResponse.text, 
                battleId: battleData.id 
              }
              
              if (!activeChatId) {
                // Create new chat with the battle messages
                const newMessages = [userMessage, assistantMessage]
                handleUpdateChatMessages(newMessages)
              } else {
                // Add to existing chat - check if already exists
                const currentMessages = activeChatMessages || []
                const alreadyExists = currentMessages.some(msg => msg.battleId === battleData.id)
                if (!alreadyExists) {
                  const newMessages = [...currentMessages, userMessage, assistantMessage]
                  handleUpdateChatMessages(newMessages)
                }
              }
            }}
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

