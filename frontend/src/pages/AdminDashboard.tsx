import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  Tv,
  Radio,
  LogOut,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Play,
  Activity,
  Layers,
  ArrowLeft,
  Search,
  AlertTriangle,
  Globe,
  Sliders,
} from 'lucide-react';
import { LiveStreamPlayer } from '../components/LiveStreamPlayer';
import { StreamServer, StreamType } from '../types/cricket';

interface AdminMatch {
  match_id: number;
  series_id: number;
  title: string;
  series_name: string;
  status: string;
  status_text?: string;
  format?: string;
  team_1: { name: string; abbreviation?: string; score?: string };
  team_2: { name: string; abbreviation?: string; score?: string };
  streams: StreamServer[];
}

interface TestStreamResult {
  success: boolean;
  status_code: number;
  latency_ms: number;
  content_type?: string;
  is_valid_hls?: boolean;
  message: string;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('cricstream_admin_token');
  const adminUser = localStorage.getItem('cricstream_admin_user') || 'admin';

  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<AdminMatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // New Stream Form state
  const [newServerName, setNewServerName] = useState('HD Broadcast Feed 1');
  const [newStreamType, setNewStreamType] = useState<StreamType>('hls');
  const [newStreamUrl, setNewStreamUrl] = useState('');
  const [newReferer, setNewReferer] = useState('');
  const [newQuality, setNewQuality] = useState('1080p');
  const [newPriority, setNewPriority] = useState(1);
  const [newIsActive, setNewIsActive] = useState(true);

  // Testing & Preview state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestStreamResult | null>(null);
  const [previewStream, setPreviewStream] = useState<StreamServer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Match Modal state
  const [isCustomMatchOpen, setIsCustomMatchOpen] = useState(false);
  const [customTeam1, setCustomTeam1] = useState('');
  const [customTeam2, setCustomTeam2] = useState('');
  const [customTitle, setCustomTitle] = useState('Exhibition Match');
  const [customSeries, setCustomSeries] = useState('Custom Cricket League');
  const [customMatchId, setCustomMatchId] = useState(Math.floor(100000 + Math.random() * 900000));
  const [customSeriesId, setCustomSeriesId] = useState(Math.floor(100000 + Math.random() * 900000));
  const [customStatus, setCustomStatus] = useState('LIVE');

