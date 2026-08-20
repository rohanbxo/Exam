import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getSessionMessages } from '../api/client.ts'
import type { SourceInfo } from '../api/types.ts'

export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: SourceInfo[] | null
  status: MessageStatus
  createdAt: string
}

interface SessionContextValue {
  sessionId: string
  messages: ChatMessage[]
  isLoadingHistory: boolean
  loadHistory: () => Promise<void>
  appendMessage: (message: ChatMessage) => void
  updateLastMessage: (updater: (message: ChatMessage) => ChatMessage) => void
  switchSession: (newSessionId: string) => void
  setMessages: (messages: ChatMessage[]) => void
}

const SESSION_KEY = 'studyson:session_id'

const SessionContext = createContext<SessionContextValue | undefined>(undefined)

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function makeMessageId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `m_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string>(getOrCreateSessionId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const currentId = localStorage.getItem(SESSION_KEY) ?? sessionId
      const res = await getSessionMessages(currentId)
      const hydrated: ChatMessage[] = res.messages.map((m) => ({
        id: makeMessageId(),
        role: m.role,
        content: m.content,
        sources: m.sources,
        status: 'done',
        createdAt: m.created_at,
      }))
      setMessages(hydrated)
    } catch {
      // Leave messages as-is on failure; UI surfaces errors via toast at call sites.
    } finally {
      setIsLoadingHistory(false)
    }
  }, [sessionId])

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const updateLastMessage = useCallback((updater: (message: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev
      const next = prev.slice()
      const last = next[next.length - 1]
      if (!last) return prev
      next[next.length - 1] = updater(last)
      return next
    })
  }, [])

  const switchSession = useCallback((newSessionId: string) => {
    localStorage.setItem(SESSION_KEY, newSessionId)
    setSessionId(newSessionId)
    setMessages([])
  }, [])

  const value = useMemo(
    () => ({
      sessionId,
      messages,
      isLoadingHistory,
      loadHistory,
      appendMessage,
      updateLastMessage,
      switchSession,
      setMessages,
    }),
    [sessionId, messages, isLoadingHistory, loadHistory, appendMessage, updateLastMessage, switchSession],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return ctx
}
