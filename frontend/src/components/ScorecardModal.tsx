import React, { useState } from 'react';
import { X, Trophy, Shield, Users, Calendar, MapPin } from 'lucide-react';
import { MatchDetail } from '../types/cricket';

interface ScorecardModalProps {
  detail: MatchDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ScorecardModal: React.FC<ScorecardModalProps> = ({ detail, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'batting' | 'bowling' | 'lineups'>('batting');
  const [activeInningsIdx, setActiveInningsIdx] = useState<number>(0);

  if (!isOpen || !detail) return null;

  const currentInnings = detail.innings && detail.innings[activeInningsIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#121824] border border-[#26334a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#182030] border-b border-[#26334a]">
          <div>
            <h2 className="text-lg font-extrabold text-white">{detail.description}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span>{detail.series_name}</span>
              <span>•</span>
              <span className="text-cyan-400 font-semibold">{detail.format}</span>
              <span>•</span>
              <span>{detail.ground_name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Innings Selector Bar */}
        {detail.innings && detail.innings.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-[#0e131d] border-b border-[#26334a] overflow-x-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Innings:</span>
            {detail.innings.map((inn, idx) => (
              <button
                key={idx}
                onClick={() => setActiveInningsIdx(idx)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeInningsIdx === idx
                    ? 'bg-cyan-500 text-black shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {inn.team_name} ({inn.runs}/{inn.wickets} in {inn.overs} ov)
              </button>
            ))}
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex border-b border-[#26334a] px-6 bg-[#141b29]">
          <button
            onClick={() => setActiveTab('batting')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'batting'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Batting Scorecard
          </button>
          <button
            onClick={() => setActiveTab('bowling')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'bowling'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Bowling Figures
          </button>
          <button
            onClick={() => setActiveTab('lineups')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'lineups'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Match Info & Playing XIs
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Batting Tab */}
          {activeTab === 'batting' && (
            <div>
              {currentInnings ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#26334a] text-slate-400">
                        <th className="py-2.5 px-3">Batter</th>
                        <th className="py-2.5 px-3">Dismissal</th>
                        <th className="py-2.5 px-3">R</th>
                        <th className="py-2.5 px-3">B</th>
                        <th className="py-2.5 px-3">4s</th>
                        <th className="py-2.5 px-3">6s</th>
                        <th className="py-2.5 px-3">SR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2738]">
                      {currentInnings.batting.map((b, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-white">{b.full_name || b.name}</td>
                          <td className="py-2.5 px-3 text-slate-400">{b.dismissal || (b.is_out ? 'out' : 'not out')}</td>
                          <td className="py-2.5 px-3 font-extrabold text-cyan-400">{b.runs ?? '-'}</td>
                          <td className="py-2.5 px-3">{b.balls ?? '-'}</td>
                          <td className="py-2.5 px-3">{b.fours ?? '-'}</td>
                          <td className="py-2.5 px-3">{b.sixes ?? '-'}</td>
                          <td className="py-2.5 px-3 font-mono">{b.strike_rate ? b.strike_rate.toFixed(1) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 pt-3 border-t border-[#26334a] flex justify-between text-xs text-slate-300">
                    <span>
                      Extras: <strong>{currentInnings.extras || 0}</strong> (b {currentInnings.byes || 0}, lb{' '}
                      {currentInnings.legbyes || 0}, w {currentInnings.wides || 0}, nb {currentInnings.noballs || 0})
                    </span>
                    <span className="font-bold text-cyan-400">
                      Total: {currentInnings.runs}/{currentInnings.wickets} ({currentInnings.overs} ov, RR:{' '}
                      {currentInnings.run_rate})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">No innings data available.</div>
              )}
            </div>
          )}

          {/* Bowling Tab */}
          {activeTab === 'bowling' && (
            <div>
              {currentInnings ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#26334a] text-slate-400">
                        <th className="py-2.5 px-3">Bowler</th>
                        <th className="py-2.5 px-3">O</th>
                        <th className="py-2.5 px-3">M</th>
                        <th className="py-2.5 px-3">R</th>
                        <th className="py-2.5 px-3">W</th>
                        <th className="py-2.5 px-3">Econ</th>
                        <th className="py-2.5 px-3">Dots</th>
                        <th className="py-2.5 px-3">Wd/Nb</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2738]">
                      {currentInnings.bowling.map((bw, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-white">{bw.full_name || bw.name}</td>
                          <td className="py-2.5 px-3 font-semibold">{bw.overs ?? '-'}</td>
                          <td className="py-2.5 px-3">{bw.maidens ?? 0}</td>
                          <td className="py-2.5 px-3">{bw.runs ?? 0}</td>
                          <td className="py-2.5 px-3 font-extrabold text-rose-400">{bw.wickets ?? 0}</td>
                          <td className="py-2.5 px-3 font-mono">{bw.economy ? bw.economy.toFixed(2) : '-'}</td>
                          <td className="py-2.5 px-3">{bw.dots ?? '-'}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {bw.wides || 0}/{bw.no_balls || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">No bowling data available.</div>
              )}
            </div>
          )}

          {/* Lineups & Match Info */}
          {activeTab === 'lineups' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#182030] p-3 rounded-xl border border-[#26334a]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Venue</div>
                  <div className="text-xs font-bold text-white mt-1">{detail.ground_name || 'N/A'}</div>
                </div>
                <div className="bg-[#182030] p-3 rounded-xl border border-[#26334a]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Toss</div>
                  <div className="text-xs font-bold text-white mt-1">
                    {detail.toss_decision ? `Decided to ${detail.toss_decision}` : 'N/A'}
                  </div>
                </div>
                <div className="bg-[#182030] p-3 rounded-xl border border-[#26334a]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Format</div>
                  <div className="text-xs font-bold text-white mt-1">{detail.format}</div>
                </div>
                <div className="bg-[#182030] p-3 rounded-xl border border-[#26334a]">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Status</div>
                  <div className="text-xs font-bold text-amber-400 mt-1">{detail.status_text || detail.result}</div>
                </div>
              </div>

              {/* Playing XIs */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-[#182030] p-4 rounded-xl border border-[#26334a]">
                  <h4 className="font-extrabold text-sm text-cyan-400 mb-3">{detail.team_1.name} Playing XI</h4>
                  <div className="space-y-2">
                    {detail.team_1.players.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800">
                        <span className="font-semibold text-slate-200">
                          {p.full_name || p.name}{' '}
                          {p.is_captain && <span className="px-1 bg-cyan-500/20 text-cyan-400 rounded text-[9px] font-bold">C</span>}{' '}
                          {p.is_keeper && <span className="px-1 bg-amber-500/20 text-amber-400 rounded text-[9px] font-bold">WK</span>}
                        </span>
                        <span className="text-[11px] text-slate-500">{p.role}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#182030] p-4 rounded-xl border border-[#26334a]">
                  <h4 className="font-extrabold text-sm text-emerald-400 mb-3">{detail.team_2.name} Playing XI</h4>
                  <div className="space-y-2">
                    {detail.team_2.players.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800">
                        <span className="font-semibold text-slate-200">
                          {p.full_name || p.name}{' '}
                          {p.is_captain && <span className="px-1 bg-emerald-500/20 text-emerald-400 rounded text-[9px] font-bold">C</span>}{' '}
                          {p.is_keeper && <span className="px-1 bg-amber-500/20 text-amber-400 rounded text-[9px] font-bold">WK</span>}
                        </span>
                        <span className="text-[11px] text-slate-500">{p.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
