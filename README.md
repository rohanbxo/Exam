---
title: Studyrag
emoji: 🏃   
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

# Studyson — RAG Document QA & Summarization

A full-stack Retrieval-Augmented Generation (RAG) app for document Q&A, conversational chat, and summarization. Built with FastAPI, LlamaIndex, Groq, and a persistent Chroma vector store, with a React + Vite frontend.

## Features

- **Multi-format ingestion** — PDF, DOCX, TXT, and Markdown files
- **Multi-file upload** — Drop several files at once; each tracks its own progress
- **Web scraping** — Index any HTML page (with timeout, size cap, and content-type guard)
- **Conversational chat** — Multi-turn Q&A with per-session memory
- **Persistent chat history** — Transcripts stored in SQLite; survives reloads and restarts
- **Document management** — List indexed documents and delete them individually
- **Persistent vector store** — Chroma on disk; index survives restarts
- **Smart summarization** — Length-controlled summaries across all indexed documents
- **Source citations** — Verifiable snippets with similarity scores
- **Real-time streaming** — Token-by-token Server-Sent Events, cancellable mid-answer
- **Dark mode** — Follows system preference, with a manual toggle
- **Markdown rendering** — Chat answers render with code blocks, lists, and headings

## Tech Stack

| Layer | Library |
|-------|---------|
| Web framework | FastAPI `>=0.118` |
| RAG orchestration | LlamaIndex `>=0.14` |
| LLM | Groq `openai/gpt-oss-120b` |
| Embeddings | HuggingFace `BAAI/bge-small-en-v1.5` |
| Vector store | Chroma `>=0.6` (persistent) |
| Chat history | SQLite (stdlib `sqlite3`) |
| Document parsing | PyMuPDF · pypdf · python-docx |
| HTTP client | httpx (async, with timeouts) |
| Frontend | React 19 + Vite + TypeScript |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/` | Web UI (React SPA) |
| `POST` | `/upload` | Upload PDF, DOCX, TXT, or MD |
| `POST` | `/scrape_and_index` | Scrape and index a URL |
| `DELETE` | `/documents/{name}` | Remove one indexed document |
| `POST` | `/stream_query` | SSE streaming Q&A (per-session chat memory) |
| `POST` | `/query` | One-shot Q&A with source citations |
| `POST` | `/summarize` | Summarize all indexed content |
| `POST` | `/reset` | Drop the document index (chat history is kept) |
| `GET`  | `/status` | System status, indexed docs, active model |
| `GET`  | `/sessions` | List chat sessions, most recent first |
| `GET`  | `/sessions/{id}/messages` | Full transcript for one session |
| `PATCH` | `/sessions/{id}` | Rename a session |
| `DELETE` | `/sessions/{id}` | Delete a session and its messages |

## Configuration

Set via HF Space secrets or a `.env` file locally:

| Variable | Default | Purpose |
|----------|---------|---------|
| `GROQ_API_KEY` | *(required)* | Groq API key |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq chat model |
| `EMBED_MODEL` | `BAAI/bge-small-en-v1.5` | Embedding model |
| `MAX_FILE_SIZE` | `20971520` (20 MB) | Upload size limit |
| `MAX_SCRAPE_BYTES` | `5242880` (5 MB) | Scrape body cap |
| `SIMILARITY_TOP_K` | `4` | Retrieval top-k |
| `HISTORY_DB_NAME` | `history.db` | SQLite file inside `chroma_store/` |

## Local Development

The frontend and backend run as two processes in development. Vite proxies API
calls to FastAPI, so the app uses same-origin relative paths in both dev and prod.

```bash
git clone <repo-url>
cd Exam
python -m venv .venv && source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env  # add your GROQ_API_KEY

# terminal 1 — backend
uvicorn app.main:app --reload --port 7860

# terminal 2 — frontend (http://localhost:5173)
cd frontend && npm install && npm run dev
```

To serve the built frontend directly from FastAPI (no Vite process), build it
into `static/` first:

```bash
cd frontend && npm run build && cp -r dist/* ../static/
```

> `static/` is a build artifact and is gitignored — it is always regenerated
> from `frontend/`, never edited by hand.

### Tests

```bash
pytest tests/ -v
```

Covers the document-delete and chat-history endpoints. These tests avoid the LLM
and embedding model entirely, so they need no network access or API key.

## Docker

```bash
docker compose up --build
```

The Dockerfile is a multi-stage build: a Node stage compiles the React app, and
the Python stage copies the output into `static/`. Volumes persist `uploads/`,
`chroma_store/` (which also holds `history.db`), and the HuggingFace model cache.

## Deploying on Hugging Face Spaces

1. Push this repo to GitHub
2. Go to [huggingface.co](https://huggingface.co) → your profile → **New Space**
3. Select **Docker** SDK, link your GitHub repo
4. Add `GROQ_API_KEY` under **Settings → Variables and secrets**
5. The Space auto-builds and serves on port 7860

> **Note:** The Chroma store, chat history, and uploads persist within the Space
> filesystem but are wiped on a factory reset.

## Performance Notes

- `/stream_query` retrieves citation sources with a **retrieval-only** call
  rather than a second full LLM generation, saving roughly 0.6s and one wasted
  LLM call per message.
- The embedding model is warmed at application startup (~6s), so the first user
  request no longer pays the model-load cost.

## Acknowledgments

- [LlamaIndex](https://www.llamaindex.ai/)
- [Groq](https://groq.com/)
- [Chroma](https://www.trychroma.com/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Vite](https://vite.dev/)
