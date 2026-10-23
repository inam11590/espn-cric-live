import React, { useState } from 'react';
import {
  Tv,
  Radio,
  Flame,
  Shield,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  User,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Trophy,
  MessageSquare,
} from 'lucide-react';
import { MatchDetail, MatchSummary, BattingEntry, BowlingEntry } from '../types/cricket';
import { LiveStreamPlayer } from '../components/LiveStreamPlayer';
import { useChatSocket } from '../hooks/useChatSocket';
import { ReactionOverlay } from '../components/chat/ReactionOverlay';
import { LiveChatPanel } from '../components/chat/LiveChatPanel';
import { MatchPollWidget } from '../components/chat/MatchPollWidget';

interface MatchCenterProps {
  matchDetail: MatchDetail | null;
  isLoading: boolean;
  error: string | null;
  isScoreUpdated: boolean;
  onRefresh: () => void;
  onSelectPlayer: (playerId: number) => void;
  matchesWithStreams: MatchSummary[];
  onSwitchMatch: (m: MatchSummary) => void;
}

export const MatchCenter: React.FC<MatchCenterProps> = ({
  matchDetail,
  isLoading,
  error,
  isScoreUpdated,
  onRefresh,
  onSelectPlayer,
  matchesWithStreams,
  onSwitchMatch,
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'scorecard' | 'info' | 'chat'>('live');
  const [expandedInnings, setExpandedInnings] = useState<number[]>([1, 2]);

  // Real-time Chat, Flying Reactions & Match Polls
  const {
    identity,
    setNickname,
    messages,
    viewerCount,
    reactions,
    polls,
    rateLimitSeconds,
    sendMessage,
    sendReaction,
    votePoll,
  } = useChatSocket(
    matchDetail?.series_id ?? null,
    matchDetail?.match_id ?? null
  );

  const toggleInnings = (innNum: number) => {
    if (expandedInnings.includes(innNum)) {
      setExpandedInnings(expandedInnings.filter((n) => n !== innNum));
    } else {
      setExpandedInnings([...expandedInnings, innNum]);
    }
  };

  if (isLoading && !matchDetail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Connecting to match broadcast & scorecard stream...</p>
      </div>
    );
  }

  if (error && !matchDetail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 max-w-md">
          <p className="text-rose-400 font-semibold mb-2">{error}</p>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!matchDetail) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-500 text-sm">
        Select a match from the top ticker to enter the Match Center.
      </div>
    );
  }

  // Calculate current run rates
  const currentInnings =
    matchDetail.innings && matchDetail.innings.length > 0
      ? matchDetail.innings[matchDetail.innings.length - 1]
      : null;

  const activeBatters: BattingEntry[] = currentInnings
    ? currentInnings.batting.filter((b) => b.batted && !b.is_out)
    : [];

  const activeBowlers: BowlingEntry[] = currentInnings
    ? currentInnings.bowling.filter((b) => (b.overs || 0) > 0)
    : [];
  const currentBowler = activeBowlers.length > 0 ? activeBowlers[activeBowlers.length - 1] : null;

  const hasStreams = Boolean(matchDetail.streams && matchDetail.streams.length > 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090d16]">
      {/* ------------------------------------------------------------------ */}
      {/* 1. STICKY BROADCAST MATCH SCORE HEADER                             */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={`sticky top-[53px] z-30 bg-[#0c111c]/95 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 py-3 transition-colors duration-500 ${
          isScoreUpdated
            ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-500/10'
            : ''
        }`}
      >
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Match & Venue Details */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <span className="text-emerald-400">{matchDetail.format || 'Cricket'}</span>
              <span className="text-slate-600">•</span>
              <span className="truncate max-w-[240px] md:max-w-md">{matchDetail.series_name}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span>{matchDetail.match_title}</span>
              {matchDetail.ground_name && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {matchDetail.ground_name}
                    {matchDetail.town_name ? `, ${matchDetail.town_name}` : ''}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Teams Live Scoreboards */}
          <div className="flex items-center gap-6 sm:gap-10">
            {/* Team 1 */}
            <div className="text-right">
              <div className="text-xs sm:text-sm font-bold text-slate-200">
                {matchDetail.team_1.abbreviation || matchDetail.team_1.name}
              </div>
              <div className="text-base sm:text-lg font-black text-white font-mono">
                {matchDetail.team_1.score || 'Yet to bat'}
              </div>
            </div>

            <div className="text-xs font-bold text-slate-600 uppercase">VS</div>

            {/* Team 2 */}
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-slate-200">
                {matchDetail.team_2.abbreviation || matchDetail.team_2.name}
              </div>
              <div className="text-base sm:text-lg font-black text-white font-mono">
                {matchDetail.team_2.score || 'Yet to bat'}
              </div>
            </div>
          </div>

          {/* Status, Target & Rates */}
          <div className="flex items-center gap-3">
            <div className="text-center md:text-right">
              <div className="flex items-center justify-center md:justify-end gap-1.5">
                {matchDetail.status === 'LIVE' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    LIVE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                    {matchDetail.status}
                  </span>
                )}
                {currentInnings && (
                  <span className="text-xs text-slate-400 font-mono">
                    CRR: <strong className="text-emerald-400">{currentInnings.run_rate}</strong>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[260px]">
                {matchDetail.status_text || matchDetail.description}
              </p>
            </div>

            <button
              onClick={onRefresh}
              title="Refresh scorecard"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. SPLIT BROADCAST CONTENT AREA                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="max-w-[1720px] mx-auto w-full p-3 sm:p-4 lg:p-6 flex-1 flex flex-col xl:flex-row gap-6">
        {/* ================================================================ */}
        {/* LEFT / PRIMARY COLUMN: VIDEO STREAM / LIVE BROADCAST PITCH       */}
        {/* ================================================================ */}
        <div className="flex-1 flex flex-col min-w-0">
          {hasStreams ? (
            <div className="w-full">
              <LiveStreamPlayer
                servers={matchDetail.streams}
                matchTitle={`${matchDetail.team_1.name} vs ${matchDetail.team_2.name}`}
              />
            </div>
          ) : (
            /* Broadcast Pitch Graphic when no stream attached yet */
            <div className="w-full aspect-video rounded-2xl bg-gradient-to-b from-[#111728] via-[#0d1320] to-[#0a0e17] border border-slate-800 p-6 flex flex-col items-center justify-between text-center relative overflow-hidden shadow-2xl">
              {/* Pitch grid graphic lines */}
              <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />

              {/* Pitch Visualizer Banner */}
              <div className="relative z-10 w-full flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800/80 text-slate-200 border border-slate-700">
                  <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                  Live Pitch & Ball Tracker
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {matchDetail.ground_name || 'Ground Center'}
                </span>
              </div>

              {/* Center Cricket Graphic */}
              <div className="relative z-10 flex flex-col items-center max-w-md my-auto">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl mb-3 shadow-lg shadow-emerald-500/10">
                  🏏
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Live Match Telecast In Progress
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Direct digital video feed is not attached to this match yet. Real-time scores and
                  ball-by-ball updates are active via python-espncricinfo.
                </p>

                {/* Quick switch to matches with live stream */}
                {matchesWithStreams.length > 0 && (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 w-full text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                      <Tv className="w-3 h-3 text-indigo-400" /> Matches With Live Video:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {matchesWithStreams.map((sw) => (
                        <button
                          key={sw.match_id}
                          onClick={() => onSwitchMatch(sw)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 hover:bg-indigo-500/30 text-indigo-300 text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <span>{sw.team_1.abbreviation} vs {sw.team_2.abbreviation}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pitch status footer */}
              <div className="relative z-10 w-full flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
                <span>Toss: {matchDetail.toss_decision || 'Standard rules apply'}</span>
                <span>Weather: Clear • Pitch: Dry</span>
              </div>
            </div>
          )}

          {/* Real-Time Flying Emoji Reactions Dock */}
          <div className="mt-3">
            <ReactionOverlay
              reactions={reactions}
              onSendReaction={sendReaction}
            />
          </div>

          {/* Quick Match Note Below Video */}
          <div className="mt-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800/70 text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-300 font-medium">
                {matchDetail.status_text || 'Match in active state.'}
              </span>
            </div>
            {matchDetail.toss_decision && (
              <span className="text-slate-400 text-[11px]">
                Toss: <strong className="text-slate-300">{matchDetail.toss_decision}</strong>
              </span>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT / SECONDARY COLUMN: TABBED SCORECARD & STATS PANEL         */}
        {/* ================================================================ */}
        <div className="w-full xl:w-[480px] 2xl:w-[540px] flex flex-col bg-slate-900/80 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 p-1">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'live'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${activeTab === 'live' ? 'text-rose-400 animate-pulse' : ''}`} />
              Live Feed
            </button>

            <button
              onClick={() => setActiveTab('scorecard')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'scorecard'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              Full Scorecard
            </button>

            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'info'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              Info & Squads
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              }`}
            >
              <MessageSquare className={`w-3.5 h-3.5 ${activeTab === 'chat' ? 'text-emerald-400' : ''}`} />
              <span>Live Chat</span>
              {viewerCount > 0 && (
                <span className="text-[10px] font-mono px-1 rounded-full bg-emerald-500/20 text-emerald-300">
                  {viewerCount}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content Area */}
          {activeTab === 'chat' ? (
            <div className="h-[680px]">
              <LiveChatPanel
                messages={messages}
                viewerCount={viewerCount}
                nickname={identity.nickname}
                avatarColor={identity.color}
                rateLimitSeconds={rateLimitSeconds}
                polls={polls}
                onSendMessage={sendMessage}
                onSetNickname={setNickname}
                onVotePoll={votePoll}
                className="h-full border-none rounded-none shadow-none"
              />
            </div>
          ) : (
          <div className="p-4 overflow-y-auto max-h-[680px] space-y-4 text-xs text-slate-300">
            {/* ------------------------------------------------------------ */}
            {/* TAB 1: LIVE BATTERS, BOWLER & PARTNERSHIP                    */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'live' && (
              <div className="space-y-4">
                {/* Active Batters at Crease */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <span>Batters at the Crease</span>
                    <span>Click player for bio</span>
                  </div>
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    <table className="w-full text-left">
                      <thead className="bg-slate-850 text-[10px] uppercase text-slate-400">
                        <tr>
                          <th className="py-2 px-3">Batter</th>
                          <th className="py-2 px-2 text-right">R</th>
                          <th className="py-2 px-2 text-right">B</th>
                          <th className="py-2 px-2 text-right">4s</th>
                          <th className="py-2 px-2 text-right">6s</th>
                          <th className="py-2 px-3 text-right">SR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                        {activeBatters.length > 0 ? (
                          activeBatters.map((b, idx) => (
                            <tr key={b.player_id || idx} className="hover:bg-slate-800/40 transition">
                              <td className="py-2.5 px-3 font-sans font-semibold text-slate-100 flex items-center gap-1.5">
                                <button
                                  onClick={() => b.player_id && onSelectPlayer(b.player_id)}
                                  className="hover:text-emerald-400 hover:underline text-left truncate max-w-[130px]"
                                >
                                  {b.name}
                                </button>
                                {idx === 0 && <span className="text-emerald-400 font-bold">*</span>}
                              </td>
                              <td className="py-2.5 px-2 text-right font-bold text-white">
                                {b.runs ?? 0}
                              </td>
                              <td className="py-2.5 px-2 text-right text-slate-400">{b.balls ?? 0}</td>
                              <td className="py-2.5 px-2 text-right text-slate-400">{b.fours ?? 0}</td>
                              <td className="py-2.5 px-2 text-right text-slate-400">{b.sixes ?? 0}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                                {b.strike_rate ? b.strike_rate.toFixed(1) : '-'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-500 font-sans">
                              Innings completed or lineup pending.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Active Bowler */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Active Bowler
                  </div>
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    <table className="w-full text-left">
                      <thead className="bg-slate-850 text-[10px] uppercase text-slate-400">
                        <tr>
                          <th className="py-2 px-3">Bowler</th>
                          <th className="py-2 px-2 text-right">O</th>
                          <th className="py-2 px-2 text-right">M</th>
                          <th className="py-2 px-2 text-right">R</th>
                          <th className="py-2 px-2 text-right">W</th>
                          <th className="py-2 px-3 text-right">ECON</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                        {currentBowler ? (
                          <tr className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-100">
                              <button
                                onClick={() =>
                                  currentBowler.player_id && onSelectPlayer(currentBowler.player_id)
                                }
                                className="hover:text-emerald-400 hover:underline text-left truncate max-w-[130px]"
                              >
                                {currentBowler.name}
                              </button>
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-300">
                              {currentBowler.overs}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-400">
                              {currentBowler.maidens ?? 0}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-300">
                              {currentBowler.runs ?? 0}
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold text-amber-400">
                              {currentBowler.wickets ?? 0}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-300">
                              {currentBowler.economy ? currentBowler.economy.toFixed(2) : '-'}
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-500 font-sans">
                              Bowler details not yet available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Over Timeline Visualizer */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <span>Recent Delivery Sequence</span>
                    <span className="text-emerald-400 font-mono">This Over</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {['1', '0', '4', '2', 'W', '1'].map((ball, i) => (
                      <span
                        key={i}
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          ball === 'W'
                            ? 'bg-rose-500 text-white'
                            : ball === '4' || ball === '6'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {ball}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Live Match Prediction Polls */}
                {polls.length > 0 && (
                  <div className="pt-2">
                    <MatchPollWidget polls={polls} onVote={votePoll} />
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* TAB 2: FULL SCORECARD WITH INNINGS ACCORDIONS               */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'scorecard' && (
              <div className="space-y-4">
                {matchDetail.innings.map((inn) => {
                  const isExpanded = expandedInnings.includes(inn.innings_number);
                  return (
                    <div
                      key={inn.innings_number}
                      className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40"
                    >
                      {/* Innings Accordion Header */}
                      <button
                        onClick={() => toggleInnings(inn.innings_number)}
                        className="w-full px-4 py-3 bg-slate-850 hover:bg-slate-800 flex items-center justify-between transition text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{inn.team_name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {inn.runs}/{inn.wickets} ({inn.overs} ov)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="text-[11px] font-mono">RR: {inn.run_rate}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {/* Innings Details */}
                      {isExpanded && (
                        <div className="p-3 space-y-3">
                          {/* Batting Scorecard Table */}
                          <div className="border border-slate-800/80 rounded-lg overflow-hidden">
                            <table className="w-full text-left">
                              <thead className="bg-slate-900 text-[10px] uppercase text-slate-400">
                                <tr>
                                  <th className="py-2 px-3">Batter</th>
                                  <th className="py-2 px-2 text-right">R</th>
                                  <th className="py-2 px-2 text-right">B</th>
                                  <th className="py-2 px-2 text-right">4s</th>
                                  <th className="py-2 px-2 text-right">6s</th>
                                  <th className="py-2 px-3 text-right">SR</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                                {inn.batting.map((b, idx) => (
                                  <tr key={b.player_id || idx} className="hover:bg-slate-850/40 transition">
                                    <td className="py-2 px-3 font-sans">
                                      <button
                                        onClick={() => b.player_id && onSelectPlayer(b.player_id)}
                                        className="font-semibold text-slate-200 hover:text-emerald-400 hover:underline text-left block truncate max-w-[150px]"
                                      >
                                        {b.name}
                                      </button>
                                      {b.dismissal && (
                                        <span className="text-[10px] text-slate-400 block truncate max-w-[150px] font-sans">
                                          {b.dismissal}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-2 text-right font-bold text-white">
                                      {b.runs ?? 0}
                                    </td>
                                    <td className="py-2 px-2 text-right text-slate-400">{b.balls ?? 0}</td>
                                    <td className="py-2 px-2 text-right text-slate-400">{b.fours ?? 0}</td>
                                    <td className="py-2 px-2 text-right text-slate-400">{b.sixes ?? 0}</td>
                                    <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                                      {b.strike_rate ? b.strike_rate.toFixed(1) : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Extras line */}
                          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
                            <span>
                              Extras: <strong className="text-slate-200">{inn.extras}</strong> (b {inn.byes}, lb{' '}
                              {inn.legbyes}, w {inn.wides}, nb {inn.noballs})
                            </span>
                            <span>
                              Total: <strong className="text-white">{inn.runs}/{inn.wickets}</strong>
                            </span>
                          </div>

                          {/* Bowling Scorecard Table */}
                          <div className="border border-slate-800/80 rounded-lg overflow-hidden">
                            <table className="w-full text-left">
                              <thead className="bg-slate-900 text-[10px] uppercase text-slate-400">
                                <tr>
                                  <th className="py-2 px-3">Bowler</th>
                                  <th className="py-2 px-2 text-right">O</th>
                                  <th className="py-2 px-2 text-right">M</th>
                                  <th className="py-2 px-2 text-right">R</th>
                                  <th className="py-2 px-2 text-right">W</th>
                                  <th className="py-2 px-3 text-right">ECON</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                                {inn.bowling.map((bw, idx) => (
                                  <tr key={bw.player_id || idx} className="hover:bg-slate-850/40 transition">
                                    <td className="py-2 px-3 font-sans">
                                      <button
                                        onClick={() => bw.player_id && onSelectPlayer(bw.player_id)}
                                        className="font-semibold text-slate-200 hover:text-emerald-400 hover:underline text-left block truncate max-w-[150px]"
                                      >
                                        {bw.name}
                                      </button>
                                    </td>
                                    <td className="py-2 px-2 text-right text-slate-300">{bw.overs}</td>
                                    <td className="py-2 px-2 text-right text-slate-400">{bw.maidens ?? 0}</td>
                                    <td className="py-2 px-2 text-right text-slate-300">{bw.runs ?? 0}</td>
                                    <td className="py-2 px-2 text-right font-bold text-amber-400">
                                      {bw.wickets ?? 0}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-300">
                                      {bw.economy ? bw.economy.toFixed(2) : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* TAB 3: MATCH INFO & PLAYING XI SQUADS                        */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'info' && (
              <div className="space-y-4">
                {/* Match Information Summary */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Fixture Metadata
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Series</span>
                      <span className="text-slate-200 font-semibold">{matchDetail.series_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Match</span>
                      <span className="text-slate-200 font-semibold">{matchDetail.match_title}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Venue</span>
                      <span className="text-slate-200 font-semibold">
                        {matchDetail.ground_name}
                        {matchDetail.town_name ? `, ${matchDetail.town_name}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Toss</span>
                      <span className="text-slate-200 font-semibold">
                        {matchDetail.toss_decision || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Team 1 Squad */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  <div className="px-3 py-2 bg-slate-850 font-bold text-white text-xs flex justify-between">
                    <span>{matchDetail.team_1.name} Playing XI</span>
                    <span className="text-slate-400">{matchDetail.team_1.players.length} Players</span>
                  </div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchDetail.team_1.players.map((p) => (
                      <button
                        key={p.player_id}
                        onClick={() => onSelectPlayer(p.player_id)}
                        className="text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800/80 transition flex items-center justify-between"
                      >
                        <div className="truncate pr-1">
                          <span className="font-semibold text-slate-200 hover:text-emerald-400 block truncate">
                            {p.name} {p.is_captain ? '(c)' : ''} {p.is_keeper ? '(wk)' : ''}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">{p.role}</span>
                        </div>
                        <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Team 2 Squad */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  <div className="px-3 py-2 bg-slate-850 font-bold text-white text-xs flex justify-between">
                    <span>{matchDetail.team_2.name} Playing XI</span>
                    <span className="text-slate-400">{matchDetail.team_2.players.length} Players</span>
                  </div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchDetail.team_2.players.map((p) => (
                      <button
                        key={p.player_id}
                        onClick={() => onSelectPlayer(p.player_id)}
                        className="text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800/80 transition flex items-center justify-between"
                      >
                        <div className="truncate pr-1">
                          <span className="font-semibold text-slate-200 hover:text-emerald-400 block truncate">
                            {p.name} {p.is_captain ? '(c)' : ''} {p.is_keeper ? '(wk)' : ''}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">{p.role}</span>
                        </div>
                        <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
