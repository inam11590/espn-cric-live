from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.core.security import create_access_token
from backend.app.main import app
from backend.app.services.chat_manager import filter_profanity, generate_random_nickname, chat_manager


client = TestClient(app)


def get_admin_headers():
    token = create_access_token(data={"sub": "admin"})
    return {"Authorization": f"Bearer {token}"}


def test_profanity_filter():
    assert filter_profanity("What a fantastic six!") == "What a fantastic six!"
    filtered = filter_profanity("This is pure crap and bullshit")
    assert "****" in filtered  # crap masked
    assert "crap" not in filtered.lower()
    
    hindi_filtered = filter_profanity("Kya chutiya shot tha")
    assert "*******" in hindi_filtered
    assert "chutiya" not in hindi_filtered.lower()


def test_random_nickname_generator():
    nickname = generate_random_nickname()
    assert "_" in nickname
    prefix, num = nickname.split("_")
    assert len(prefix) > 2
    assert num.isdigit()


def test_get_polls_public():
    res = client.get("/api/v1/matches/1478914/polls")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    first_poll = data[0]
    assert "question" in first_poll
    assert "options" in first_poll
    assert "total_votes" in first_poll
    assert len(first_poll["options"]) >= 2


def test_poll_voting_and_duplicate_prevention():
    headers = get_admin_headers()
    # 1. Create a dedicated active poll for this test
    create_res = client.post(
        "/api/v1/admin/matches/1478914/polls",
        json={
            "question": "Who hits more boundaries?",
            "options": ["Team A", "Team B"],
            "series_id": 1478874,
        },
        headers=headers,
    )
    assert create_res.status_code == 200
    poll = create_res.json()
    poll_id = poll["id"]
    option_id = poll["options"][0]["id"]
    initial_votes = poll["total_votes"]

    session_id = f"test_user_{poll_id}_voting_isolation"

    # 2. First vote should succeed
    vote_res = client.post(
        f"/api/v1/matches/1478914/polls/{poll_id}/vote",
        json={"option_id": option_id, "session_id": session_id},
    )
    assert vote_res.status_code == 200
    updated = vote_res.json()
    assert updated["total_votes"] == initial_votes + 1
    assert updated["user_voted_option_id"] == option_id

    # 3. Duplicate vote with same session_id should be rejected with 400
    dup_res = client.post(
        f"/api/v1/matches/1478914/polls/{poll_id}/vote",
        json={"option_id": option_id, "session_id": session_id},
    )
    assert dup_res.status_code == 400
    assert "already cast your vote" in dup_res.json()["detail"]


def test_admin_create_and_toggle_poll():
    headers = get_admin_headers()
    # 1. Create new poll
    new_poll_payload = {
        "question": "Will Kohli score a century today?",
        "options": ["Yes, King Kohli!", "No, under 100"],
        "series_id": 1478874,
    }
    create_res = client.post(
        "/api/v1/admin/matches/1478914/polls",
        json=new_poll_payload,
        headers=headers,
    )
    assert create_res.status_code == 200
    poll_data = create_res.json()
    assert poll_data["question"] == new_poll_payload["question"]
    assert len(poll_data["options"]) == 2
    assert poll_data["is_active"] is True
    poll_id = poll_data["id"]

    # 2. Toggle poll state to closed
    toggle_res = client.patch(
        f"/api/v1/admin/polls/{poll_id}/toggle",
        headers=headers,
    )
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_active"] is False

    # 3. Voting on closed poll should fail
    vote_res = client.post(
        f"/api/v1/matches/1478914/polls/{poll_id}/vote",
        json={"option_id": "opt_1", "session_id": "session_closed_test"},
    )
    assert vote_res.status_code == 400
    assert "ended" in vote_res.json()["detail"].lower()


def test_websocket_chat_and_rate_limiting():
    with client.websocket_connect("/ws/chat/1478874/1478914") as ws:
        msg1 = ws.receive_json()
        assert msg1["type"] == "chat_history"
        msg2 = ws.receive_json()
        assert msg2["type"] == "viewer_count"

        # Send valid message
        ws.send_json({
            "type": "chat_message",
            "message": "Super cover drive by Kohli!",
            "username": "CoverDrive_77",
            "user_id": "test_user_unique_ws_1",
        })
        chat_res = ws.receive_json()
        assert chat_res["type"] == "chat_message"
        assert "Super cover drive" in chat_res["message"]

        # Send second message immediately with same user_id (should be rate-limited)
        ws.send_json({
            "type": "chat_message",
            "message": "Spam spam!",
            "username": "CoverDrive_77",
            "user_id": "test_user_unique_ws_1",
        })
        rl_res = ws.receive_json()
        assert rl_res["type"] == "error"
        assert rl_res["code"] == "RATE_LIMITED"


def test_websocket_reaction_broadcast():
    with client.websocket_connect("/ws/chat/1478874/1478914") as ws:
        ws.receive_json()  # history
        ws.receive_json()  # viewer count

        # Send reaction
        ws.send_json({
            "type": "reaction",
            "emoji": "🔥",
            "username": "YorkerKing_99",
        })
        rx_res = ws.receive_json()
        assert rx_res["type"] == "reaction"
        assert rx_res["emoji"] == "🔥"
        assert rx_res["sender"] == "YorkerKing_99"

