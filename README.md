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

## 🐳 Production Containerization & Cloud Deployment (Docker, Nginx & SSL)

The application includes enterprise-grade containerization and one-command automated deployment for any Linux VPS (Ubuntu/Debian, AWS EC2, DigitalOcean, Hetzner, etc.).

### Stack Architecture

```
[ Internet / Mobile & Web Viewers ]
              │
              ▼
    [ Nginx Reverse Gateway (Port 80 / 443 SSL) ]
    ├─► HTTP-01 Challenge ────► [ Certbot (Auto-Renewal Volume) ]
    ├─► /                      ──► [ Frontend: React 18 + Vite (Nginx Alpine) ]
    ├─► /admin & /admin/login  ──► [ Frontend SPA Router ]
    ├─► /api/v1/proxy/hls      ──► [ Backend (Zero-Buffering HLS Streaming) ]
    ├─► /api/v1/admin/         ──► [ Backend (JWT Protected Admin API) ]
    ├─► /api/v1/               ──► [ Backend (FastAPI Live Scores & Player API) ]
    └─► /ws/                   ──► [ WebSocket Real-Time Score Broadcast ]
```

### 1. One-Command Automated Production Deployment

Run the automated deployment script on your remote server:
```bash
chmod +x deploy.sh
./deploy.sh
```

The script will automatically:
1. Verify Docker and Docker Compose prerequisites.
2. Prompt for your public **domain name** and **admin email** (or load from `.env.production`).
3. Generate a cryptographically secure 64-character hex `JWT_SECRET_KEY`.
4. Bootstrap temporary SSL certificates so Nginx starts on both port 80 and 443 without crashing.
5. Launch the multi-container stack via `docker-compose.prod.yml`.
6. Acquire genuine **Let's Encrypt SSL certificates** via Certbot.
7. Hot-reload Nginx with zero downtime.

---

### 2. Local Docker Compose Testing (HTTP Mode)

To run the entire containerized stack locally on port 80 without SSL:
```bash
# Build and run containers in background
docker compose up -d --build

# Inspect running containers
docker compose ps

# View real-time logs
docker compose logs -f backend
```

Access locally at:
- **Public Match Center:** `http://localhost/`
- **Admin Console:** `http://localhost/admin`
- **Interactive Swagger Docs:** `http://localhost/docs`

---

### 3. Production Environment Variables (`.env.production`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DOMAIN_NAME` | Public FQDN of your server | `cricket.example.com` |
| `LETSENCRYPT_EMAIL` | Email for Let's Encrypt renewal notices | `admin@example.com` |
| `ADMIN_USERNAME` | Admin login username | `admin` |
| `ADMIN_PASSWORD` | Admin login password | `CricStream#2026` |
| `JWT_SECRET_KEY` | 64-character signing key | Generated by `deploy.sh` |
| `DATABASE_URL` | SQLite volume path | `sqlite:////app/data/cricket.db` |
| `SCRAPE_INTERVAL_SECONDS` | Cricinfo background refresh cycle | `20` |

---

## 🧪 Running Automated Tests

Run the full automated test suite with `pytest`:
```bash
.venv/bin/pytest tests/
```

All 25 automated tests verify:
- `tests/test_admin.py`: JWT Bearer authentication, unauthorized access rejection, stream addition/toggle/deletion lifecycle, stream health check, and custom exhibition matches.
- `tests/test_stream_proxy.py`: HLS master manifest rewriting, sub-playlist segment rewriting, range requests, binary `.ts` chunks, and CORS bypass headers.
- `tests/test_backend_v1.py`: Live matches enriched with streams from DB, match detail scorecard, player profiles (24h cache), and real-time WebSocket connection.
- `tests/test_cache.py`: In-memory TTL expiration, stale fallback handling, and concurrency thundering-herd coalescing.
- `tests/test_api.py`: Core endpoints and backwards compatibility.

