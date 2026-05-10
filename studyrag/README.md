---
title: Studyson
emoji: 📚
colorFrom: purple
colorTo: blue
sdk: docker
pinned: false
---

# Studyson — RAG Document QA & Summarization

A full-stack Retrieval-Augmented Generation (RAG) app for document Q&A, conversational chat, and summarization. Built with FastAPI, LlamaIndex, Groq, and a persistent Chroma vector store.

## Features

- **Multi-format ingestion** — PDF, DOCX, TXT, and Markdown files
- **Web scraping** — Index any HTML page (with timeout, size cap, and content-type guard)
- **Conversational chat** — Multi-turn Q&A via LlamaIndex `condense_plus_context` chat engine, with **per-session memory**
- **Persistent vector store** — Chroma on disk; index survives restarts
- **Smart summarization** — Length-controlled summaries across all indexed documents
- **Source citations** — Verifiable snippets with similarity scores
- **Real-time streaming** — Token-by-token Server-Sent Events
- **Markdown rendering** — Chat answers render with code blocks, lists, and headings
- **Docker-first** — Healthchecks, persistent volumes, and HF Spaces ready

## Tech Stack

### Backend
- **FastAPI** `>=0.118` — Web framework with `lifespan` startup
- **LlamaIndex** `>=0.14` — RAG orchestration, chat engine, retrieval
- **Groq** — `llama-3.3-70b-versatile` LLM (configurable)
- **FastEmbed** — `BAAI/bge-small-en-v1.5` embeddings (low memory)
- **Chroma** `>=0.6` — Persistent vector store
- **PyMuPDF / pypdf / python-docx** — Document extraction
- **httpx** — Async HTTP with timeouts and streaming
- **BeautifulSoup4** — HTML cleaning
- **Pydantic v2** — Validated request/response models

### Frontend
- Vanilla HTML / CSS / JS
- `marked` + `DOMPurify` for safe markdown rendering
- Server-Sent Events for streaming
- LocalStorage-backed session IDs

## Architecture

```
┌────────┐   upload/scrape   ┌─────────────────┐   embed   ┌────────────────┐
│ Client │ ───────────────►  │  DocumentProcessor│──────────►│ Chroma (disk)  │
└────────┘                   └─────────────────┘           └────────────────┘
     │                                                              │
     │ POST /stream_query (SSE, session_id)                         │
     ▼                                                              ▼
┌──────────────┐  retrieve top-k  ┌──────────────────────────────────┐
│  RAGService  │ ───────────────► │ LlamaIndex VectorStoreIndex      │
│ (chat cache) │ ◄─────── Groq ── │ + condense_plus_context engine   │
└──────────────┘                  └──────────────────────────────────┘
```

- Each browser stores a `session_id` in `localStorage`; server keeps a chat engine per session
- Chroma persists embeddings to `chroma_store/`; restart-safe
- `/reset` deletes the collection and clears all sessions

## Installation

### Prerequisites
- Python 3.12+ (Docker uses 3.12-slim)
- Groq API key — [free at console.groq.com](https://console.groq.com)

### Local

```bash
git clone <repository-url>
cd studyrag

python -m venv venv
# Windows: venv\Scripts\activate
source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
# edit .env and set GROQ_API_KEY

uvicorn app.main:app --reload --port 7860
```

Open `http://localhost:7860`.

### Docker

```bash
cp .env.example .env
docker compose up --build
```

Volumes persist `uploads/`, `chroma_store/`, and the FastEmbed model cache.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/`                | Web UI |
| `POST` | `/upload`          | Upload PDF/DOCX/TXT/MD |
| `POST` | `/scrape_and_index`| Scrape and index a URL |
| `POST` | `/stream_query`    | SSE streaming Q&A (per session, with chat memory) |
| `POST` | `/query`           | One-shot Q&A with source citations |
| `POST` | `/summarize`       | Summarize all indexed content |
| `POST` | `/reset`           | Drop the Chroma collection and all sessions |
| `GET`  | `/status`          | System status, indexed docs, active model |

`POST /stream_query` and `/scrape_and_index` accept an optional `session_id`; if omitted, the server generates one and returns it as the first SSE event.

## Configuration

All settings can be set via env vars or `.env` (see `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `GROQ_API_KEY` | *(required)* | Groq API key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq chat model |
| `EMBED_MODEL` | `BAAI/bge-small-en-v1.5` | FastEmbed embedding model |
| `HOST` / `PORT` | `0.0.0.0` / `7860` | Bind address |
| `UPLOAD_DIR` | `uploads` | Where uploaded files are stored |
| `CHROMA_DIR` | `chroma_store` | Persistent vector store path |
| `MAX_FILE_SIZE` | `20971520` (20 MB) | Upload limit |
| `MAX_SCRAPE_BYTES` | `5242880` (5 MB) | Scrape body cap |
| `SCRAPE_TIMEOUT_SECONDS` | `15` | Scrape HTTP timeout |
| `SIMILARITY_TOP_K` | `4` | Retrieval top-k |

## Project Structure

```
studyrag/
├── app/
│   ├── main.py                    # FastAPI app, routes, lifespan
│   ├── config.py                  # Pydantic settings
│   ├── models/schemas.py          # Request/response models
│   ├── services/rag_service.py    # Chroma-backed RAG, per-session chat
│   └── utils/document_processor.py # Multi-format extraction + scraper
├── static/                        # UI (HTML/CSS/JS)
├── Dockerfile                     # Python 3.12-slim, healthcheck
├── docker-compose.yml             # Volumes + healthcheck
├── requirements.txt
├── .env.example
└── README.md
```

## Deployment to Hugging Face Spaces

1. Push the repo to GitHub
2. New Space → SDK: **Docker** → Hardware: CPU basic
3. Link your repo (or upload files)
4. Add `GROQ_API_KEY` under **Settings → Variables and secrets**
5. Spaces auto-builds and serves on port 7860

Note: HF Spaces filesystem persists across restarts within a Space, but is wiped on factory reset.

## Limitations

- Single-instance deployment (Chroma persistent client; no horizontal scaling out of the box)
- No authentication — anyone with the URL can query and reset
- Chat memory is in-process; restarting the server clears active chat histories (the index itself persists)
- FastEmbed downloads its model on first run (~80 MB); cached afterward

## Troubleshooting

**`pip install` fails on chromadb / fastembed**
Make sure you have a C/C++ toolchain (`build-essential` on Linux, MSVC on Windows). The Docker build handles this automatically.

**Groq 401**
Check `GROQ_API_KEY` in `.env`. Rotate at [console.groq.com](https://console.groq.com).

**Slow first query**
First call loads the embedding model and warms Chroma. Subsequent queries are fast.

**Reset didn't clear**
`/reset` drops the Chroma collection and clears `uploads/`. If you also want to remove the FastEmbed cache, delete the `fastembed_cache` Docker volume.

## License

MIT.

## Acknowledgments

- [LlamaIndex](https://www.llamaindex.ai/)
- [Groq](https://groq.com/)
- [Chroma](https://www.trychroma.com/)
- [FastEmbed](https://github.com/qdrant/fastembed)
- [FastAPI](https://fastapi.tiangolo.com/)
