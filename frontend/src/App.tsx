import React, { useEffect, useRef, useState } from 'react';
import {
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
  Flame,
  ShieldCheck,
  Server,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { MatchDetail, MatchSummary } from './types/cricket';
import { ScoreBanner } from './components/ScoreBanner';
import { LiveStreamPlayer } from './components/LiveStreamPlayer';
import { ScorecardModal } from './components/ScorecardModal';

export const App: React.FC = () => {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchSummary | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [isScorecardOpen, setIsScorecardOpen] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch live matches list
  const fetchLiveMatches = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/matches/live');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const matchItems = data.matches || [];
      setMatches(matchItems);

      if (matchItems.length > 0 && !activeMatch) {
        selectMatch(matchItems[0]);
      }
    } catch (err) {
      console.error('Error fetching live matches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch match full detail
  const fetchMatchDetail = async (seriesId: number, matchId: number) => {
    try {
      const res = await fetch(`/api/v1/matches/${seriesId}/${matchId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMatchDetail(data);
    } catch (err) {
      console.error('Error fetching match details:', err);
    }
  };

  // Switch active match and connect WebSocket
  const selectMatch = (match: MatchSummary) => {
    setActiveMatch(match);
    fetchMatchDetail(match.series_id, match.match_id);

    // Re-bind WebSocket for real-time live score pushes
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/matches/${match.series_id}/${match.match_id}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'connected' || payload.event === 'score_update') {
          if (payload.data) {
            setMatchDetail(payload.data);
          }
        }
      } catch (e) {
        console.debug('WS parse notice:', e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    fetchLiveMatches();
    const interval = setInterval(fetchLiveMatches, 20000); // 20s polling alignment
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#121824]/90 backdrop-blur-md border-b border-[#26334a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-lg shadow-lg shadow-cyan-500/20">
              🏏
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-white">
                CRIC<span className="text-cyan-400">STREAM</span>
              </span>
              <span className="ml-2 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                PRO
              </span>
            </div>
          </div>

          {/* Right Status Controls */}
          <div className="flex items-center space-x-4">
            {/* WS Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                wsConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{wsConnected ? 'Real-Time Sync' : 'Polling'}</span>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={fetchLiveMatches}
              disabled={isLoading}
              className="p-2 rounded-lg bg-[#182030] border border-[#26334a] text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh Live Scores"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-slate-300 hover:text-cyan-400 px-3 py-1.5 rounded-lg bg-[#182030] border border-[#26334a] transition-colors"
            >
              API Docs ↗
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Live Score Banner */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" /> Matches & Scores
            </h2>
            <span className="text-xs text-slate-500">Auto-refreshed via APScheduler (20s)</span>
          </div>
          <ScoreBanner matches={matches} activeMatch={activeMatch} onSelectMatch={selectMatch} />
        </section>

        {/* Dashboard 2-Column Grid */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Multi-Server Live Player */}
          <div className="lg:col-span-8 space-y-4">
            <LiveStreamPlayer
              matchTitle={
                activeMatch
                  ? `${activeMatch.team_1.name} vs ${activeMatch.team_2.name} - ${activeMatch.title}`
                  : 'Live Cricket Broadcast'
              }
              servers={activeMatch?.streams}
              isLive={activeMatch?.status === 'LIVE'}
            />

            {/* Match Information Bar */}
            {activeMatch && (
              <div className="bg-[#121824] p-4 rounded-xl border border-[#26334a] flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h4 className="font-extrabold text-sm text-white">{activeMatch.series_name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeMatch.ground_name} • {activeMatch.format}
                  </p>
                </div>
                <button
                  onClick={() => setIsScorecardOpen(true)}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-extrabold rounded-lg shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5"
                >
                  <span>Full Scorecard & Stats</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Right Column (4 cols): Match Center & Multi-Server Specs */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Score Overview Card */}
            {activeMatch ? (
              <div className="bg-[#121824] p-5 rounded-xl border border-[#26334a] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Match Center</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    {activeMatch.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-bold text-slate-200">{activeMatch.team_1.name}</span>
                    <span className="font-mono font-bold text-white text-base">
                      {activeMatch.team_1.score || 'Yet to bat'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-bold text-slate-200">{activeMatch.team_2.name}</span>
                    <span className="font-mono font-bold text-white text-base">
                      {activeMatch.team_2.score || 'Yet to bat'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-amber-400 font-semibold bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                  {activeMatch.status_text || activeMatch.current_summary || 'Match currently in progress'}
                </div>
              </div>
            ) : (
              <div className="bg-[#121824] p-6 rounded-xl border border-[#26334a] text-center text-slate-400 text-sm">
                Select a match from the ticker above
              </div>
            )}

            {/* Attached Video Stream Servers Card */}
            <div className="bg-[#121824] p-5 rounded-xl border border-[#26334a] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-cyan-400" /> Available Video Feeds
                </span>
                <span className="text-[11px] text-slate-500">
                  {activeMatch?.streams?.length || 0} active
                </span>
              </div>

              <div className="space-y-2">
                {(activeMatch?.streams || []).map((srv, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[#182030] border border-[#26334a]"
                  >
                    <div>
                      <div className="font-bold text-white">{srv.server_name}</div>
                      <div className="text-[10px] text-cyan-400 font-mono uppercase">{srv.stream_type}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                      {srv.quality}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2 Engine Architecture Card */}
            <div className="bg-[#121824] p-5 rounded-xl border border-[#26334a] space-y-3 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Streaming Engine Spec
              </span>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-center justify-between">
                  <span className="text-slate-400">HLS Engine:</span>
                  <span className="font-semibold text-white">hls.js (Low Latency)</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-400">CORS Proxy:</span>
                  <span className="font-semibold text-cyan-400">/api/v1/proxy/hls</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-400">Failover Mode:</span>
                  <span className="font-semibold text-emerald-400">Auto Server Fallback</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-400">Score Sync:</span>
                  <span className="font-semibold text-white">WebSocket Push</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Scorecard Modal */}
      <ScorecardModal
        detail={matchDetail}
        isOpen={isScorecardOpen}
        onClose={() => setIsScorecardOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-[#26334a] bg-[#0e131d] py-4 text-center text-xs text-slate-500">
        Live Cricket Streaming & Live Score App • Step 2: Multi-Server Video Engine & CORS Proxy
      </footer>
    </div>
  );
};
export default App;
