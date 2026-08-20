import { useCallback, useEffect, useState } from 'react'
import { getStatus } from './api/client.ts'
import type { StatusDetails } from './api/types.ts'
import Sidebar from './components/Sidebar.tsx'
import UploadView from './components/UploadView.tsx'
import WebImportView from './components/WebImportView.tsx'
import ChatView from './components/ChatView.tsx'
import SummarizeView from './components/SummarizeView.tsx'

export type ViewId = 'upload' | 'web' | 'chat' | 'summary'

const VIEW_NAMES: Record<ViewId, string> = {
  upload: 'Upload Files',
  web: 'Web Import',
  chat: 'Q&A Chat',
  summary: 'Summarize',
}

const STATUS_POLL_INTERVAL_MS = 30000

function App() {
  const [activeView, setActiveView] = useState<ViewId>('upload')
  const [status, setStatus] = useState<StatusDetails | null>(null)
  const [statusError, setStatusError] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      const res = await getStatus()
      setStatus(res.details)
      setStatusError(false)
    } catch {
      setStatusError(true)
    }
  }, [])

  useEffect(() => {
    refreshStatus()
    const interval = setInterval(refreshStatus, STATUS_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refreshStatus])

  const hasDocuments = status?.has_documents ?? false
  const topStatusText = statusError
    ? 'Connection Error'
    : hasDocuments
      ? `Ready · ${status?.model ?? ''}`
      : 'No Documents'
  const topStatusColor = statusError ? 'var(--danger)' : hasDocuments ? 'var(--success)' : 'var(--text-light)'

  return (
    <div className="app-layout">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        status={status}
        statusError={statusError}
        onStatusRefresh={refreshStatus}
      />

      <main className="main-content">
        <div className="topbar">
          <div className="breadcrumb">
            <span className="breadcrumb-item">{VIEW_NAMES[activeView]}</span>
          </div>
          <div className="topbar-actions">
            <div className="status-badge">
              <span className="status-dot" style={{ background: topStatusColor }} />
              <span>{topStatusText}</span>
            </div>
          </div>
        </div>

        {activeView === 'upload' && <UploadView onIndexed={refreshStatus} />}
        {activeView === 'web' && <WebImportView onIndexed={refreshStatus} />}
        {activeView === 'chat' && <ChatView />}
        {activeView === 'summary' && <SummarizeView />}
      </main>
    </div>
  )
}

export default App
