import pytest
import os
import tempfile
from unittest.mock import patch, MagicMock

temp_dir = tempfile.mkdtemp()

os.environ["GROQ_API_KEY"] = "test_groq_key_for_testing"
os.environ["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test_db"
os.environ["REDIS_URL"] = "redis://localhost:6379"
os.environ["CHROMA_PERSIST_DIR"] = temp_dir
os.environ["OPENAI_API_KEY"] = "test_openai_key"
os.environ["GEMINI_API_KEY"] = "test_gemini_key"


@pytest.fixture(autouse=True)
def mock_external_services():
    with patch("chromadb.PersistentClient") as mock_chroma:
        mock_client = MagicMock()
        mock_client.list_collections.return_value = []
        mock_chroma.return_value = mock_client
        yield mock_chroma


@pytest.fixture
def client():
    from app.main import app
    from fastapi.testclient import TestClient
    return TestClient(app)
