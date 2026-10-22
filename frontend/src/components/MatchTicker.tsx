import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Video, Flame, ShieldAlert } from 'lucide-react';
import { MatchSummary } from '../types/cricket';

interface MatchTickerProps {
  matches: MatchSummary[];
  selectedMatchId: number | null;
  onSelectMatch: (match: MatchSummary) => void;
  isLoading?: boolean;
}

export const MatchTicker: React.FC<MatchTickerProps> = ({
  matches,
  selectedMatchId,
  onSelectMatch,
  isLoading = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (isLoading && matches.length === 0) {
    return (
      <div className="bg-[#0b0f19] border-b border-slate-800/80 px-4 py-3">
        <div className="flex gap-3 overflow-x-hidden">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="min-w-[280px] h-28 rounded-xl bg-slate-900/60 animate-pulse border border-slate-800/50"
            />
          ))}
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-[#0b0f19] border-b border-slate-800/80 px-4 py-3 text-center text-xs text-slate-400">
        No matches match the selected criteria.
      </div>
    );
  }

  return (
    <div className="relative bg-[#0b0f19] border-b border-slate-800/80 px-2 lg:px-4 py-2.5">
      {/* Scroll controls */}
      <button
        onClick={() => scroll('left')}
        aria-label="Scroll left"
        className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-slate-900/90 border border-slate-700/80 items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 shadow-md transition"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        onClick={() => scroll('right')}
        aria-label="Scroll right"
        className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-slate-900/90 border border-slate-700/80 items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 shadow-md transition"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Cards Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth px-1 md:px-7 py-0.5"
      >
        {matches.map((m) => {
          const isSelected = selectedMatchId === m.match_id;
          const isLive = m.status === 'LIVE';
          const hasStreams = Boolean(m.streams && m.streams.length > 0);

          return (
            <div
              key={m.match_id}
              onClick={() => onSelectMatch(m)}
              className={`flex-shrink-0 w-[290px] md:w-[310px] rounded-xl p-3 cursor-pointer transition-all duration-200 border text-left ${
                isSelected
                  ? 'bg-slate-850/95 border-emerald-500/80 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700/80 shadow-sm'
              }`}
            >
              {/* Card Header: Series Name & Status Badges */}
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate max-w-[150px]">
                  {m.series_name || m.format || 'Cricket'}
                </span>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {hasStreams && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                      <Video className="w-2.5 h-2.5 text-indigo-400" />
                      STREAM
                    </span>
                  )}
                  {isLive ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      LIVE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-slate-400">
                      {m.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Teams & Scores */}
              <div className="space-y-1.5">
                {/* Team 1 */}
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2 truncate pr-2">
                    {m.team_1.logo_url ? (
                      <img
                        src={m.team_1.logo_url}
                        alt={m.team_1.abbreviation || m.team_1.name}
                        className="w-4 h-4 object-contain rounded-full bg-slate-800"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[9px] text-slate-300">
                        🏏
                      </div>
                    )}
                    <span className="text-slate-100 truncate">
                      {m.team_1.abbreviation || m.team_1.name}
                    </span>
                  </div>
                  <div className="text-right flex items-baseline gap-1.5 flex-shrink-0">
                    <span className="text-slate-100 font-bold">
                      {m.team_1.score || 'Yet to bat'}
                    </span>
                    {m.team_1.overs && m.team_1.overs !== '0.0' && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({m.team_1.overs})
                      </span>
                    )}
                  </div>
                </div>

                {/* Team 2 */}
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2 truncate pr-2">
                    {m.team_2.logo_url ? (
                      <img
                        src={m.team_2.logo_url}
                        alt={m.team_2.abbreviation || m.team_2.name}
                        className="w-4 h-4 object-contain rounded-full bg-slate-800"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[9px] text-slate-300">
                        🏏
                      </div>
                    )}
                    <span className="text-slate-100 truncate">
                      {m.team_2.abbreviation || m.team_2.name}
                    </span>
                  </div>
                  <div className="text-right flex items-baseline gap-1.5 flex-shrink-0">
                    <span className="text-slate-100 font-bold">
                      {m.team_2.score || 'Yet to bat'}
                    </span>
                    {m.team_2.overs && m.team_2.overs !== '0.0' && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({m.team_2.overs})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Note / Target Footer */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <p className="text-slate-400 truncate max-w-[210px]">
                  {m.status_text || m.title}
                </p>
                {m.target && (
                  <span className="text-[10px] text-emerald-400 font-bold flex-shrink-0">
                    T: {m.target}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
