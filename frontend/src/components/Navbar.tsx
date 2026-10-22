import React from 'react';
import { Radio, Search, Tv, Filter, Wifi } from 'lucide-react';

interface NavbarProps {
  liveOnly: boolean;
  onToggleLiveOnly: (val: boolean) => void;
  selectedSeries: string;
  onSelectSeries: (series: string) => void;
  availableSeries: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isConnected: boolean;
  liveMatchesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  liveOnly,
  onToggleLiveOnly,
  selectedSeries,
  onSelectSeries,
  availableSeries,
  searchQuery,
  onSearchChange,
  isConnected,
  liveMatchesCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0d121d]/95 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 py-2.5 transition-colors">
      <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Connection Status */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#0a0e17] rounded-[10px] flex items-center justify-center">
                <Tv className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  CricStream<span className="text-emerald-400">Live</span>
                </h1>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Broadcast-Grade Video Player & Real-Time Cricinfo Engine
              </p>
            </div>
          </div>

          {/* Connection status pill */}
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-full text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-slate-300 font-medium hidden sm:inline">
              {isConnected ? 'Real-Time Sync' : 'Reconnecting...'}
            </span>
            <Wifi className={`w-3 h-3 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
        </div>

        {/* Filters & Search Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Live Now Toggle */}
          <button
            onClick={() => onToggleLiveOnly(!liveOnly)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              liveOnly
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-sm shadow-rose-500/20'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${liveOnly ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
            <span>Live Now</span>
            {liveMatchesCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  liveOnly ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {liveMatchesCount}
              </span>
            )}
          </button>

          {/* Series Dropdown Filter */}
          {availableSeries.length > 0 && (
            <div className="relative flex items-center">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                value={selectedSeries}
                onChange={(e) => onSelectSeries(e.target.value)}
                className="bg-slate-900/80 border border-slate-800 text-slate-200 text-xs rounded-lg pl-8 pr-7 py-1.5 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition appearance-none cursor-pointer max-w-[190px] truncate"
              >
                <option value="ALL">All Competitions</option>
                {availableSeries.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-500 absolute right-2.5 pointer-events-none">▼</span>
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search team, ground..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
