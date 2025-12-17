# Studyson - RAG Document QA & Summarization API

A full-stack Retrieval-Augmented Generation (RAG) system for intelligent document question-answering and summarization. Built with FastAPI, LlamaIndex, and Groq AI.

## Features

- **📄 PDF Document Processing**: Upload and index PDF documents with intelligent text extraction
- **🌐 Web Content Scraping**: Scrape and index content from URLs
- **💬 Interactive Q&A Chat**: Ask questions about your documents with streaming responses
- **📝 Smart Summarization**: Generate concise summaries of indexed documents
- **🔍 Source Citations**: Get verifiable citations with exact source snippets
- **⚡ Real-time Streaming**: Token-by-token streaming for responsive user experience
- **🎨 Modern UI**: Clean, responsive web interface with tabbed navigation
- **🐳 Docker Support**: Easy deployment with Docker and Docker Compose

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **LlamaIndex**: RAG orchestration and document indexing
- **Groq**: Lightning-fast LLM inference (Llama 3.1)
- **FastEmbed**: Lightweight embed]



Backend    FastAPI + LlamaIndex + Groq LLM + FastEmbed
Frontend    HTML/CSS/JS with 4 views (Upload, Web Import, Chat, Summary)
Features    PDF upload, URL scraping, streaming Q&A, summarization)dings (BGE-small)
- **PyMuPDF**: Advanced PDF text extraction
- **BeautifulSoup**: HTML parsing and web scraping
- **Pydantic**: Data validation and settings management

### Frontend
- **HTML5/CSS3/JavaScript**: Vanilla web technologies
- **Server-Sent Events (SSE)**: Real-time streaming responses

## Architecture

### Ingestion Pipeline
1. User uploads PDF or provides URL
2. Content extraction (PyMuPDF for PDFs, BeautifulSoup for web)
3. Text chunking and embedding via LlamaIndex + FastEmbed
4. In-memory vector index creation

### Query Pipeline
1. Question embedding generation
2. Semantic similarity search for relevant chunks
3. Context + question sent to Groq LLM
4. Streaming response with source citations

## Installation

### Prerequisites
- Python 3.10 or higher
- Groq API key ([Get it free here](https://console.groq.com))

### Local Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd studyrag
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your Groq API key:
```
GROQ_API_KEY=your_groq_api_key_here
PORT=7860
HOST=0.0.0.0
```

5. **Run the application**
```bash
uvicorn app.main:app --reload --port 7860
```

6. **Access the application**

Open your browser and navigate to: `http://localhost:7860`

### Docker Setup

1. **Set environment variables**
```bash
cp .env.example .env
# Edit .env with your Groq API key
```

2. **Build and run with Docker Compose**
```bash
docker-compose up --build
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serves the web UI |
| POST | `/upload` | Upload PDF document |
| POST | `/scrape` | Scrape URL content |
| POST | `/stream_query` | Stream Q&A response |
| POST | `/query` | Get Q&A response |
| POST | `/summarize` | Generate summary |
| POST | `/reset` | Clear all documents |
| GET | `/status` | Get system status |

## Project Structure

```
studyrag/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration settings
│   ├── models/
│   │   └── schemas.py       # Pydantic models
│   ├── services/
│   │   └── rag_service.py   # RAG logic
│   └── utils/
│       └── document_processor.py
├── static/
│   ├── css/style.css
│   ├── js/app.js
│   └── index.html
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── Procfile
├── requirements.txt
└── README.md
```

## Configuration

### Environment Variables

- `GROQ_API_KEY`: Your Groq API key (required, free tier available)
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 7860)

### Application Settings

Edit `app/config.py` to modify:
- `upload_dir`: Upload directory path
- `max_file_size`: Maximum file size (default: 10MB)

## Deployment

### Deploy to Hugging Face Spaces (Recommended - Free)

1. Push code to GitHub
2. Go to [huggingface.co](https://huggingface.co) and create an account
3. Click your profile → **New Space**
4. Configure:
   - **Space name**: `studyson`
   - **SDK**: Select **Docker**
   - **Hardware**: CPU basic (free)
5. Under **Files** → Link to GitHub repo (or upload files)
6. Add secret: `GROQ_API_KEY` in Space Settings → Variables
7. The Space will auto-build and deploy!

**Your app will be live at:** `https://huggingface.co/spaces/YOUR_USERNAME/studyson`

## Features in Detail

### RAG Pipeline
- **Chunking**: Intelligent text splitting for optimal context windows
- **Embeddings**: FastEmbed BGE-small for semantic understanding (lightweight)
- **Retrieval**: Top-k similarity search with configurable parameters
- **Generation**: Groq Llama 3.1 for fast, accurate responses

### Streaming
- Server-Sent Events (SSE) for real-time token delivery
- Progressive rendering in the UI
- Graceful error handling

### Source Attribution
- Exact text snippets from source documents
- Similarity scores for transparency
- Multiple source support per answer

## Limitations

- In-memory vector storage (resets on restart)
- PDF-only document support (extensible to other formats)
- Single-user session management
- No authentication/authorization

## Troubleshooting

### Common Issues

**Import errors:**
```bash
pip install --upgrade -r requirements.txt
```

**API key errors:**
- Verify your `.env` file has the correct `GROQ_API_KEY`
- Check API key validity at [console.groq.com](https://console.groq.com)

**Port already in use:**
```bash
uvicorn app.main:app --port 8000
```

**File upload fails:**
- Check file size is under 10MB

## License

MIT License - feel free to use this project for learning and development.

## Acknowledgments

- [LlamaIndex](https://www.llamaindex.ai/) for RAG orchestration
- [Groq](https://groq.com/) for lightning-fast LLM inference
- [FastEmbed](https://github.com/qdrant/fastembed) for lightweight embeddings
- [FastAPI](https://fastapi.tiangolo.com/) for the web framework

---

Built with ❤️ using RAG technology
