import React, { useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { MatchSummary } from './types/cricket';
import { useMatchSocket } from './hooks/useMatchSocket';
import { Navbar } from './components/Navbar';
import { MatchTicker } from './components/MatchTicker';
import { MatchCenter } from './pages/MatchCenter';
import { PlayerModal } from './components/PlayerModal';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';

// -----------------------------------------------------------------------------
// PUBLIC MATCH CENTER PAGE
// -----------------------------------------------------------------------------
const PublicMatchCenter: React.FC = () => {
  const [searchParams] = useSearchParams();
  const urlMatchId = searchParams.get('match') ? parseInt(searchParams.get('match')!) : null;

  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchSummary | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  // Filters
  const [liveOnly, setLiveOnly] = useState<boolean>(false);
  const [selectedSeries, setSelectedSeries] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMatchesLoading, setIsMatchesLoading] = useState<boolean>(true);

  // Fetch all matches from GET /api/v1/matches/live
  const fetchMatchesList = async () => {
    try {
      const res = await fetch('/api/v1/matches/live');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: MatchSummary[] = data.matches || [];
      setMatches(items);

      setSelectedMatch((prev) => {
        // If URL has ?match=... query, honor it
        if (urlMatchId) {
          const matchFromUrl = items.find((m) => m.match_id === urlMatchId);
          if (matchFromUrl) return matchFromUrl;
        }

        if (prev) {
          const updated = items.find((m) => m.match_id === prev.match_id);
          return updated || prev;
        }
        return items.length > 0 ? items[0] : null;
      });
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setIsMatchesLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchesList();
    const interval = setInterval(fetchMatchesList, 20000);
    return () => clearInterval(interval);
  }, [urlMatchId]);

  // Real-time WebSocket hook for selected match
  const {
    matchDetail,
    isLoading: isMatchDetailLoading,
    error: matchError,
    isConnected,
    isScoreUpdated,
    refresh: refreshMatchScorecard,
  } = useMatchSocket(
    selectedMatch ? selectedMatch.series_id : null,
    selectedMatch ? selectedMatch.match_id : null
  );

  // Extract unique series list
  const availableSeries = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      if (m.series_name) set.add(m.series_name);
    });
    return Array.from(set);
  }, [matches]);

  // Matches with live video streams available
  const matchesWithStreams = useMemo(() => {
    return matches.filter((m) => m.streams && m.streams.length > 0);
  }, [matches]);

  // Filtered matches for the ticker
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (liveOnly && m.status !== 'LIVE') return false;
      if (selectedSeries !== 'ALL' && m.series_name !== selectedSeries) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t1 = (m.team_1.name || '').toLowerCase();
        const t2 = (m.team_2.name || '').toLowerCase();
        const series = (m.series_name || '').toLowerCase();
        const ground = (m.ground_name || '').toLowerCase();
        if (!t1.includes(q) && !t2.includes(q) && !series.includes(q) && !ground.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [matches, liveOnly, selectedSeries, searchQuery]);

  const liveMatchesCount = useMemo(() => {
    return matches.filter((m) => m.status === 'LIVE').length;
  }, [matches]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0d14] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* 1. Sleek Navigation Bar */}
      <Navbar
        liveOnly={liveOnly}
        onToggleLiveOnly={setLiveOnly}
        selectedSeries={selectedSeries}
        onSelectSeries={setSelectedSeries}
        availableSeries={availableSeries}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isConnected={isConnected}
        liveMatchesCount={liveMatchesCount}
      />

      {/* 2. Top Horizontally Scrollable Match Ticker */}
      <MatchTicker
        matches={filteredMatches}
        selectedMatchId={selectedMatch ? selectedMatch.match_id : null}
        onSelectMatch={(m) => setSelectedMatch(m)}
        isLoading={isMatchesLoading}
      />

      {/* 3. Split-Screen Live Match Center */}
      <main className="flex-1 flex flex-col">
        <MatchCenter
          matchDetail={matchDetail}
          isLoading={isMatchDetailLoading}
          error={matchError}
          isScoreUpdated={isScoreUpdated}
          onRefresh={refreshMatchScorecard}
          onSelectPlayer={(id) => setSelectedPlayerId(id)}
          matchesWithStreams={matchesWithStreams}
          onSwitchMatch={(m) => setSelectedMatch(m)}
        />
      </main>

      {/* 4. Non-Interrupting Player Profile Modal */}
      <PlayerModal
        playerId={selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
      />
    </div>
  );
};

// -----------------------------------------------------------------------------
// MAIN APP ROUTER
// -----------------------------------------------------------------------------
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicMatchCenter />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
