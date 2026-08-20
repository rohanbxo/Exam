import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { scrapeAndIndex } from '../api/client.ts'
import { useSession } from '../context/SessionContext.tsx'
import { useToast } from './shared/Toast.tsx'
import Loading from './shared/Loading.tsx'
import './web.css'

interface WebImportViewProps {
  onIndexed: () => void
}

export default function WebImportView({ onIndexed }: WebImportViewProps) {
  const [url, setUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const { sessionId } = useSession()
  const { showToast } = useToast()

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!url.trim()) return

      setIsSubmitting(true)
      setResult(null)
      try {
        const res = await scrapeAndIndex({ url: url.trim(), session_id: sessionId })
        setResult({ message: res.message, type: 'success' })
        showToast(res.message, 'success')
        setUrl('')
        onIndexed()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Scraping failed'
        setResult({ message, type: 'error' })
        showToast(message, 'error')
      } finally {
        setIsSubmitting(false)
      }
    },
    [url, sessionId, showToast, onIndexed],
  )

  return (
    <div className="view-container active">
      <div className="view-header">
        <h2 className="view-title">Import from Web</h2>
        <p className="view-description">Extract and index content from any webpage</p>
      </div>

      <div className="content-card">
        <form className="web-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <span className="input-icon">🔗</span>
            <input
              type="url"
              className="input-field"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary btn-large" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loading />
                <span>Fetching…</span>
              </>
            ) : (
              <>
                <span>Fetch & Index Content</span>
                <span className="btn-arrow">→</span>
              </>
            )}
          </button>
        </form>
        {result && (
          <div className={`result-message show ${result.type}`}>{result.message}</div>
        )}
      </div>
    </div>
  )
}
