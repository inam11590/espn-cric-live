import React from 'react';
import { MatchSummary } from '../types/cricket';
import { Radio } from 'lucide-react';

interface ScoreBannerProps {
  matches: MatchSummary[];
  activeMatch: MatchSummary | null;
  onSelectMatch: (match: MatchSummary) => void;
}

export const ScoreBanner: React.FC<ScoreBannerProps> = ({ matches, activeMatch, onSelectMatch }) => {
  if (!matches || matches.length === 0) {
    return (
      <div className="w-full p-4 bg-[#121824] border border-[#26334a] rounded-xl text-center text-slate-400 text-sm">
        No live or recent matches scheduled at this time.
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
      {matches.map((m) => {
        const isLive = m.status === 'LIVE';
        const isResult = m.status === 'RESULT';
        const isActive = activeMatch?.match_id === m.match_id;

        return (
          <div
            key={`${m.series_id}-${m.match_id}`}
            onClick={() => onSelectMatch(m)}
            className={`flex-none w-[310px] bg-[#121824] p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
              isActive
                ? 'border-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400'
                : 'border-[#26334a] hover:border-slate-600 hover:-translate-y-0.5'
            }`}
          >
            {/* Top row */}
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded uppercase text-[10px]">
                {m.format || m.match_class || 'CRICKET'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1 ${
                  isLive
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : isResult
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />}
                {m.status}
              </span>
            </div>

            {/* Teams & Scores */}
            <div className="space-y-1.5 mb-2.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2 font-bold text-slate-200">
                  {m.team_1.logo_url ? (
                    <img src={m.team_1.logo_url} alt="" className="w-5 h-5 rounded-full object-cover bg-slate-800" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-xs">🏏</span>
                  )}
                  <span>{m.team_1.abbreviation || m.team_1.name}</span>
                </div>
                <div className="font-mono text-xs font-bold text-white">
                  {m.team_1.score || 'Yet to bat'}{' '}
                  {m.team_1.overs && <span className="text-slate-400 font-normal">({m.team_1.overs} ov)</span>}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2 font-bold text-slate-200">
                  {m.team_2.logo_url ? (
                    <img src={m.team_2.logo_url} alt="" className="w-5 h-5 rounded-full object-cover bg-slate-800" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-xs">🏏</span>
                  )}
                  <span>{m.team_2.abbreviation || m.team_2.name}</span>
                </div>
                <div className="font-mono text-xs font-bold text-white">
                  {m.team_2.score || 'Yet to bat'}{' '}
                  {m.team_2.overs && <span className="text-slate-400 font-normal">({m.team_2.overs} ov)</span>}
                </div>
              </div>
            </div>

            {/* Bottom summary / status text */}
            <div className="pt-2 border-t border-[#1f293d] flex items-center justify-between text-xs">
              <span className="text-amber-400 truncate max-w-[210px] font-medium text-[11px]">
                {m.status_text || m.current_summary || m.series_name}
              </span>
              {m.streams && m.streams.length > 0 && (
                <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-0.5">
                  <Radio className="w-3 h-3" /> {m.streams.length} feeds
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
