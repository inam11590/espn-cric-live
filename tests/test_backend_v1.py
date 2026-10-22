from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from backend.app.core.database import SessionLocal, init_db
from backend.app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    init_db()


def test_v1_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "degraded")
    assert data["database"] == "connected"
    assert "playwright" in data
    assert data["background_scheduler"] in ("running", "stopped")


def test_v1_get_live_matches_enriched_with_streams():
    response = client.get("/api/v1/matches/live")
    assert response.status_code == 200
    data = response.json()
    assert "matches" in data
    assert "total_matches" in data
    assert data["total_matches"] >= 1

    # Check match enrichment from database
    sample = data["matches"][0]
    assert "match_id" in sample
    assert "series_id" in sample
    assert "team_1" in sample
    assert "team_2" in sample
    assert "streams" in sample

    # Match 1478914 has seeded streams in database
    match_1478914 = next((m for m in data["matches"] if m["match_id"] == 1478914), None)
    if match_1478914:
        assert len(match_1478914["streams"]) >= 1
        stream0 = match_1478914["streams"][0]
        assert "server_name" in stream0
        assert "stream_type" in stream0
        assert "stream_url" in stream0
        assert stream0["quality"] in ("1080p", "720p")


def test_v1_get_match_detail_endpoint():
    response = client.get("/api/v1/matches/1478874/1478914")
    assert response.status_code == 200
    data = response.json()
    assert data["match_id"] == 1478914
    assert data["series_id"] == 1478874
    assert "IND Women" in data["description"]
    assert len(data["team_1"]["players"]) == 11
    assert len(data["team_2"]["players"]) == 11
    assert len(data["innings"]) == 2

    # Check batting scorecard
    inn1 = data["innings"][0]
    assert len(inn1["batting"]) == 11
    assert inn1["batting"][0]["name"] == "S Mandhana"
    assert inn1["batting"][0]["runs"] == 82

    # Check streams attached to match detail
    assert "streams" in data
    assert len(data["streams"]) >= 1


def test_v1_configure_match_streams():
    payload = {
        "match_id": 999999,
        "series_id": 888888,
        "match_title": "Test Custom Live Match",
        "is_live": True,
        "servers": [
            {
                "server_name": "Ultra HD Server 1",
                "stream_type": "hls",
                "stream_url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                "quality": "1080p",
                "is_active": True,
            },
            {
                "server_name": "Commentary Feed (Iframe)",
                "stream_type": "iframe",
                "stream_url": "https://www.youtube.com/embed/jfKfPfyJRdk",
                "quality": "720p",
                "is_active": True,
            },
        ],
    }
    response = client.post("/api/v1/matches/streams", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["match_id"] == 999999
    assert len(data["streams"]) == 2
    assert data["streams"][0]["server_name"] == "Ultra HD Server 1"
    assert data["streams"][0]["stream_type"] == "hls"


def test_websocket_realtime_connection():
    with client.websocket_connect("/ws/matches/1478874/1478914") as websocket:
        initial = websocket.receive_json()
        assert initial["event"] == "connected"
        assert initial["match_id"] == 1478914
        assert "data" in initial

        # Test ping-pong
        websocket.send_text("ping")
        reply = websocket.receive_text()
        assert reply == "pong"


def test_v1_get_player_profile():
    # Test player profile fetch for Smriti Mandhana (id 597806) or Virat Kohli (253802)
    response = client.get("/api/v1/players/597806")
    assert response.status_code == 200
    data = response.json()
    assert data["player_id"] == 597806
    assert "Mandhana" in data["full_name"] or "Mandhana" in data["name"]
    assert "batting_style" in data
    assert "playing_role" in data
    assert data["cached"] is True

