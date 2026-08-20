import { useCallback, useState } from 'react'
import { deleteDocument, resetDocuments } from '../api/client.ts'
import { useTheme } from '../context/ThemeContext.tsx'
import { useToast } from './shared/Toast.tsx'
import type { StatusDetails } from '../api/types.ts'
import type { ViewId } from '../App.tsx'
import './sidebar.css'

interface NavEntry {
  id: ViewId
  icon: string
  label: string
}

const NAV_ITEMS: NavEntry[] = [
  { id: 'upload', icon: '📁', label: 'Upload Files' },
  { id: 'web', icon: '🌍', label: 'Web Import' },
  { id: 'chat', icon: '💭', label: 'Q&A Chat' },
  { id: 'summary', icon: '📊', label: 'Summarize' },
]

interface SidebarProps {
  activeView: ViewId
  onViewChange: (view: ViewId) => void
  status: StatusDetails | null
  statusError: boolean
  onStatusRefresh: () => void
}

export default function Sidebar({
  activeView,
  onViewChange,
  status,
  statusError,
  onStatusRefresh,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const { showToast } = useToast()
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const docCount = status?.document_count ?? 0
  const hasDocuments = status?.has_documents ?? false
  const documents = status?.indexed_documents ?? []

  const pulseColor = statusError
    ? 'var(--danger)'
    : hasDocuments
      ? 'var(--success)'
      : 'var(--text-light)'
  const statusLabel = statusError ? 'Connection Error' : hasDocuments ? 'Ready' : 'No Docs'

  const handleDelete = useCallback(
    async (docName: string) => {
      setDeletingDoc(docName)
      try {
        const res = await deleteDocument(docName)
        showToast(res.message, 'success')
        onStatusRefresh()
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to delete document', 'error')
      } finally {
        setDeletingDoc(null)
      }
    },
    [showToast, onStatusRefresh],
  )

  const handleReset = useCallback(async () => {
    if (!window.confirm('Reset all documents? This cannot be undone.')) return
    setResetting(true)
    try {
      const res = await resetDocuments()
      showToast(res.message, 'success')
      onStatusRefresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reset failed', 'error')
    } finally {
      setResetting(false)
    }
  }, [showToast, onStatusRefresh])

  return (
    <aside className="sidebar">
      <div className="logo-section">
        <div className="logo-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="12" fill="url(#grad1)" />
            <path
              d="M12 14h16M12 20h16M12 26h10"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="grad1" x1="0" y1="0" x2="40" y2="40">
                <stop offset="0%" stopColor="#667eea" />
                <stop offset="100%" stopColor="#764ba2" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="logo-text">Studyson</h1>
      </div>

      <nav className="nav-menu">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item${activeView === item.id ? ' active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="doc-list-section">
        <div className="doc-list-header">
          <span>Indexed Documents</span>
          <span className="doc-list-count">{documents.length}</span>
        </div>
        {documents.length === 0 ? (
          <p className="doc-list-empty">No documents yet</p>
        ) : (
          <ul className="doc-list">
            {documents.map((doc) => (
              <li key={doc} className="doc-list-item">
                <span className="doc-list-name" title={doc}>
                  {doc}
                </span>
                <button
                  type="button"
                  className="doc-delete-btn"
                  onClick={() => handleDelete(doc)}
                  disabled={deletingDoc === doc}
                  aria-label={`Delete ${doc}`}
                  title={`Delete ${doc}`}
                >
                  {deletingDoc === doc ? '…' : '×'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="stats-card">
          <div className="stat-item">
            <span className="stat-label">Documents</span>
            <span className="stat-value">{docCount}</span>
          </div>
          <div className="stat-indicator">
            <div className="pulse-dot" style={{ background: pulseColor }} />
            <span>{statusLabel}</span>
          </div>
        </div>

        <button type="button" className="btn-theme-toggle" onClick={toggleTheme}>
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <button type="button" className="btn-reset" onClick={handleReset} disabled={resetting}>
          <span>🗑️</span>
          <span>{resetting ? 'Clearing…' : 'Clear All'}</span>
        </button>
      </div>
    </aside>
  )
}
