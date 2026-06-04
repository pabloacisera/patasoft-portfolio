import os


def test_public_endpoints_no_auth(client):
    response = client.get("/")
    assert response.status_code == 200

    response = client.get("/health")
    assert response.status_code in [200, 503]


def test_protected_endpoint_without_api_key(client):
    os.environ["AI_SERVICE_API_KEY"] = "test_secret_key_123"

    response = client.get("/api/v1/chat/models")
    assert response.status_code == 401
    assert "Invalid or missing API key" in response.json()["detail"]

    del os.environ["AI_SERVICE_API_KEY"]


def test_protected_endpoint_with_wrong_api_key(client):
    os.environ["AI_SERVICE_API_KEY"] = "test_secret_key_123"

    response = client.get("/api/v1/chat/models", headers={"X-API-Key": "wrong_key"})
    assert response.status_code == 401

    del os.environ["AI_SERVICE_API_KEY"]


def test_protected_endpoint_with_correct_api_key(client):
    os.environ["AI_SERVICE_API_KEY"] = "test_secret_key_123"

    response = client.get("/api/v1/chat/models", headers={"X-API-Key": "test_secret_key_123"})
    assert response.status_code != 401

    del os.environ["AI_SERVICE_API_KEY"]


def test_no_api_key_configured_allows_all(client):
    if "AI_SERVICE_API_KEY" in os.environ:
        del os.environ["AI_SERVICE_API_KEY"]

    response = client.get("/api/v1/chat/models")
    assert response.status_code != 401
