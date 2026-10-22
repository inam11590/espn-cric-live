# Live Cricket Streaming & Live Score Application

A modern, broadcast-grade live cricket web application and API service integrating data capabilities from [outside-edge/python-espncricinfo](https://github.com/outside-edge/python-espncricinfo).

Built with **FastAPI**, **Playwright (WebKit)** for Akamai-resilient scraping, an **In-Memory TTL Caching Guardrail** with in-flight request coalescing, and a responsive frontend featuring an **HLS / Embed live video streaming player** alongside real-time scorecards.

---

## 🌟 Key Features

### 1. Data Layer & Scraper Service
- Integrates `Summary()`, `Match(match_id, series_id)`, and `Player(player_id)` from `espncricinfo`.
- Uses **Playwright with WebKit** (Safari engine) to extract embedded `__NEXT_DATA__` JSON from ESPN Cricinfo, avoiding CDN / Akamai bot-blocking in headless environments.
- Fallback & resilience layer: If a live network fetch encounters timeouts or CDN blocks, the service gracefully serves stale cached data or structured fallback fixtures without crashing.

### 2. Caching & Rate-Limiting Guardrail
- **Live Match Scores:** Cached for **20 seconds** (within the 15–30s threshold).
- **Match Scorecards & Player Profiles:** Cached for **24 hours (86,400s)**.
- **Thundering-Herd Protection:** Concurrent requests for the same match or live ticker share a single in-flight lock, preventing duplicate Playwright browser instances.
- **Diagnostics:** Inspect active cache keys, hit ratios, and memory stats via `GET /api/cache/stats` and `POST /api/cache/clear`.

### 3. Responsive Live Streaming Dashboard
- **Top Live Score Banner:** Real-time mini scorecards displaying teams, flags, runs/wickets, overs, target, and status badges (LIVE, RESULT, UPCOMING).
- **Modular Video Player:**
  - Native **HLS (`.m3u8`)** playback via `Hls.js` with multi-bitrate support.
  - **Iframe Embed** support for broadcast streams (YouTube Live, Twitch, CDN embeds).
  - Multi-camera / feed switcher (Main Feed 1080p, Spider Cam, Stump Cam, World Feed).
  - Custom stream input field for any `.m3u8` or embed link.
- **Detailed Match Modal:**
  - Interactive tabs for **Batting Scorecard**, **Bowling Figures**, and **Match Info / Playing XIs**.
  - Clickable batsman, bowler, and squad player names that immediately open their career profile.
- **Player Profile Modal:**
  - Displays full bio (age, role, batting/bowling style, major teams) and format-by-format career averages (Tests, ODIs, T20Is).

---

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Playwright WebKit browser binary

### Setup Instructions

1. **Clone & Navigate:**
   ```bash
   cd /Users/mac/Documents/EspnCric
   ```

2. **Activate Virtual Environment & Install Dependencies:**
   ```bash
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Install Playwright WebKit Browser:**
   ```bash
   playwright install webkit
   ```

4. **Run the Application:**
   ```bash
   python run.py
   # Or directly with uvicorn:
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

5. **Open Dashboard:**
   - **Web Dashboard:** [http://localhost:8000/](http://localhost:8000/)
   - **Interactive API Docs (Swagger / OpenAPI):** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Alternative ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📡 API Reference

### 1. Live Matches & Scores
```http
GET /api/matches/live
```
**Query Parameters:**
- `date` *(optional)*: Filter by date (`YYYY-MM-DD`). Defaults to today.
- `refresh` *(optional, bool)*: Force refresh bypasses the 20-second cache.

**Response Example:**
```json
{
  "matches": [
    {
      "series_id": 1478874,
      "match_id": 1478914,
      "title": "3rd T20I",
      "series_name": "India Women in Australia",
      "status": "RESULT",
      "status_text": "IND Women won by 17 runs",
      "match_class": "WT20I",
      "format": "T20",
      "ground_name": "Adelaide Oval",
      "team_1": {
        "name": "India Women",
        "abbreviation": "IND-W",
        "score": "176/6",
        "overs": "20.0"
      },
      "team_2": {
        "name": "Australia Women",
        "abbreviation": "AUS-W",
        "score": "159/9",
        "overs": "20.0"
      },
      "target": "177",
      "live_stream_url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    }
  ],
  "total_matches": 1,
  "live_count": 0,
  "cached": false,
  "timestamp": "2026-10-22T07:35:00Z"
}
```

---

### 2. Full Match Scorecard & Line-ups
```http
GET /api/matches/{series_id}/{match_id}
```
**Example:** `GET /api/matches/1478874/1478914`

**Response Example:**
```json
{
  "series_id": 1478874,
  "match_id": 1478914,
  "description": "IND Women v AUS Women",
  "match_title": "3rd T20I",
  "status": "result",
  "result": "IND Women won by 17 runs",
  "ground_name": "Adelaide Oval",
  "toss_winner_team_id": "1812",
  "toss_decision": "bat",
  "team_1": {
    "team_id": "1812",
    "name": "IND Women",
    "players": [
      {
        "player_id": 597806,
        "name": "S Mandhana",
        "full_name": "Smriti Mandhana",
        "role": "opening batter"
      }
    ]
  },
  "innings": [
    {
      "innings_number": 1,
      "team_name": "IND Women",
      "runs": 176,
      "wickets": 6,
      "overs": "20",
      "batting": [
        {
          "name": "S Mandhana",
          "player_id": 597806,
          "runs": 82,
          "balls": 55,
          "fours": 8,
          "sixes": 3,
          "strike_rate": 149.09,
          "is_out": true,
          "dismissal": "c Gardner b Sutherland"
        }
      ],
      "bowling": [
        {
          "name": "D Brown",
          "player_id": 388845,
          "overs": 3.0,
          "maidens": 0,
          "runs": 27,
          "wickets": 0,
          "economy": 9.0
        }
      ]
    }
  ],
  "cached": false
}
```

---

### 3. Player Bio & Career Statistics
```http
GET /api/players/{player_id}
```
**Example:** `GET /api/players/253802` (Virat Kohli)

**Response Example:**
```json
{
  "player_id": 253802,
  "bio": {
    "name": "Virat Kohli",
    "full_name": "Virat Kohli",
    "current_age": 37,
    "playing_role": "Top-order batter",
    "batting_style": "Right-hand bat",
    "bowling_style": "Right-arm medium",
    "major_teams": ["India", "Royal Challengers Bengaluru"]
  },
  "career_averages": [
    {
      "format_name": "Test Matches",
      "matches": 113,
      "innings": 191,
      "runs": 8848,
      "highest_score": "254*",
      "batting_average": 49.15,
      "hundreds": 29
    },
    {
      "format_name": "One Day Internationals",
      "matches": 295,
      "innings": 283,
      "runs": 13906,
      "highest_score": "183",
      "batting_average": 58.18,
      "hundreds": 50
    }
  ],
  "cached": false
}
```

---

### 4. System Health & Cache Diagnostics
- `GET /api/health`: Health status and configured TTL policies.
- `GET /api/cache/stats`: Active keys, hit ratio, total hits, and misses.
- `POST /api/cache/clear`: Clear in-memory cache on demand.

---

## 🧪 Running Automated Tests

Run the full automated test suite with `pytest`:
```bash
pytest tests/
```

Test coverage includes:
- `tests/test_cache.py`: Verifies in-memory TTL expiration, stale fallback handling, and concurrency thundering-herd coalescing.
- `tests/test_api.py`: Validates all API endpoints (`/api/health`, `/api/matches/live`, `/api/matches/{series_id}/{match_id}`, `/api/players/{player_id}`, `/api/cache/stats`).
