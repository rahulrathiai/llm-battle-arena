import React, { useState, useEffect } from 'react'
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
  
  const handleUpdateChatMessages = (messages) => {
    // Ensure messages is always an array
    const messagesArray = Array.isArray(messages) ? messages : []
    
    if (!activeChatId) {
      // If no active chat, create a new one with the messages
      const firstUserMessage = messagesArray.find(m => m.role === 'user')
      const title = firstUserMessage ? firstUserMessage.content.substring(0, 50).trim() || 'New Chat' : 'New Chat'
      
      const newChat = {
        id: Date.now().toString(),
        title: title,
        messages: messagesArray,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      setChatSessions([newChat, ...chatSessions])
      setActiveChatId(newChat.id)
      return
    }
    
    setChatSessions(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
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
    }))
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

