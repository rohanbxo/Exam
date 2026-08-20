import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { streamQuery } from '../api/client.ts'
import { useSession } from '../context/SessionContext.tsx'
import type { ChatMessage } from '../context/SessionContext.tsx'
import { useToast } from './shared/Toast.tsx'
import MarkdownRenderer from './shared/MarkdownRenderer.tsx'
import './chat.css'

function makeId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `m_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export default function ChatView() {
  const { sessionId, messages, loadHistory, appendMessage, updateLastMessage, isLoadingHistory } =
    useSession()
  const [question, setQuestion] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesAreaRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    const el = messagesAreaRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const trimmed = question.trim()
      if (!trimmed || isStreaming) return

      const userMessage: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: trimmed,
        sources: null,
        status: 'done',
        createdAt: new Date().toISOString(),
      }
      appendMessage(userMessage)
      setQuestion('')

      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: '',
        sources: null,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      appendMessage(assistantMessage)

      const controller = new AbortController()
      abortControllerRef.current = controller
      setIsStreaming(true)

      try {
        for await (const event of streamQuery(trimmed, sessionId, controller.signal)) {
          if (event.type === 'token') {
            updateLastMessage((msg) => ({
              ...msg,
              content: msg.content + event.token,
              status: 'streaming',
            }))
          } else if (event.type === 'final') {
            updateLastMessage((msg) => ({
              ...msg,
              content: event.answer,
              sources: event.sources,
              status: 'done',
            }))
          } else if (event.type === 'error') {
            updateLastMessage((msg) => ({
              ...msg,
              content: msg.content || `Error: ${event.error}`,
              status: 'error',
            }))
            showToast(event.error, 'error')
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          updateLastMessage((msg) => ({
            ...msg,
            status: 'done',
            content: msg.content || '(cancelled)',
          }))
        } else {
          const message = err instanceof Error ? err.message : 'Streaming failed'
          updateLastMessage((msg) => ({ ...msg, status: 'error', content: msg.content || `Error: ${message}` }))
          showToast(message, 'error')
        }
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [question, isStreaming, sessionId, appendMessage, updateLastMessage, showToast],
  )

  return (
    <div className="view-container active">
      <div className="view-header">
        <h2 className="view-title">Interactive Q&A</h2>
        <p className="view-description">Ask questions and get intelligent answers from your documents</p>
      </div>

      <div className="chat-container">
        <div className="messages-area" ref={messagesAreaRef}>
          {isLoadingHistory && messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⏳</div>
              <h3>Loading history…</h3>
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3>Start a Conversation</h3>
              <p>Ask me anything about your indexed documents</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div className={`message ${msg.role}`} key={msg.id}>
                <div className="message-bubble">
                  {msg.role === 'assistant' ? (
                    msg.content ? (
                      <MarkdownRenderer text={msg.content} className="message-content" />
                    ) : (
                      <div className="message-content typing-indicator">
                        <span />
                        <span />
                        <span />
                      </div>
                    )
                  ) : (
                    <div className="message-content">{msg.content}</div>
                  )}

                  {msg.role === 'assistant' && msg.status === 'streaming' && (
                    <div className="message-sources sources-loading">
                      <span className="loading-spinner dark" /> Sources loading…
                    </div>
                  )}

                  {msg.role === 'assistant' && msg.status === 'done' && msg.sources && msg.sources.length > 0 && (
                    <div className="message-sources">
                      <strong>Sources</strong>
                      {msg.sources.map((source, idx) => (
                        <div className="source-item" key={`${msg.id}-src-${idx}`}>
                          <strong>
                            {idx + 1}. {source.file_name}
                            {source.score != null ? ` (${source.score.toFixed(3)})` : ''}
                          </strong>
                          <p>{source.text}…</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <form className="chat-input-area" onSubmit={handleSubmit}>
          <div className="chat-input-wrapper">
            <input
              type="text"
              className="chat-input"
              placeholder="Type your question here..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isStreaming}
              required
            />
            {isStreaming ? (
              <button type="button" className="btn-send btn-cancel" onClick={handleCancel} title="Cancel">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                </svg>
              </button>
            ) : (
              <button type="submit" className="btn-send" title="Send">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
