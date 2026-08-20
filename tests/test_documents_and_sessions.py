"""Minimal tests for the two new endpoints: per-document delete and session history.

These deliberately avoid touching Groq/embeddings (no network, no model download) since
delete and history endpoints don't need the LLM or embedding model at all.
"""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app, history_service, rag_service
from app.services.history_service import HistoryService


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def temp_history(tmp_path, monkeypatch):
    """Point the app's module-level history_service at a fresh temp DB for this test."""
    fresh = HistoryService(tmp_path / "test_history.db")
    monkeypatch.setattr("app.main.history_service", fresh)
    return fresh


# --- Document delete -------------------------------------------------------


def test_delete_document_removes_from_indexed_list(client, monkeypatch):
    monkeypatch.setattr(rag_service, "_indexed_documents", ["notes.pdf", "other.txt"])
    mock_delete = MagicMock()
    monkeypatch.setattr(rag_service, "_collection", MagicMock(delete=mock_delete))

    response = client.delete("/documents/notes.pdf")

    assert response.status_code == 200
    body = response.json()
    assert body["deleted"] == "notes.pdf"
    assert body["indexed_documents"] == ["other.txt"]
    mock_delete.assert_called_once_with(where={"source": "notes.pdf"})


def test_delete_document_404_when_not_indexed(client, monkeypatch):
    monkeypatch.setattr(rag_service, "_indexed_documents", ["other.txt"])

    response = client.delete("/documents/never-uploaded.pdf")

    assert response.status_code == 404


# --- Session history ---------------------------------------------------------


def test_history_add_and_get_messages_roundtrip(tmp_path):
    service = HistoryService(tmp_path / "roundtrip.db")

    service.add_message("s1", "user", "What is this document about?")
    service.add_message(
        "s1", "assistant", "It's about RAG.", sources=[{"file_name": "a.pdf", "text": "..."}]
    )

    messages = service.get_messages("s1")
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "What is this document about?"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["sources"] == [{"file_name": "a.pdf", "text": "..."}]


def test_get_session_messages_empty_session_returns_empty_list(client, temp_history):
    response = client.get("/sessions/never-seen-session/messages")

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == "never-seen-session"
    assert body["messages"] == []


def test_list_sessions_returns_recently_updated_first(tmp_path):
    service = HistoryService(tmp_path / "ordering.db")

    service.add_message("older", "user", "first session")
    service.add_message("newer", "user", "second session")
    service.touch_session("older")  # touch "older" last so recency alone wouldn't suffice...
    service.touch_session("newer")  # ...then touch "newer" again so it's genuinely most recent

    sessions = service.list_sessions()
    assert sessions[0]["session_id"] == "newer"
    assert sessions[0]["message_count"] == 1
