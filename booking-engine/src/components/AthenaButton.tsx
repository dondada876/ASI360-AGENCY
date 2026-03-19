'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConversation } from '@elevenlabs/react'

interface AthenaButtonProps {
  onSelectZone?: (zoneId: string) => void
}

const AUDIO_CLIPS: Record<string, string> = {
  welcome: '/audio/welcome.mp3',
  umbrella: '/audio/book-umbrella.mp3',
  cabana: '/audio/book-cabana.mp3',
  sunset: '/audio/sunset-spots.mp3',
  history: '/audio/lake-history.mp3',
}

type ModalView = 'menu' | 'conversation'

export default function AthenaButton({ onSelectZone }: AthenaButtonProps) {
  const [showTooltip, setShowTooltip] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [view, setView] = useState<ModalView>('menu')
  const [playing, setPlaying] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{ role: 'agent' | 'user'; text: string }>>([])
  const [textInput, setTextInput] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [chatLoading, setChatLoading] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-hide tooltip
  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(false), 8000)
    return () => clearTimeout(timer)
  }, [])

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      setConnecting(false)
      setMessages(prev => [...prev, { role: 'agent', text: 'Hi! I\'m Athena, Guardian of Innocence. I\'m here to help you find the perfect spot at Lake Merritt. What can I help you with today?' }])
    },
    onDisconnect: () => {
      setConnecting(false)
    },
    onMessage: ({ message, source }: { message: string; source: string }) => {
      if (source === 'ai' && message) {
        setMessages(prev => [...prev, { role: 'agent', text: message }])
      } else if (source === 'user' && message) {
        setMessages(prev => [...prev, { role: 'user', text: message }])
      }
    },
    onError: (error: string) => {
      console.error('Athena conversation error:', error)
      setConnecting(false)
      setMessages(prev => [...prev, { role: 'agent', text: 'I had trouble connecting. You can also call me at (510) 288-0994.' }])
    },
  })

  // Track volume for visualizer
  useEffect(() => {
    if (conversation.isSpeaking) {
      const interval = setInterval(() => {
        setVolumeLevel(0.3 + Math.random() * 0.7)
      }, 100)
      return () => clearInterval(interval)
    } else {
      setVolumeLevel(0)
    }
  }, [conversation.isSpeaking])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send text message via Claude API
  const sendTextMessage = useCallback(async (text: string) => {
    const userMsg = { role: 'user' as const, text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setChatLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'agent', text: data.reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: "Sorry, I had trouble responding. Try again or call (510) 288-0994!" }])
    } finally {
      setChatLoading(false)
    }
  }, [messages])

  // Start voice conversation with mic permission check
  const startConversation = useCallback(async () => {
    setMicError(null)

    // Check mic permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop()) // Release immediately, just testing permission
    } catch (err: any) {
      const errorName = err?.name || ''
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setMicError('Microphone access was denied. Go to your browser Settings > Privacy > Microphone and allow this site. Or use text chat below!')
      } else if (errorName === 'NotFoundError') {
        setMicError('No microphone found. You can use text chat instead!')
      } else {
        setMicError('Couldn\'t access microphone. Try text chat or call (510) 288-0994.')
      }
      // Still switch to conversation view — text chat works without mic
      setView('conversation')
      setMessages([{ role: 'agent', text: 'Hi! I\'m Athena. I couldn\'t access your microphone, but you can type your questions below and I\'ll help you find the perfect spot at Lake Merritt! ☂️' }])
      return
    }

    setView('conversation')
    setConnecting(true)
    setMessages([])

    try {
      const res = await fetch('/api/voice-token')
      const data = await res.json()

      if (data.signedUrl) {
        await conversation.startSession({ signedUrl: data.signedUrl })
      } else if (data.agentId) {
        const directUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${data.agentId}`
        await conversation.startSession({ signedUrl: directUrl })
      }
    } catch (err) {
      console.error('Failed to start Athena voice session:', err)
      setConnecting(false)
      setMessages([{ role: 'agent', text: 'Voice connection didn\'t work this time, but you can type your questions below! I\'m Athena, here to help you find shade at the lake. ☂️' }])
    }
  }, [conversation])

  const endConversation = useCallback(async () => {
    if (conversation.status === 'connected') {
      await conversation.endSession()
    }
    setView('menu')
    setMessages([])
  }, [conversation])

  const playAudio = useCallback((clipKey: string, src: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (playing === clipKey) { setPlaying(null); return }

    const audio = new Audio(src)
    audio.addEventListener('ended', () => setPlaying(null))
    audio.addEventListener('error', () => setPlaying(null))
    audio.play().catch(() => setPlaying(null))
    audioRef.current = audio
    setPlaying(clipKey)
  }, [playing])

  const handleAction = useCallback((action: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlaying(null) }

    switch (action) {
      case 'umbrella':
        playAudio('umbrella', AUDIO_CLIPS.umbrella)
        setTimeout(() => { setShowModal(false); onSelectZone?.('A1') }, 500)
        break
      case 'cabana':
        playAudio('cabana', AUDIO_CLIPS.cabana)
        setTimeout(() => { setShowModal(false); onSelectZone?.('A1') }, 500)
        break
      case 'sunset':
        playAudio('sunset', AUDIO_CLIPS.sunset)
        setTimeout(() => { setShowModal(false); onSelectZone?.('C2') }, 500)
        break
      case 'weather':
        playAudio('welcome', AUDIO_CLIPS.welcome)
        break
      case 'history':
        playAudio('history', AUDIO_CLIPS.history)
        break
      case 'call':
        window.location.href = 'tel:+15102880994'
        break
    }
  }, [playAudio, onSelectZone])

  const handleClose = () => {
    if (audioRef.current) { audioRef.current.pause(); setPlaying(null) }
    if (conversation.status === 'connected') conversation.endSession()
    setShowModal(false)
    setView('menu')
    setMessages([])
  }

  // Visualizer bars component
  const VoiceVisualizer = ({ active, size = 'lg' }: { active: boolean; size?: 'sm' | 'lg' }) => {
    const barCount = size === 'lg' ? 12 : 5
    const maxH = size === 'lg' ? 40 : 14
    const barW = size === 'lg' ? 3 : 1.5
    return (
      <div className="flex items-center justify-center gap-[2px]" style={{ height: maxH + 4 }}>
        {Array.from({ length: barCount }).map((_, i) => (
          <motion.div
            key={i}
            className="rounded-full"
            style={{ width: barW, background: active ? '#D4AF37' : 'rgba(212,175,55,0.2)' }}
            animate={{
              height: active ? 4 + Math.sin(Date.now() / 200 + i * 0.8) * maxH * volumeLevel : 4,
            }}
            transition={{ duration: 0.1 }}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Floating Athena button */}
      <div className="fixed right-4 bottom-48 sm:bottom-40 z-40 flex flex-col items-end gap-2">
        <AnimatePresence>
          {showTooltip && !showModal && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.9 }}
              transition={{ delay: 2, duration: 0.4 }}
              className="rounded-xl px-3 py-2 max-w-[200px] mr-1"
              style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,41,55,0.9)', border: '1px solid rgba(212,175,55,0.25)' }}
            >
              <div className="text-[11px] text-cream font-medium">👋 Hi! I&apos;m Athena</div>
              <div className="text-[10px] text-cream/50 mt-0.5">Tap to talk or text me</div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => { setShowTooltip(false); setShowModal(true) }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #D4AF37, #B8962E)',
            border: '2px solid rgba(255,248,240,0.3)',
            boxShadow: '0 4px 20px rgba(212,175,55,0.4), 0 0 40px rgba(212,175,55,0.1)',
          }}
        >
          <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: 'rgba(212,175,55,0.5)' }} />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="relative z-10">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="#1A1A2E" />
            <path d="M5 10a7 7 0 0 0 14 0" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 17v4M8 21h8" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="absolute -bottom-5 text-[8px] text-gold/80 font-bold tracking-wider uppercase">ATHENA</span>
        </motion.button>
      </div>

      {/* Athena Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="relative w-full sm:w-[420px] max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
              style={{ background: 'rgba(15,41,55,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(212,175,55,0.2)', boxShadow: '0 -10px 60px rgba(0,0,0,0.5)' }}
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center relative"
                         style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)' }}>
                      {conversation.isSpeaking ? (
                        <VoiceVisualizer active={true} size="sm" />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <rect x="9" y="2" width="6" height="12" rx="3" fill="#1A1A2E" />
                          <path d="M5 10a7 7 0 0 0 14 0" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
                          <path d="M12 17v4M8 21h8" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="text-cream font-semibold text-base">Athena</h3>
                      <p className="text-cream/40 text-[11px]">
                        {conversation.status === 'connected' ? (
                          <span className="text-green-400">● Connected</span>
                        ) : connecting ? (
                          <span className="text-amber-400">Connecting...</span>
                        ) : (
                          'Guardian of Innocence'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {view === 'conversation' && (
                      <button onClick={endConversation}
                              className="text-cream/40 hover:text-cream/70 text-[10px] px-2 py-1 rounded border border-white/10 hover:border-red-400/30 hover:text-red-300 transition-all">
                        End
                      </button>
                    )}
                    <button onClick={handleClose} className="text-cream/30 hover:text-cream/60 p-2 text-lg">✕</button>
                  </div>
                </div>
              </div>

              {/* Menu View */}
              {view === 'menu' && (
                <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
                  <div className="text-cream/70 text-sm leading-relaxed">
                    Welcome to the <strong className="text-gold">Umbrella Project</strong> at Empowerment Park.
                    Empower your reservoir for community, fun, fitness, and good times.
                  </div>

                  {/* Audio playing indicator */}
                  {playing && (
                    <div className="bg-gold/10 border border-gold/20 rounded-lg px-3 py-2 flex items-center gap-2">
                      <VoiceVisualizer active={true} size="sm" />
                      <span className="text-gold text-[11px] font-medium flex-1">Athena is speaking...</span>
                      <button onClick={() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }; setPlaying(null) }}
                              className="text-cream/40 hover:text-cream/70 text-[10px] px-2 py-0.5 rounded border border-white/10">Stop</button>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="space-y-2">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-cream/30 font-semibold">Quick Actions</div>
                    {[
                      { key: 'umbrella', icon: '☂️', label: 'Book an umbrella', desc: 'Find shade at the lake' },
                      { key: 'cabana', icon: '🏕️', label: 'Book a cabana', desc: 'Full setup with couch & rug' },
                      { key: 'sunset', icon: '🌅', label: 'Best sunset spots', desc: 'Golden hour zones' },
                      { key: 'weather', icon: '🌤️', label: "Today's weather", desc: 'Temperature, UV, sunset' },
                      { key: 'history', icon: '🏛️', label: 'Empowerment Park story', desc: '180 lights, community legacy' },
                      { key: 'call', icon: '📞', label: 'Call to book', desc: '(510) 288-0994' },
                    ].map((item) => (
                      <button key={item.key}
                        onClick={() => handleAction(item.key)}
                        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all border active:scale-[0.98] ${
                          playing === item.key ? 'bg-gold/15 border-gold/30' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-gold/20'
                        }`}>
                        <span className="text-lg">{item.icon}</span>
                        <div className="flex-1">
                          <div className="text-cream text-[12px] font-medium">{item.label}</div>
                          <div className="text-cream/40 text-[10px]">{item.desc}</div>
                        </div>
                        {playing === item.key && <VoiceVisualizer active={true} size="sm" />}
                      </button>
                    ))}
                  </div>

                  {/* Talk to Athena CTA */}
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex gap-2">
                      <button
                        onClick={startConversation}
                        className="flex-1 flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, #D4AF37, #B8962E)', color: '#1A1A2E', boxShadow: '0 4px 20px rgba(212,175,55,0.3)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <rect x="9" y="2" width="6" height="12" rx="3" fill="#1A1A2E" />
                          <path d="M5 10a7 7 0 0 0 14 0" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Talk
                      </button>
                      <button
                        onClick={() => {
                          setView('conversation')
                          setMessages([{ role: 'agent', text: 'Hi! I\'m Athena, Guardian of Innocence. ☂️ Ask me anything about zones, pricing, sunset spots, weather, or the Umbrella Project mission. What would you like to know?' }])
                        }}
                        className="flex-1 flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] border-2"
                        style={{ background: 'transparent', color: '#D4AF37', borderColor: 'rgba(212,175,55,0.4)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Text
                      </button>
                    </div>
                    <div className="text-center text-cream/30 text-[9px] mt-2">
                      Voice or text · Or call (510) 288-0994
                    </div>
                  </div>
                </div>
              )}

              {/* Conversation View */}
              {view === 'conversation' && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Voice Visualizer — large, centered when speaking */}
                  {conversation.isSpeaking && (
                    <div className="px-5 py-4 flex flex-col items-center gap-2 border-b border-white/10">
                      <VoiceVisualizer active={true} size="lg" />
                      <span className="text-gold/60 text-[10px] uppercase tracking-wider">Athena is speaking</span>
                    </div>
                  )}

                  {/* Connecting state */}
                  {connecting && (
                    <div className="px-5 py-8 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse"
                           style={{ background: 'rgba(212,175,55,0.15)', border: '2px solid rgba(212,175,55,0.3)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-gold">
                          <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                          <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M12 17v4M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <span className="text-cream/50 text-sm">Connecting to Athena...</span>
                      <span className="text-cream/30 text-[10px]">Microphone access required</span>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-gold/20 text-cream rounded-br-md'
                            : 'bg-white/5 text-cream/80 rounded-bl-md border border-white/5'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input area */}
                  <div className="px-4 py-3 border-t border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                      {/* Mic button — pulsing when connected */}
                      <button
                        onClick={() => {
                          if (conversation.status !== 'connected') startConversation()
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          conversation.status === 'connected' ? 'animate-pulse' : ''
                        }`}
                        style={{
                          background: conversation.status === 'connected' ? 'rgba(34,197,94,0.2)' : 'rgba(212,175,55,0.15)',
                          border: `2px solid ${conversation.status === 'connected' ? 'rgba(34,197,94,0.5)' : 'rgba(212,175,55,0.3)'}`,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                             className={conversation.status === 'connected' ? 'text-green-400' : 'text-gold'}>
                          <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                          <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>

                      {/* Text input */}
                      <div className="flex-1 flex items-center rounded-full bg-white/5 border border-white/10 px-3">
                        <input
                          type="text"
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && textInput.trim() && !chatLoading) {
                              sendTextMessage(textInput.trim())
                              setTextInput('')
                            }
                          }}
                          placeholder="Type a message..."
                          className="flex-1 bg-transparent text-cream text-[13px] py-2.5 outline-none placeholder:text-cream/20"
                        />
                        <button
                          onClick={() => {
                            if (textInput.trim() && !chatLoading) {
                              sendTextMessage(textInput.trim())
                              setTextInput('')
                            }
                          }}
                          className="text-gold/60 hover:text-gold p-1"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {micError && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-2">
                        <div className="text-amber-300 text-[10px] leading-tight">{micError}</div>
                      </div>
                    )}
                    {chatLoading && (
                      <div className="flex items-center gap-1.5 mt-1.5 px-1">
                        <div className="flex gap-1">
                          {[0,1,2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-gold/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                        <span className="text-cream/30 text-[9px]">Athena is thinking...</span>
                      </div>
                    )}
                    <div className="text-center text-cream/20 text-[8px] mt-1.5">
                      {conversation.status === 'connected' ? 'Listening... speak naturally · Or type below' : 'Type a message · Or tap mic for voice'}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