  // Verify auth on mount
  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }
    fetchMatches();
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('cricstream_admin_token');
    localStorage.removeItem('cricstream_admin_user');
    navigate('/admin/login');
  };

  const fetchMatches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/matches', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (!res.ok) throw new Error('Failed to load matches list');
      const data = await res.json();
      const matchItems: AdminMatch[] = data.matches || [];
      setMatches(matchItems);

      // Preserve or set default selection
      setSelectedMatch((prev) => {
        if (prev) {
          const found = matchItems.find((m) => m.match_id === prev.match_id);
          return found || matchItems[0] || null;
        }
        return matchItems[0] || null;
      });
    } catch (err: any) {
      setError(err.message || 'Unable to fetch matches');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered matches list for left panel
  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return matches;
    const q = searchQuery.toLowerCase();
    return matches.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.team_1.name.toLowerCase().includes(q) ||
        m.team_2.name.toLowerCase().includes(q) ||
        m.series_name.toLowerCase().includes(q)
    );
  }, [matches, searchQuery]);

  // Toggle stream server active status
  const toggleStreamActive = async (streamId: number, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/v1/admin/streams/${streamId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle stream state');
      await fetchMatches();
    } catch (err: any) {
      alert(`Error toggling stream: ${err.message}`);
    }
  };

  // Delete stream server
  const deleteStream = async (streamId: number, serverName: string) => {
    if (!window.confirm(`Delete stream server "${serverName}"? This takes effect immediately.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/streams/${streamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete stream');
      await fetchMatches();
    } catch (err: any) {
      alert(`Error deleting stream: ${err.message}`);
    }
  };

  // Test stream URL health check
  const handleTestStream = async (urlOverride?: string, refererOverride?: string) => {
    const targetUrl = urlOverride || newStreamUrl;
    const targetReferer = refererOverride !== undefined ? refererOverride : newReferer;

    if (!targetUrl.trim()) {
      alert('Please enter a valid Stream URL to test.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/v1/admin/streams/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stream_url: targetUrl,
          referer: targetReferer || undefined,
          use_proxy: newStreamType === 'proxy_hls',
        }),
      });

      const data: TestStreamResult = await res.json();
      setTestResult(data);

      // Mount preview player if test succeeded or if it's an iframe
      if (data.success || newStreamType === 'iframe') {
        setPreviewStream({
          server_name: newServerName || 'Preview Feed',
          stream_type: newStreamType,
          stream_url: targetUrl,
          referer: targetReferer || undefined,
          quality: newQuality,
          is_active: true,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        status_code: 500,
        latency_ms: 0,
        message: err.message || 'Stream test request failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Add new stream server
  const handleAddStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch) return;
    if (!newStreamUrl.trim()) {
      alert('Please provide a stream URL.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/admin/matches/${selectedMatch.series_id}/${selectedMatch.match_id}/streams`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            server_name: newServerName,
            stream_type: newStreamType,
            stream_url: newStreamUrl,
            referer: newReferer || undefined,
            quality: newQuality,
            priority_order: Number(newPriority),
            is_active: newIsActive,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to add stream server');
      }

      // Reset form & test state
      setNewStreamUrl('');
      setNewReferer('');
      setTestResult(null);
      setPreviewStream(null);
      await fetchMatches();
    } catch (err: any) {
      alert(`Error adding stream server: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create custom exhibition match
  const handleCreateCustomMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTeam1 || !customTeam2) {
      alert('Please provide names for both teams.');
      return;
    }

    try {
      const res = await fetch('/api/v1/admin/matches/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          match_id: customMatchId,
          series_id: customSeriesId,
          match_title: customTitle,
          team_1_name: customTeam1,
          team_2_name: customTeam2,
          series_name: customSeries,
          status: customStatus,
        }),
      });

      if (!res.ok) throw new Error('Failed to create custom match');
      setIsCustomMatchOpen(false);
      // Reset form
      setCustomTeam1('');
      setCustomTeam2('');
      setCustomMatchId(Math.floor(100000 + Math.random() * 900000));
      setCustomSeriesId(Math.floor(100000 + Math.random() * 900000));
      await fetchMatches();
    } catch (err: any) {
      alert(`Error creating custom match: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans">
      {/* ------------------------------------------------------------------ */}
      {/* TOP ADMIN NAVBAR                                                   */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 bg-[#0c1220]/95 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 py-2.5">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Go to Live Site"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black tracking-tight text-white">
                    CricStream<span className="text-emerald-400">Admin</span>
                  </h1>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    SECURE CONSOLE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  Live Stream Server Injection & Real-Time WebSocket Controller
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick public site button */}
            <Link
              to="/"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              <span>View Public Center</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            {/* Refresh button */}
            <button
              onClick={fetchMatches}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Refresh matches"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Admin identity pill */}
            <div className="hidden md:flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-semibold">{adminUser}</span>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 text-xs font-semibold transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN TWO-COLUMN WORKSPACE                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="max-w-[1720px] mx-auto w-full p-4 lg:p-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* ================================================================ */}
        {/* LEFT PANEL: MATCH SELECTOR & CUSTOM MATCH TRIGGER                */}
        {/* ================================================================ */}
        <div className="w-full lg:w-[380px] flex-shrink-0 flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl max-h-[820px]">
          {/* Header & Search */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Live & Upcoming Fixtures
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                {matches.length}
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter match or team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            {/* Custom Match button */}
            <button
              onClick={() => setIsCustomMatchOpen(true)}
              className="w-full py-2 px-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 hover:bg-indigo-500/25 text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Create Custom / Exhibition Match
            </button>
          </div>

          {/* Match Cards List */}
          <div className="p-3 overflow-y-auto divide-y divide-slate-850/60 space-y-2 flex-1">
            {isLoading && matches.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span>Scanning Cricinfo & DB for matches...</span>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No matches found matching filter.
              </div>
            ) : (
              filteredMatches.map((m) => {
                const isSelected = selectedMatch?.match_id === m.match_id;
                const streamCount = m.streams ? m.streams.length : 0;
                const activeCount = m.streams ? m.streams.filter((s) => s.is_active).length : 0;

                return (
                  <div
                    key={m.match_id}
                    onClick={() => {
                      setSelectedMatch(m);
                      setTestResult(null);
                      setPreviewStream(null);
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition-all border text-left ${
                      isSelected
                        ? 'bg-slate-850 border-emerald-500/80 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-900/60 hover:bg-slate-850/60 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-semibold uppercase truncate max-w-[190px]">
                        {m.series_name || m.format}
                      </span>
                      {m.status === 'LIVE' ? (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          LIVE
                        </span>
                      ) : (
                        <span className="text-slate-400">{m.status}</span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-white mb-1.5">
                      {m.team_1.abbreviation || m.team_1.name} vs{' '}
                      {m.team_2.abbreviation || m.team_2.name}
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono text-[10px]">
                        ID: {m.match_id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          streamCount > 0
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {streamCount > 0
                          ? `${activeCount}/${streamCount} Active Streams`
                          : 'No Streams'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT PANEL: STREAM MANAGEMENT & LIVE TESTER                     */}
        {/* ================================================================ */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          {selectedMatch ? (
            <>
              {/* Selected Match Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                      {selectedMatch.format || 'Cricket'}
                    </span>
                    <span className="text-xs text-slate-400 truncate max-w-md">
                      {selectedMatch.series_name}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-white">
                    {selectedMatch.team_1.name} vs {selectedMatch.team_2.name}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                    <span>Series: {selectedMatch.series_id}</span>
                    <span>•</span>
                    <span>Match: {selectedMatch.match_id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/?match=${selectedMatch.match_id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition"
                  >
                    <span>Inspect Public Center</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* ---------------------------------------------------------- */}
              {/* Configured Streams List                                    */}
              {/* ---------------------------------------------------------- */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Configured Video Stream Servers
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    {selectedMatch.streams.length} server(s) configured
                  </span>
                </div>

                {selectedMatch.streams.length === 0 ? (
                  <div className="py-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-xl text-slate-400 text-xs">
                    <Tv className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">No streams attached yet</p>
                    <p className="text-[11px] mt-0.5">
                      Use the form below to attach an .m3u8 HLS or iframe stream server.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedMatch.streams.map((server) => (
                      <div
                        key={server.id}
                        className={`p-3.5 rounded-xl border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                          server.is_active
                            ? 'bg-slate-950/60 border-slate-800'
                            : 'bg-slate-950/30 border-slate-850 opacity-60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-white text-xs">
                              {server.server_name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                              {server.stream_type}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-400">
                              {server.quality}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate max-w-xl">
                            {server.stream_url}
                          </p>
                          {server.referer && (
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              Referer: {server.referer}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end">
                          {/* Test button */}
                          <button
                            onClick={() => handleTestStream(server.stream_url, server.referer)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1"
                            title="Test stream health"
                          >
                            <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Test</span>
                          </button>

                          {/* Toggle Active Switch */}
                          <button
                            onClick={() => server.id && toggleStreamActive(server.id, server.is_active)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                              server.is_active
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                server.is_active ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            <span>{server.is_active ? 'Active' : 'Disabled'}</span>
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => server.id && deleteStream(server.id, server.server_name)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                            title="Delete stream server"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ---------------------------------------------------------- */}
              {/* Add New Stream Server Form                                 */}
              {/* ---------------------------------------------------------- */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Attach New Stream Server</h3>
                </div>

                <form onSubmit={handleAddStream} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Server Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Server Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newServerName}
                        onChange={(e) => setNewServerName(e.target.value)}
                        placeholder="e.g. Star Sports 1 HD"
                        className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Stream Type */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Stream Type
                      </label>
                      <select
                        value={newStreamType}
                        onChange={(e) => setNewStreamType(e.target.value as StreamType)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="hls">Direct HLS (.m3u8)</option>
                        <option value="proxy_hls">Proxied HLS (CORS Bypass)</option>
                        <option value="iframe">Iframe Embed URL</option>
                      </select>
                    </div>

                    {/* Quality */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Quality Label
                      </label>
                      <select
                        value={newQuality}
                        onChange={(e) => setNewQuality(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="1080p">1080p FHD</option>
                        <option value="720p">720p HD</option>
                        <option value="480p">480p SD</option>
                        <option value="Auto">Auto Adaptive</option>
                      </select>
                    </div>
                  </div>

                  {/* Stream URL */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Stream / Embed URL
                    </label>
                    <input
                      type="url"
                      required
                      value={newStreamUrl}
                      onChange={(e) => setNewStreamUrl(e.target.value)}
                      placeholder="https://example.com/live/stream.m3u8 or https://youtube.com/embed/..."
                      className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Optional Headers */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Custom Referer Header (Optional)
                      </label>
                      <input
                        type="text"
                        value={newReferer}
                        onChange={(e) => setNewReferer(e.target.value)}
                        placeholder="https://official-broadcaster.com"
                        className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Priority Order
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={newPriority}
                        onChange={(e) => setNewPriority(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Test Result Pill */}
                  {testResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                        testResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        )}
                        <span>{testResult.message}</span>
                      </div>
                      <span className="font-mono text-[11px] font-bold bg-slate-900/60 px-2 py-0.5 rounded">
                        {testResult.latency_ms}ms
                      </span>
                    </div>
                  )}

                  {/* Compact Preview Player */}
                  {previewStream && (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                          Live Stream Preview
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Confirming video playback before saving
                        </span>
                      </div>
                      <div className="max-w-2xl mx-auto">
                        <LiveStreamPlayer
                          servers={[previewStream]}
                          matchTitle="Admin Live Stream Preview"
                        />
                      </div>
                    </div>
                  )}

                  {/* Form Action Buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTestStream()}
                      disabled={isTesting || !newStreamUrl}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>{isTesting ? 'Testing Health...' : 'Test & Preview Stream'}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting || !newStreamUrl}
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Save & Broadcast Stream</span>
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500 text-sm">
              <Tv className="w-12 h-12 text-slate-700 mb-2" />
              <span>Select a match on the left panel to configure its live stream servers.</span>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CUSTOM MATCH CREATION MODAL                                        */}
      {/* ------------------------------------------------------------------ */}
      {isCustomMatchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCustomMatchOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-[#0e1422] border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Create Custom Exhibition Match</h3>
              </div>
              <button
                onClick={() => setIsCustomMatchOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomMatch} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Team 1 Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lahore Qalandars"
                  value={customTeam1}
                  onChange={(e) => setCustomTeam1(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Team 2 Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karachi Kings"
                  value={customTeam2}
                  onChange={(e) => setCustomTeam2(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Match Title
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="LIVE">LIVE</option>
                    <option value="UPCOMING">UPCOMING</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Series / Tournament Name
                </label>
                <input
                  type="text"
                  value={customSeries}
                  onChange={(e) => setCustomSeries(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomMatchOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Create Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
