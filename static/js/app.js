/**
 * Live Cricket Streaming & Score Application Frontend Logic
 */

// Application State
const state = {
  matches: [],
  activeMatch: null,
  activeInningsIndex: 0,
  activeDetailData: null,
  hls: null,
  refreshTimer: null,
  countdown: 20,
  autoRefreshEnabled: true,
  streamType: 'hls', // 'hls' or 'iframe'
};

// Preset Video Feeds
const STREAM_PRESETS = [
  {
    name: 'Main Broadcast (HLS)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    type: 'hls',
  },
  {
    name: 'Tactical / Spider Cam',
    url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    type: 'hls',
  },
  {
    name: 'Stump & Ground Cam',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8',
    type: 'hls',
  },
  {
    name: 'World Feed (Embed)',
    url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1',
    type: 'iframe',
  },
];

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initPlayer(STREAM_PRESETS[0].url, STREAM_PRESETS[0].type);
  setupEventListeners();
  loadLiveMatches();
  startAutoRefresh();
});

// ----------------------------------------------------------------------------
// VIDEO STREAMING ENGINE
// ----------------------------------------------------------------------------

function initPlayer(streamUrl, type = 'hls') {
  const videoElem = document.getElementById('videoPlayer');
  const iframeElem = document.getElementById('iframePlayer');
  const streamBadge = document.getElementById('streamTypeBadge');

  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }

  state.streamType = type;

  if (type === 'iframe') {
    videoElem.style.display = 'none';
    iframeElem.style.display = 'block';
    iframeElem.src = streamUrl;
    if (streamBadge) streamBadge.innerText = 'IFRAME EMBED';
    return;
  }

  // HLS stream handling
  iframeElem.style.display = 'none';
  videoElem.style.display = 'block';
  if (streamBadge) streamBadge.innerText = 'HLS LIVE';

  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
    });
    hls.loadSource(streamUrl);
    hls.attachMedia(videoElem);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoElem.play().catch(() => {
        // Autoplay may be blocked; user can tap play
        console.log('Autoplay deferred until user interaction');
      });
    });
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        console.warn('HLS fatal error encountered:', data.type);
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      }
    });
    state.hls = hls;
  } else if (videoElem.canPlayType('application/vnd.apple.mpegurl')) {
    // Native Safari / iOS HLS
    videoElem.src = streamUrl;
    videoElem.addEventListener('loadedmetadata', () => {
      videoElem.play().catch(() => {});
    });
  } else {
    console.error('HLS is not supported in this browser.');
  }
}

