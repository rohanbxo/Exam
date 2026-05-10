---
title: Studyrag
emoji: 🏃
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

# Studyson — RAG Document QA & Summarization

A full-stack Retrieval-Augmented Generation (RAG) app for document Q&A, conversational chat, and summarization. Built with FastAPI, LlamaIndex, Groq, and a persistent Chroma vector store.

## Features

- **Multi-format ingestion** — PDF, DOCX, TXT, and Markdown files
- **Web scraping** — Index any HTML page (with timeout, size cap, and content-type guard)
- **Conversational chat** — Multi-turn Q&A with per-session memory
- **Persistent vector store** — Chroma on disk; index survives restarts
- **Smart summarization** — Length-controlled summaries across all indexed documents
- **Source citations** — Verifiable snippets with similarity scores
- **Real-time streaming** — Token-by-token Server-Sent Events
- **Markdown rendering** — Chat answers render with code blocks, lists, and headings

## Tech Stack

| Layer | Library |
|-------|---------|
| Web framework | FastAPI `>=0.118` |
| RAG orchestration | LlamaIndex `>=0.14` |
| LLM | Groq `llama-3.3-70b-versatile` |
| Embeddings | FastEmbed `BAAI/bge-small-en-v1.5` |
| Vector store | Chroma `>=0.6` (persistent) |
| Document parsing | PyMuPDF · pypdf · python-docx |
| HTTP client | httpx (async, with timeouts) |
| Frontend | Vanilla JS + marked + DOMPurify |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/` | Web UI |
| `POST` | `/upload` | Upload PDF, DOCX, TXT, or MD |
| `POST` | `/scrape_and_index` | Scrape and index a URL |
| `POST` | `/stream_query` | SSE streaming Q&A (per-session chat memory) |
| `POST` | `/query` | One-shot Q&A with source citations |
| `POST` | `/summarize` | Summarize all indexed content |
| `POST` | `/reset` | Drop the index and clear all sessions |
| `GET`  | `/status` | System status, indexed docs, active model |

## Configuration

Set via HF Space secrets or a `.env` file locally:

| Variable | Default | Purpose |
|----------|---------|---------|
| `GROQ_API_KEY` | *(required)* | Groq API key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq chat model |
| `EMBED_MODEL` | `BAAI/bge-small-en-v1.5` | Embedding model |
| `MAX_FILE_SIZE` | `20971520` (20 MB) | Upload size limit |
| `MAX_SCRAPE_BYTES` | `5242880` (5 MB) | Scrape body cap |
| `SIMILARITY_TOP_K` | `4` | Retrieval top-k |

## Local Development

```bash
git clone <repo-url>
cd studyrag
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # add your GROQ_API_KEY
uvicorn app.main:app --reload --port 7860
```

## Docker

```bash
docker compose up --build
```

Volumes persist `uploads/`, `chroma_store/`, and the FastEmbed model cache across restarts.

## Deploying on Hugging Face Spaces

1. Push this repo to GitHub
2. Go to [huggingface.co](https://huggingface.co) → your profile → **New Space**
3. Select **Docker** SDK, link your GitHub repo
4. Add `GROQ_API_KEY` under **Settings → Variables and secrets**
5. The Space auto-builds and serves on port 7860

> **Note:** The Chroma store and uploads persist within the Space filesystem but are wiped on a factory reset.

## Acknowledgments

- [LlamaIndex](https://www.llamaindex.ai/)
- [Groq](https://groq.com/)
- [Chroma](https://www.trychroma.com/)
- [FastEmbed](https://github.com/qdrant/fastembed)
- [FastAPI](https://fastapi.tiangolo.com/)
