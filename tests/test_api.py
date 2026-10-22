import json
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.cache import cache

client = TestClient(app)


def setup_function():
    cache.clear()


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["playwright_browser"] == "WebKit"
    assert "cache_ttl" in data


def test_get_live_matches_endpoint():
    response = client.get("/api/matches/live")
    assert response.status_code == 200
    data = response.json()
    assert "matches" in data
    assert "total_matches" in data
    assert data["total_matches"] >= 1
    m0 = data["matches"][0]
    assert "series_id" in m0
    assert "match_id" in m0
    assert "team_1" in m0
    assert "team_2" in m0
    assert "live_stream_url" in m0

    # Second call should be served from cache!
    response2 = client.get("/api/matches/live")
    assert response2.status_code == 200
    assert response2.json()["cached"] is True


def test_get_match_detail_endpoint():
    # Use our fixture match 1478914 (IND Women vs AUS Women)
    response = client.get("/api/matches/1478874/1478914")
    assert response.status_code == 200
    data = response.json()
    assert data["match_id"] == 1478914
    assert data["series_id"] == 1478874
    assert "IND Women" in data["description"]
    assert "team_1" in data
    assert "team_2" in data
    assert len(data["team_1"]["players"]) == 11
    assert len(data["team_2"]["players"]) == 11
    assert "innings" in data
    assert len(data["innings"]) == 2

    # Check batting scorecard
    inn1 = data["innings"][0]
    assert "IND Women" in inn1["team_name"]
    assert len(inn1["batting"]) == 11
    b0 = inn1["batting"][0]
    assert b0["name"] == "S Mandhana"
    assert b0["runs"] == 82
    assert b0["fours"] == 8

    # Check bowling scorecard
    assert len(inn1["bowling"]) == 6
    bw0 = inn1["bowling"][0]
    assert bw0["name"] == "D Brown"
    assert bw0["overs"] == 3.0

    # Second call should be cached!
    response2 = client.get("/api/matches/1478874/1478914")
    assert response2.status_code == 200
    assert response2.json()["cached"] is True


def test_get_player_profile_endpoint():
    # Use our fixture player 253802 (Virat Kohli)
    response = client.get("/api/players/253802")
    assert response.status_code == 200
    data = response.json()
    assert data["player_id"] == 253802
    assert "bio" in data
    assert data["bio"]["name"] == "Virat Kohli"
    assert data["bio"]["full_name"] == "Virat Kohli"
    assert "career_averages" in data
    assert len(data["career_averages"]) >= 3
    # Check format breakdown
    formats = [c["format_name"] for c in data["career_averages"]]
    assert "Test Matches" in formats
    assert "One Day Internationals" in formats
    assert "T20 Internationals" in formats

    # Second call should be cached!
    response2 = client.get("/api/players/253802")
    assert response2.status_code == 200
    assert response2.json()["cached"] is True


def test_cache_stats_and_clear():
    # Make a request to populate cache
    client.get("/api/matches/live")
    stats_resp = client.get("/api/cache/stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total_keys"] >= 1

    clear_resp = client.post("/api/cache/clear")
    assert clear_resp.status_code == 200
    assert clear_resp.json()["status"] == "success"

    stats_resp2 = client.get("/api/cache/stats")
    assert stats_resp2.json()["total_keys"] == 0