function switchPresetFeed(index) {
  const preset = STREAM_PRESETS[index];
  if (!preset) return;

  document.querySelectorAll('.feed-tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });

  const customInput = document.getElementById('customStreamInput');
  if (customInput) customInput.value = preset.url;

  initPlayer(preset.url, preset.type);
}

function loadCustomStream() {
  const input = document.getElementById('customStreamInput');
  if (!input || !input.value.trim()) return;

  const url = input.value.trim();
  const isEmbed = url.includes('youtube.com') || url.includes('embed') || url.includes('twitch.tv');
  const type = isEmbed ? 'iframe' : 'hls';

  document.querySelectorAll('.feed-tab').forEach((tab) => tab.classList.remove('active'));
  initPlayer(url, type);
}

// ----------------------------------------------------------------------------
// DATA FETCHING & API INTEGRATION
// ----------------------------------------------------------------------------

async function loadLiveMatches(isManual = false) {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn && isManual) {
    refreshBtn.innerHTML = '<span class="spinner"></span> Scraping...';
  }

  try {
    const url = `/api/matches/live${isManual ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.matches = data.matches || [];
    renderLiveScoreBanner(state.matches);
    updateCachePill(data.cached, data.is_stale, data.notice);

    if (state.matches.length > 0) {
      if (!state.activeMatch) {
        selectMatch(state.matches[0]);
      } else {
        // Refresh active match if present
        const current = state.matches.find(
          (m) => m.match_id === state.activeMatch.match_id && m.series_id === state.activeMatch.series_id
        );
        if (current) selectMatch(current, false);
      }
    }
  } catch (err) {
    console.error('Error fetching live matches:', err);
  } finally {
    if (refreshBtn) {
      refreshBtn.innerHTML = '&#8635; Refresh';
    }
    state.countdown = 20;
  }
}

async function loadMatchDetails(seriesId, matchId) {
  openModal('matchDetailModal');
  const modalBody = document.getElementById('matchDetailBody');
  modalBody.innerHTML = '<div class="empty-state"><span class="spinner"></span><p style="margin-top:12px;">Extracting full match scorecard & bowling figures...</p></div>';

  try {
    const res = await fetch(`/api/matches/${seriesId}/${matchId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.activeDetailData = data;
    state.activeInningsIndex = 0;
    renderMatchDetailModal(data);
  } catch (err) {
    modalBody.innerHTML = `<div class="empty-state" style="color:var(--accent-red)">Failed to load scorecard: ${err.message}</div>`;
  }
}

async function loadPlayerProfile(playerId) {
  openModal('playerProfileModal');
  const body = document.getElementById('playerProfileBody');
  body.innerHTML = '<div class="empty-state"><span class="spinner"></span><p style="margin-top:12px;">Loading player career statistics...</p></div>';

  try {
    const res = await fetch(`/api/players/${playerId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderPlayerProfileModal(data);
  } catch (err) {
    body.innerHTML = `<div class="empty-state" style="color:var(--accent-red)">Failed to load player profile: ${err.message}</div>`;
  }
}

// ----------------------------------------------------------------------------
// UI RENDERING
// ----------------------------------------------------------------------------

function renderLiveScoreBanner(matches) {
  const container = document.getElementById('scoreTicker');
  if (!container) return;

  if (!matches || matches.length === 0) {
    container.innerHTML = '<div class="empty-state" style="width:100%">No live or recent matches scheduled at this time.</div>';
    return;
  }

  container.innerHTML = matches
    .map((m) => {
      const isLive = m.status === 'LIVE';
      const isResult = m.status === 'RESULT';
      const statusClass = isLive ? 'live' : isResult ? 'result' : 'upcoming';
      const isActive = state.activeMatch && state.activeMatch.match_id === m.match_id;

      const t1Score = m.team_1.score || 'Yet to bat';
      const t2Score = m.team_2.score || 'Yet to bat';

      return `
        <div class="score-card ${isActive ? 'active-match' : ''}" onclick="onCardClick(${m.series_id}, ${m.match_id})">
          <div class="card-top">
            <span class="card-format">${m.format || m.match_class || 'CRICKET'}</span>
            <span class="status-badge ${statusClass}">
              ${isLive ? '<span class="pulse-dot"></span> ' : ''}${m.status}
            </span>
          </div>

          <div class="teams-list">
            <div class="team-row">
              <div class="team-info">
                ${m.team_1.logo_url ? `<img class="team-flag" src="${m.team_1.logo_url}" alt="" onerror="this.style.display='none'">` : '<div class="team-flag">🏏</div>'}
                <span>${m.team_1.abbreviation || m.team_1.name}</span>
              </div>
              <div class="team-score-block">
                <div class="team-score">${t1Score}</div>
                ${m.team_1.overs ? `<div class="team-overs">(${m.team_1.overs} ov)</div>` : ''}
              </div>
            </div>

            <div class="team-row">
              <div class="team-info">
                ${m.team_2.logo_url ? `<img class="team-flag" src="${m.team_2.logo_url}" alt="" onerror="this.style.display='none'">` : '<div class="team-flag">🏏</div>'}
                <span>${m.team_2.abbreviation || m.team_2.name}</span>
              </div>
              <div class="team-score-block">
                <div class="team-score">${t2Score}</div>
                ${m.team_2.overs ? `<div class="team-overs">(${m.team_2.overs} ov)</div>` : ''}
              </div>
            </div>
          </div>

          <div class="card-footer-info">
            ${m.status_text || m.current_summary || m.series_name}
          </div>
        </div>
      `;
    })
    .join('');

  // Update match selector dropdown in right panel
  const select = document.getElementById('matchSelectDropdown');
  if (select) {
    select.innerHTML = matches
      .map(
        (m) => `
        <option value="${m.series_id}:${m.match_id}" ${state.activeMatch && state.activeMatch.match_id === m.match_id ? 'selected' : ''}>
          ${m.team_1.abbreviation || m.team_1.name} vs ${m.team_2.abbreviation || m.team_2.name} (${m.status})
        </option>
      `
      )
      .join('');
  }
}

function onCardClick(seriesId, matchId) {
  const match = state.matches.find((m) => m.match_id === matchId && m.series_id === seriesId);
  if (match) {
    selectMatch(match);
  }
}

function selectMatch(match, switchStream = true) {
  state.activeMatch = match;

  // Highlight in ticker
  document.querySelectorAll('.score-card').forEach((card) => {
    card.classList.remove('active-match');
  });

  // Update stream title & venue
  const streamTitle = document.getElementById('streamMatchTitle');
  const streamVenue = document.getElementById('streamMatchVenue');
  if (streamTitle) streamTitle.innerText = `${match.team_1.name} vs ${match.team_2.name} - ${match.title}`;
  if (streamVenue) streamVenue.innerText = `${match.ground_name} ${match.ground_city ? '• ' + match.ground_city : ''} | ${match.series_name}`;

  // Switch video stream if match provides custom stream
  if (switchStream && match.live_stream_url) {
    initPlayer(match.live_stream_url, 'hls');
    const input = document.getElementById('customStreamInput');
    if (input) input.value = match.live_stream_url;
  }

  // Update right panel active scoreboard
  renderActiveScoreboard(match);
}

function renderActiveScoreboard(m) {
  const container = document.getElementById('activeScoreboardContainer');
  if (!container) return;

  const t1 = m.team_1;
  const t2 = m.team_2;

  container.innerHTML = `
    <div class="board-match-title">${m.series_name} • ${m.title}</div>
    <div class="board-scores">
      <div class="board-team-row">
        <span class="board-team-name">${t1.name} (${t1.abbreviation})</span>
        <span class="board-team-score">${t1.score} ${t1.overs ? `<span style="font-size:0.75rem; color:var(--text-muted)">(${t1.overs} ov)</span>` : ''}</span>
      </div>
      <div class="board-team-row">
        <span class="board-team-name">${t2.name} (${t2.abbreviation})</span>
        <span class="board-team-score">${t2.score} ${t2.overs ? `<span style="font-size:0.75rem; color:var(--text-muted)">(${t2.overs} ov)</span>` : ''}</span>
      </div>
    </div>
    <div class="board-status-text">
      <strong>Status:</strong> ${m.status_text || m.current_summary || 'Match in progress'}
    </div>
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button class="btn btn-primary" style="flex:1" onclick="loadMatchDetails(${m.series_id}, ${m.match_id})">
        📊 View Full Scorecard
      </button>
      <button class="btn" onclick="initPlayer('${m.live_stream_url || STREAM_PRESETS[0].url}', 'hls')">
        📺 Sync Live Stream
      </button>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// DETAILED MATCH MODAL
// ----------------------------------------------------------------------------

function renderMatchDetailModal(data) {
  const title = document.getElementById('modalMatchTitle');
  if (title) title.innerText = `${data.description} - Full Match Center`;

  const innings = data.innings || [];
  const innContainer = document.getElementById('inningsToggleBar');
  if (innContainer) {
    innContainer.innerHTML = innings
      .map(
        (inn, idx) => `
        <button class="innings-toggle-btn ${idx === state.activeInningsIndex ? 'active' : ''}" onclick="switchInningsTab(${idx})">
          ${inn.team_name} Innings (${inn.runs}/${inn.wickets} in ${inn.overs} ov)
        </button>
      `
      )
      .join('');
  }

  renderInningsScorecards(data, state.activeInningsIndex);
  renderMatchInfoTab(data);
}

function switchInningsTab(idx) {
  state.activeInningsIndex = idx;
  document.querySelectorAll('.innings-toggle-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === idx);
  });
  if (state.activeDetailData) {
    renderInningsScorecards(state.activeDetailData, idx);
  }
}

function renderInningsScorecards(data, innIdx) {
  const battingBody = document.getElementById('battingTableBody');
  const bowlingBody = document.getElementById('bowlingTableBody');
  const innings = data.innings || [];

  if (innIdx >= innings.length || !innings[innIdx]) {
    if (battingBody) battingBody.innerHTML = '<tr><td colspan="7">No batting records available for this innings.</td></tr>';
    if (bowlingBody) bowlingBody.innerHTML = '<tr><td colspan="8">No bowling records available for this innings.</td></tr>';
    return;
  }

  const currentInn = innings[innIdx];

  // Batting table
  if (battingBody) {
    battingBody.innerHTML = (currentInn.batting || [])
      .map((b) => {
        const sr = b.strike_rate !== null ? b.strike_rate.toFixed(1) : '-';
        const playerHtml = b.player_id
          ? `<a class="player-link" onclick="loadPlayerProfile(${b.player_id})">${b.full_name || b.name}</a>`
          : `<strong>${b.full_name || b.name}</strong>`;

        return `
          <tr>
            <td>${playerHtml}</td>
            <td style="color:var(--text-muted); font-size:0.8rem">${b.dismissal || (b.is_out ? 'out' : 'not out')}</td>
            <td><strong>${b.runs !== null ? b.runs : '-'}</strong></td>
            <td>${b.balls !== null ? b.balls : '-'}</td>
            <td>${b.fours !== null ? b.fours : '-'}</td>
            <td>${b.sixes !== null ? b.sixes : '-'}</td>
            <td>${sr}</td>
          </tr>
        `;
      })
      .join('');
  }

  // Bowling table
  if (bowlingBody) {
    bowlingBody.innerHTML = (currentInn.bowling || [])
      .map((bw) => {
        const econ = bw.economy !== null ? bw.economy.toFixed(2) : '-';
        const playerHtml = bw.player_id
          ? `<a class="player-link" onclick="loadPlayerProfile(${bw.player_id})">${bw.full_name || bw.name}</a>`
          : `<strong>${bw.full_name || bw.name}</strong>`;

        return `
          <tr>
            <td>${playerHtml}</td>
            <td><strong>${bw.overs !== null ? bw.overs : '-'}</strong></td>
            <td>${bw.maidens !== null ? bw.maidens : '0'}</td>
            <td>${bw.runs !== null ? bw.runs : '0'}</td>
            <td><strong style="color:var(--accent-red)">${bw.wickets !== null ? bw.wickets : '0'}</strong></td>
            <td>${econ}</td>
            <td>${bw.dots !== null ? bw.dots : '-'}</td>
            <td>${bw.wides || 0}/${bw.no_balls || 0}</td>
          </tr>
        `;
      })
      .join('');
  }
}

function renderMatchInfoTab(data) {
  const container = document.getElementById('matchInfoTabPane');
  if (!container) return;

  const t1 = data.team_1 || { players: [] };
  const t2 = data.team_2 || { players: [] };

  const renderRoster = (team) => {
    return (team.players || [])
      .map((p) => {
        const link = `<a class="player-link" onclick="loadPlayerProfile(${p.player_id})">${p.full_name || p.name}</a>`;
        const badges = [];
        if (p.is_captain) badges.push('<span class="status-badge" style="background:#0070f3; color:#fff">C</span>');
        if (p.is_keeper) badges.push('<span class="status-badge" style="background:#ffb300; color:#000">WK</span>');
        return `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04)">
            <div>${link} ${badges.join(' ')}</div>
            <div style="font-size:0.75rem; color:var(--text-muted)">${p.role || 'Player'}</div>
          </div>
        `;
      })
      .join('');
  };

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px">
      <div class="bio-chip">
        <div class="bio-chip-label">Venue & Ground</div>
        <div class="bio-chip-val">${data.ground_name} ${data.town_name ? '• ' + data.town_name : ''}</div>
      </div>
      <div class="bio-chip">
        <div class="bio-chip-label">Toss Result</div>
        <div class="bio-chip-val">${data.toss_decision ? 'Toss decision: ' + data.toss_decision : 'N/A'}</div>
      </div>
      <div class="bio-chip">
        <div class="bio-chip-label">Format & Season</div>
        <div class="bio-chip-val">${data.format || data.match_class || 'Cricket'} (${data.season || 'Current'})</div>
      </div>
      <div class="bio-chip">
        <div class="bio-chip-label">Result / Status</div>
        <div class="bio-chip-val" style="color:var(--accent-amber)">${data.result || data.status_text}</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
      <div style="background:var(--bg-card); padding:16px; border-radius:12px; border:1px solid var(--border-color)">
        <h4 style="margin-bottom:12px; color:var(--accent-blue)">${t1.name} Playing XI</h4>
        ${renderRoster(t1)}
      </div>

      <div style="background:var(--bg-card); padding:16px; border-radius:12px; border:1px solid var(--border-color)">
        <h4 style="margin-bottom:12px; color:var(--accent-green)">${t2.name} Playing XI</h4>
        ${renderRoster(t2)}
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// PLAYER PROFILE MODAL
// ----------------------------------------------------------------------------

function renderPlayerProfileModal(data) {
  const body = document.getElementById('playerProfileBody');
  if (!body) return;

  const bio = data.bio || {};
  const stats = data.career_averages || [];

  const defaultAvatar = 'https://img1.hscicdn.com/image/upload/f_auto/lsci/db/PICTURES/CMS/320600/320620.png';
  const avatarUrl = bio.headshot_url || defaultAvatar;

  body.innerHTML = `
    <div class="player-profile-grid">
      <div class="player-avatar-box">
        <img class="player-avatar-img" src="${avatarUrl}" alt="${bio.name}" onerror="this.src='${defaultAvatar}'">
        <h3 style="font-size:1.1rem; color:#fff">${bio.name}</h3>
        <p style="font-size:0.75rem; color:var(--accent-blue); margin-top:2px;">${bio.playing_role || 'Cricketer'}</p>
        <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">${bio.country || 'International'}</p>
      </div>

      <div class="player-bio-info">
        <div class="bio-metric-row">
          <div class="bio-chip">
            <div class="bio-chip-label">Full Name</div>
            <div class="bio-chip-val">${bio.full_name || bio.name}</div>
          </div>
          <div class="bio-chip">
            <div class="bio-chip-label">Age / DOB</div>
            <div class="bio-chip-val">${bio.current_age ? bio.current_age + ' yrs' : '-'}</div>
          </div>
          <div class="bio-chip">
            <div class="bio-chip-label">Batting Style</div>
            <div class="bio-chip-val">${bio.batting_style || 'Right-hand bat'}</div>
          </div>
          <div class="bio-chip">
            <div class="bio-chip-label">Bowling Style</div>
            <div class="bio-chip-val">${bio.bowling_style || 'Right-arm medium'}</div>
          </div>
        </div>

        <div>
          <div class="snapshot-title" style="margin-top:8px">Major Teams</div>
          <div class="player-teams-list">
            ${(bio.major_teams || []).map((t) => `<span class="team-badge-tag">${t}</span>`).join('')}
          </div>
        </div>

        <div style="margin-top:14px">
          <div class="snapshot-title">Career Statistics</div>
          <table class="data-table" style="margin-top:6px">
            <thead>
              <tr>
                <th>Format</th>
                <th>Mat</th>
                <th>Inns</th>
                <th>Runs</th>
                <th>HS</th>
                <th>Avg</th>
                <th>SR</th>
                <th>100s/50s</th>
                <th>Wkts</th>
              </tr>
            </thead>
            <tbody>
              ${stats
                .map(
                  (s) => `
                <tr>
                  <td><strong>${s.format_name}</strong></td>
                  <td>${s.matches}</td>
                  <td>${s.innings}</td>
                  <td><strong>${s.runs}</strong></td>
                  <td>${s.highest_score}</td>
                  <td>${s.batting_average ? s.batting_average.toFixed(2) : '-'}</td>
                  <td>${s.strike_rate ? s.strike_rate.toFixed(1) : '-'}</td>
                  <td>${s.hundreds}/${s.fifties}</td>
                  <td><strong style="color:var(--accent-red)">${s.wickets || 0}</strong></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODAL CONTROLS & AUTO REFRESH
// ----------------------------------------------------------------------------

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function switchModalTab(tabName) {
  document.querySelectorAll('.modal-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach((pane) => {
    pane.classList.toggle('active', pane.id === `${tabName}TabPane`);
  });
}

function startAutoRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);

  state.refreshTimer = setInterval(() => {
    if (!state.autoRefreshEnabled) return;

    state.countdown--;
    const fill = document.getElementById('refreshTimerFill');
    if (fill) {
      const pct = (state.countdown / 20) * 100;
      fill.style.width = `${pct}%`;
    }

    if (state.countdown <= 0) {
      loadLiveMatches(false);
    }
  }, 1000);
}

function updateCachePill(isCached, isStale, notice) {
  const pill = document.getElementById('cacheStatusPill');
  if (!pill) return;

  if (isStale) {
    pill.innerHTML = '⚡ Cache: <span>Stale Guard</span>';
    pill.style.borderColor = 'var(--accent-amber)';
  } else if (isCached) {
    pill.innerHTML = '⚡ Cache: <span style="color:var(--accent-green)">HIT (20s)</span>';
    pill.style.borderColor = 'var(--accent-green)';
  } else {
    pill.innerHTML = '⚡ Cache: <span style="color:var(--accent-blue)">SCRAPED</span>';
    pill.style.borderColor = 'var(--border-color)';
  }
}

function setupEventListeners() {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadLiveMatches(true));
  }

  const dropdown = document.getElementById('matchSelectDropdown');
  if (dropdown) {
    dropdown.addEventListener('change', (e) => {
      const [seriesId, matchId] = e.target.value.split(':');
      onCardClick(parseInt(seriesId), parseInt(matchId));
    });
  }

  // Close modals on escape key or clicking backdrop
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('matchDetailModal');
      closeModal('playerProfileModal');
    }
  });

  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}
