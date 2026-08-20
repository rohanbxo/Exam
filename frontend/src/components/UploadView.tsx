import { useCallback, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { uploadFile } from '../api/client.ts'
import { useToast } from './shared/Toast.tsx'
import Loading from './shared/Loading.tsx'
import './upload.css'

type FileStatus = 'pending' | 'uploading' | 'success' | 'error'

interface UploadItem {
  id: string
  file: File
  status: FileStatus
  message?: string
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md']
const CONCURRENCY = 2

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
}

function makeId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `f_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

interface UploadViewProps {
  onIndexed: () => void
}

export default function UploadView({ onIndexed }: UploadViewProps) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return
    setItems((prev) => [
      ...prev,
      ...list.map((file) => ({ id: makeId(), file, status: 'pending' as FileStatus })),
    ])
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files)
      e.target.value = ''
    },
    [addFiles],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer?.files?.length) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const uploadOne = useCallback(async (item: UploadItem) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: 'uploading' } : it)),
    )
    try {
      const res = await uploadFile(item.file)
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: 'success', message: res.message } : it,
        ),
      )
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'error', message } : it)),
      )
      return false
    }
  }, [])

  const handleUploadAll = useCallback(async () => {
    const pending = items.filter((it) => it.status === 'pending' || it.status === 'error')
    if (pending.length === 0) {
      showToast('No files to upload', 'error')
      return
    }

    setIsUploading(true)
    let successCount = 0
    let queueIndex = 0

    async function worker() {
      while (queueIndex < pending.length) {
        const item = pending[queueIndex]
        queueIndex += 1
        if (!item) continue
        const ok = await uploadOne(item)
        if (ok) successCount += 1
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker())
    await Promise.all(workers)

    setIsUploading(false)

    if (successCount > 0) {
      showToast(`${successCount} file(s) uploaded and indexed`, 'success')
      onIndexed()
    }
    if (successCount < pending.length) {
      showToast(`${pending.length - successCount} file(s) failed to upload`, 'error')
    }
  }, [items, uploadOne, showToast, onIndexed])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((it) => it.status !== 'success'))
  }, [])

  const statusIcon: Record<FileStatus, string> = {
    pending: '⏳',
    uploading: '⬆️',
    success: '✅',
    error: '❌',
  }

  return (
    <div className="view-container active">
      <div className="view-header">
        <h2 className="view-title">Upload Documents</h2>
        <p className="view-description">
          Import PDF, DOCX, TXT, or Markdown files to build a searchable knowledge base
        </p>
      </div>

      <div className="content-card">
        <div className="upload-area">
          <input
            ref={fileInputRef}
            type="file"
            id="file-input"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            multiple
            hidden
            onChange={handleInputChange}
          />
          <label
            htmlFor="file-input"
            className={`drop-zone${isDragging ? ' dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="drop-zone-icon">📄</div>
            <h3 className="drop-zone-title">
              {items.length > 0 ? 'Add more files' : 'Drop your files here'}
            </h3>
            <p className="drop-zone-desc">PDF, DOCX, TXT, or Markdown — click to browse (multiple allowed)</p>
          </label>

          {items.length > 0 && (
            <div className="file-list">
              {items.map((item) => (
                <div className="file-info" key={item.id}>
                  <span className="file-icon">📎</span>
                  <span className="file-name-display">{item.file.name}</span>
                  <span className="file-size">{formatFileSize(item.file.size)}</span>
                  <span className={`file-status file-status-${item.status}`}>
                    {statusIcon[item.status]}{' '}
                    {item.status === 'uploading'
                      ? 'Uploading…'
                      : item.status === 'error'
                        ? item.message ?? 'Failed'
                        : item.status === 'success'
                          ? 'Indexed'
                          : 'Pending'}
                  </span>
                  {item.status !== 'uploading' && (
                    <button
                      type="button"
                      className="file-remove-btn"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="upload-actions">
            <button
              type="button"
              className="btn-primary btn-large"
              onClick={handleUploadAll}
              disabled={isUploading || items.every((it) => it.status === 'success')}
            >
              {isUploading ? (
                <>
                  <Loading />
                  <span>Uploading…</span>
                </>
              ) : (
                <>
                  <span>Upload & Index {items.length > 0 ? `(${items.length})` : ''}</span>
                  <span className="btn-arrow">→</span>
                </>
              )}
            </button>
            {items.some((it) => it.status === 'success') && (
              <button type="button" className="btn-secondary" onClick={clearFinished}>
                Clear finished
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
