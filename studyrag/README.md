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
- **Google Gemini**: LLM (flash-latest) and embeddings (embedding-001)
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
3. Text chunking and embedding via LlamaIndex + Gemini
4. In-memory vector index creation

### Query Pipeline
1. Question embedding generation
2. Semantic similarity search for relevant chunks
3. Context + question sent to Gemini LLM
4. Streaming response with source citations

## Installation

### Prerequisites
- Python 3.10 or higher
- Google Gemini API key ([Get it here](https://makersuite.google.com/app/apikey))

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

Edit `.env` and add your Google API key:
```
GOOGLE_API_KEY=your_google_gemini_api_key_here
PORT=8000
HOST=0.0.0.0
```

5. **Run the application**
```bash
python -m uvicorn app.main:app --reload
```

6. **Access the application**

Open your browser and navigate to: `http://localhost:8000`

### Docker Setup

1. **Set environment variables**
```bash
cp .env.example .env
# Edit .env with your Google API key
```

2. **Build and run with Docker Compose**
```bash
docker-compose up --build
```

3. **Access the application**

Open your browser and navigate to: `http://localhost:8000`

## API Endpoints

### Document Management

#### Upload PDF
```http
POST /upload
Content-Type: multipart/form-data

file: <PDF file>
```

#### Scrape URL
```http
POST /scrape_and_index
Content-Type: application/json

{
  "url": "https://example.com/article"
}
```

#### Reset Index
```http
POST /reset
```

### Query & Analysis

#### Stream Query
```http
POST /stream_query
Content-Type: application/json

{
  "question": "What is the main topic?"
}
```

#### Query (Non-streaming)
```http
POST /query
Content-Type: application/json

{
  "question": "What is the main topic?"
}
```

#### Summarize
```http
POST /summarize
Content-Type: application/json

{
  "max_length": 500,
  "style": "concise"
}
```

### Status

#### Get Status
```http
GET /status
```

## Usage

### 1. Upload Documents

**Via PDF Upload:**
- Navigate to the "Upload" tab
- Select a PDF file
- Click "Upload & Index"

**Via Web Scraping:**
- Navigate to the "Web Scrape" tab
- Enter a URL
- Click "Scrape & Index"

### 2. Ask Questions

- Navigate to the "Chat" tab
- Type your question in the input field
- Press Enter or click "Send"
- Watch the response stream in real-time
- View source citations below the answer

### 3. Generate Summaries

- Navigate to the "Summarize" tab
- Adjust the maximum word count
- Click "Generate Summary"
- View the comprehensive summary with sources

### 4. Reset Documents

- Click the "Reset All Documents" button at the bottom
- Confirm the action to clear all indexed documents

## Project Structure

```
studyrag/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration settings
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py       # Pydantic models
│   ├── services/
│   │   ├── __init__.py
│   │   └── rag_service.py   # RAG logic with LlamaIndex
│   └── utils/
│       ├── __init__.py
│       └── document_processor.py  # PDF & web scraping
├── static/
│   ├── css/
│   │   └── style.css        # Styling
│   ├── js/
│   │   └── app.js           # Frontend logic
│   └── index.html           # Main UI
├── uploads/                 # Uploaded files storage
├── .env.example             # Environment variables template
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## Configuration

### Environment Variables

- `GOOGLE_API_KEY`: Your Google Gemini API key (required)
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)

### Application Settings

Edit `app/config.py` to modify:
- `upload_dir`: Upload directory path
- `max_file_size`: Maximum file size (default: 10MB)

## Development

### Running Tests
```bash
pytest
```

### Code Formatting
```bash
black app/
```

### Linting
```bash
flake8 app/
```

## Features in Detail

### RAG Pipeline
- **Chunking**: Intelligent text splitting for optimal context windows
- **Embeddings**: Google Gemini embedding-001 for semantic understanding
- **Retrieval**: Top-k similarity search with configurable parameters
- **Generation**: Gemini 1.5 Flash for fast, accurate responses

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

## Future Enhancements

- [ ] Persistent vector storage (ChromaDB, Pinecone)
- [ ] Multi-format support (DOCX, TXT, Markdown)
- [ ] User authentication and session management
- [ ] Document management (view, delete specific docs)
- [ ] Advanced filtering and search
- [ ] Export chat history
- [ ] Multi-language support
- [ ] Voice input/output

## Troubleshooting

### Common Issues

**Import errors:**
```bash
pip install --upgrade -r requirements.txt
```

**API key errors:**
- Verify your `.env` file has the correct `GOOGLE_API_KEY`
- Check API key validity at Google AI Studio

**Port already in use:**
```bash
# Change PORT in .env or run with custom port
uvicorn app.main:app --port 8001
```

**File upload fails:**
- Check file size is under 10MB
- Ensure `uploads/` directory exists and is writable

## License

MIT License - feel free to use this project for learning and development.

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Acknowledgments

- [LlamaIndex](https://www.llamaindex.ai/) for RAG orchestration
- [Google Gemini](https://ai.google.dev/) for LLM and embeddings
- [FastAPI](https://fastapi.tiangolo.com/) for the web framework

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

Built with ❤️ using RAG technology
