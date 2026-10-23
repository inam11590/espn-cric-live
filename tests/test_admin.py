from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from backend.app.core.database import SessionLocal, init_db
from backend.app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    init_db()


def test_admin_login_invalid_credentials():
    response = client.post(
        "/api/v1/admin/login",
        json={"username": "admin", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "Invalid admin username or password" in response.json()["detail"]


def test_admin_login_success():
    response = client.post(
        "/api/v1/admin/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["username"] == "admin"


def test_admin_routes_require_authentication():
    # Attempt without Bearer token
    response = client.get("/api/v1/admin/matches")
    assert response.status_code == 401

    # Attempt with invalid Bearer token
    response = client.get(
        "/api/v1/admin/matches",
        headers={"Authorization": "Bearer invalid.token.value"},
    )
    assert response.status_code == 401


def test_admin_get_matches_with_token():
    # 1. Login
    login_res = client.post(
        "/api/v1/admin/login",
        json={"username": "admin", "password": "admin123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get matches
    response = client.get("/api/v1/admin/matches", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "matches" in data
    assert len(data["matches"]) >= 1


def test_admin_stream_lifecycle():
    # 1. Login
    login_res = client.post(
        "/api/v1/admin/login",
        json={"username": "admin", "password": "admin123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Add stream server to match 1478914
    add_payload = {
        "server_name": "Sky Sports HD 1",
        "stream_type": "hls",
        "stream_url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        "referer": "https://cricket.skysports.com",
        "quality": "1080p",
        "is_active": True,
        "priority_order": 1,
    }
    add_res = client.post(
        "/api/v1/admin/matches/1478874/1478914/streams",
        json=add_payload,
        headers=headers,
    )
    assert add_res.status_code == 200
    server = add_res.json()
    stream_id = server["id"]
    assert server["server_name"] == "Sky Sports HD 1"
    assert server["is_active"] is True

    # 3. Toggle stream is_active to False
    patch_res = client.patch(
        f"/api/v1/admin/streams/{stream_id}",
        json={"is_active": False, "server_name": "Sky Sports HD 1 (Maintenance)"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    patch_data = patch_res.json()
    assert patch_data["server"]["is_active"] is False
    assert patch_data["server"]["server_name"] == "Sky Sports HD 1 (Maintenance)"

    # 4. Delete stream server
    del_res = client.delete(f"/api/v1/admin/streams/{stream_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True


def test_admin_stream_test_endpoint():
    # 1. Login
    login_res = client.post(
        "/api/v1/admin/login",
        json={"username": "admin", "password": "admin123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test invalid URL protocol
    test_res = client.post(
        "/api/v1/admin/streams/test",
        json={"stream_url": "ftp://bad-url.m3u8"},
        headers=headers,
    )
    assert test_res.status_code == 200
    data = test_res.json()
    assert data["success"] is False
    assert data["status_code"] == 400


def test_admin_create_custom_match():
    # 1. Login
    login_res = client.post(
        "/api/v1/admin/login",
        json={"username": "admin", "password": "admin123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create custom match
    match_payload = {
        "match_id": 888123,
        "series_id": 777123,
        "match_title": "Exhibition Final",
        "team_1_name": "Lahore Qalandars",
        "team_2_name": "Karachi Kings",
        "series_name": "Super League 2026",
        "status": "LIVE",
    }
    res = client.post("/api/v1/admin/matches/custom", json=match_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["match_id"] == 888123
