import type {
  UploadResponse,
  ScrapeAndIndexRequest,
  ScrapeAndIndexResponse,
  DeleteDocumentResponse,
  StreamQueryRequest,
  QueryRequest,
  QueryResponse,
  SummarizeRequest,
  SummarizeResponse,
  ResetResponse,
  StatusResponse,
  SessionSummary,
  SessionMessagesResponse,
  RenameSessionRequest,
  ApiErrorBody,
  StreamEvent,
} from './types.ts'

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody
    if (body && typeof body.detail === 'string') {
      return body.detail
    }
  } catch {
    // fall through
  }
  return `Request failed with status ${response.status}`
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response))
  }
  return (await response.json()) as T
}

function jsonInit(body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }
}

export async function uploadFile(file: File, signal?: AbortSignal): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return requestJson<UploadResponse>('/upload', { method: 'POST', body: formData, signal })
}

export async function scrapeAndIndex(
  req: ScrapeAndIndexRequest,
  signal?: AbortSignal,
): Promise<ScrapeAndIndexResponse> {
  return requestJson<ScrapeAndIndexResponse>('/scrape_and_index', jsonInit(req, signal))
}

export async function deleteDocument(documentName: string): Promise<DeleteDocumentResponse> {
  return requestJson<DeleteDocumentResponse>(
    `/documents/${encodeURIComponent(documentName)}`,
    { method: 'DELETE' },
  )
}

export async function query(req: QueryRequest, signal?: AbortSignal): Promise<QueryResponse> {
  return requestJson<QueryResponse>('/query', jsonInit(req, signal))
}

export async function summarize(
  req: SummarizeRequest,
  signal?: AbortSignal,
): Promise<SummarizeResponse> {
  return requestJson<SummarizeResponse>('/summarize', jsonInit(req, signal))
}

export async function resetDocuments(): Promise<ResetResponse> {
  return requestJson<ResetResponse>('/reset', { method: 'POST' })
}

export async function getStatus(signal?: AbortSignal): Promise<StatusResponse> {
  return requestJson<StatusResponse>('/status', { signal })
}

export async function listSessions(signal?: AbortSignal): Promise<SessionSummary[]> {
  return requestJson<SessionSummary[]>('/sessions', { signal })
}

export async function getSessionMessages(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionMessagesResponse> {
  return requestJson<SessionMessagesResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/messages`,
    { signal },
  )
}

export async function renameSession(
  sessionId: string,
  req: RenameSessionRequest,
): Promise<ResetResponse> {
  return requestJson<ResetResponse>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function deleteSession(sessionId: string): Promise<ResetResponse> {
  return requestJson<ResetResponse>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
}

/**
 * Streams /stream_query as an async generator of parsed SSE frames.
 * Consumes the response body manually via a reader (not EventSource, since
 * this is a POST request).
 */
export async function* streamQuery(
  question: string,
  sessionId?: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const body: StreamQueryRequest = { question, session_id: sessionId }

  const response = await fetch('/stream_query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok || !response.body) {
    const detail = await parseErrorDetail(response)
    yield { type: 'error', error: detail }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue

        let parsed: unknown
        try {
          parsed = JSON.parse(data)
        } catch {
          continue
        }

        if (parsed && typeof parsed === 'object') {
          const obj = parsed as Record<string, unknown>
          if (typeof obj.session_id === 'string') {
            yield { type: 'session', sessionId: obj.session_id }
          } else if (typeof obj.token === 'string') {
            yield { type: 'token', token: obj.token }
          } else if (typeof obj.final_answer === 'string') {
            yield {
              type: 'final',
              answer: obj.final_answer,
              sources: Array.isArray(obj.sources) ? (obj.sources as QueryResponse['sources']) : [],
            }
          } else if (typeof obj.error === 'string') {
            yield { type: 'error', error: obj.error }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
