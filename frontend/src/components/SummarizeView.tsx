import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { summarize } from '../api/client.ts'
import { useToast } from './shared/Toast.tsx'
import Loading from './shared/Loading.tsx'
import MarkdownRenderer from './shared/MarkdownRenderer.tsx'
import './summary.css'

interface SummaryResult {
  summary: string
  wordCount: number
  sourceDocuments: string[]
}

export default function SummarizeView() {
  const [maxLength, setMaxLength] = useState(500)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<SummaryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setIsSubmitting(true)
      setError(null)
      try {
        const res = await summarize({ max_length: maxLength })
        setResult({
          summary: res.summary,
          wordCount: res.word_count,
          sourceDocuments: res.source_documents,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Summarization failed'
        setError(message)
        showToast(message, 'error')
      } finally {
        setIsSubmitting(false)
      }
    },
    [maxLength, showToast],
  )

  return (
    <div className="view-container active">
      <div className="view-header">
        <h2 className="view-title">Document Summarization</h2>
        <p className="view-description">Generate comprehensive summaries of your indexed content</p>
      </div>

      <div className="content-card">
        <form className="summary-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="max-length">
              Summary Length
            </label>
            <div className="slider-container">
              <input
                type="range"
                id="max-length"
                className="range-slider"
                min={100}
                max={2000}
                step={100}
                value={maxLength}
                onChange={(e) => setMaxLength(Number(e.target.value))}
              />
              <div className="slider-value">
                <span>{maxLength}</span> words
              </div>
            </div>
          </div>
          <button type="submit" className="btn-primary btn-large" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loading />
                <span>Generating…</span>
              </>
            ) : (
              <>
                <span>Generate Summary</span>
                <span className="btn-arrow">✨</span>
              </>
            )}
          </button>
        </form>

        {error && <div className="result-message show error">{error}</div>}

        {result && (
          <div className="result-message show success summary-output">
            <h3>Summary ({result.wordCount} words)</h3>
            <MarkdownRenderer text={result.summary} />
            {result.sourceDocuments.length > 0 && (
              <p className="summary-sources">
                <strong>Sources:</strong> {result.sourceDocuments.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
