// Types mirroring the Studyson backend API contract.

export interface SourceInfo {
  file_name: string
  text: string
  score: number | null
}

export interface UploadDetails {
  filename: string
  text_length: number
  indexed_documents: string[]
}

export interface UploadResponse {
  status: string
  message: string
  details: UploadDetails
}

export interface ScrapeAndIndexRequest {
  url: string
  session_id?: string
}

export interface ScrapeDetails {
  url: string
  title: string
  text_length: number
  indexed_documents: string[]
}

export interface ScrapeAndIndexResponse {
  status: string
  message: string
  details: ScrapeDetails
}

export interface DeleteDocumentResponse {
  status: string
  message: string
  deleted: string
  indexed_documents: string[]
}

export interface StreamQueryRequest {
  question: string
  session_id?: string
}

export interface QueryRequest {
  question: string
  session_id?: string
}

export interface QueryResponse {
  final_answer: string
  sources: SourceInfo[]
}

export interface SummarizeRequest {
  max_length: number
  style?: string
}

export interface SummarizeResponse {
  summary: string
  word_count: number
  source_documents: string[]
}

export interface ResetResponse {
  status: string
  message: string
}

export interface StatusDetails {
  model: string
  has_documents: boolean
  indexed_documents: string[]
  document_count: number
}

export interface StatusResponse {
  status: string
  message: string
  details: StatusDetails
}

export interface SessionSummary {
  session_id: string
  title: string | null
  created_at: string
  updated_at: string
  message_count: number
}

export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  sources: SourceInfo[] | null
  created_at: string
}

export interface SessionMessagesResponse {
  session_id: string
  messages: SessionMessage[]
}

export interface RenameSessionRequest {
  title: string
}

export interface ApiErrorBody {
  detail: string
}

// Discriminated union of parsed SSE frames from /stream_query.
export type StreamEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'token'; token: string }
  | { type: 'final'; answer: string; sources: SourceInfo[] }
  | { type: 'error'; error: string }
