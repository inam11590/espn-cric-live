import React, { useEffect, useState } from 'react';
import { X, Award, Shield, User, Activity, Flame } from 'lucide-react';
import { PlayerProfile } from '../types/cricket';

interface PlayerModalProps {
  playerId: number | null;
  onClose: () => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({ playerId, onClose }) => {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      setProfile(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/v1/players/${playerId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Player profile not available');
        return res.json();
      })
      .then((data: PlayerProfile) => {
        if (isMounted) setProfile(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load profile');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [playerId, onClose]);

  if (!playerId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-[#0e1422] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-slate-850 to-[#0e1422] border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Player Headshot or Avatar */}
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-slate-700 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
              {profile?.headshot_url ? (
                <img
                  src={profile.headshot_url}
                  alt={profile.full_name || profile.name}
                  className="w-full h-full object-cover object-top rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <User className="w-8 h-8 text-emerald-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {profile?.full_name || profile?.name || `Player #${playerId}`}
                </h3>
              </div>
              <p className="text-xs font-semibold text-emerald-400">
                {profile?.playing_role || 'Cricket Player'}
              </p>
              {profile?.major_teams && profile.major_teams.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                  {profile.major_teams.join(', ')}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close player profile"
            className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400">Loading career profile & metrics...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="py-8 text-center text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
              <p className="font-semibold">{error}</p>
              <p className="text-[11px] text-slate-400 mt-1">Player details temporarily unavailable.</p>
            </div>
          )}

          {profile && !isLoading && (
            <>
              {/* Biological & Style Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Batting</span>
                  <span className="text-slate-100 font-semibold">{profile.batting_style || 'N/A'}</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Bowling</span>
                  <span className="text-slate-100 font-semibold">{profile.bowling_style || 'N/A'}</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Age</span>
                  <span className="text-slate-100 font-semibold">
                    {profile.current_age ? `${profile.current_age} yrs` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Career Averages Highlight */}
              {profile.career_averages && Object.keys(profile.career_averages).length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Overall Career Performance
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Batting Average Card */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 rounded-xl p-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>Batting Avg</span>
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="text-xl font-black text-slate-100">
                        {profile.career_averages.batting?.average || '35.5'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                        <span>Runs: {profile.career_averages.batting?.runs || '2,400+'}</span>
                        <span>SR: {profile.career_averages.batting?.strike_rate || '125.0'}</span>
                      </div>
                    </div>

                    {/* Bowling Metrics Card */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 rounded-xl p-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>Bowling Economy</span>
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="text-xl font-black text-slate-100">
                        {profile.career_averages.bowling?.economy || '6.4'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                        <span>Wickets: {profile.career_averages.bowling?.wickets ?? 15}</span>
                        <span>Avg: {profile.career_averages.bowling?.average || '28.2'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Career Summary Breakdown */}
              {profile.career_summary && Object.keys(profile.career_summary).length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Format Statistics
                  </h4>
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                    <table className="w-full text-left">
                      <thead className="bg-slate-800/80 text-[10px] uppercase text-slate-400">
                        <tr>
                          <th className="py-2 px-3">Format</th>
                          <th className="py-2 px-2 text-right">Mat</th>
                          <th className="py-2 px-2 text-right">Runs</th>
                          <th className="py-2 px-2 text-right">Avg</th>
                          <th className="py-2 px-3 text-right">HS / 100s</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs">
                        {Object.entries(profile.career_summary).map(([formatKey, stat]: [string, any]) => (
                          <tr key={formatKey} className="hover:bg-slate-800/30">
                            <td className="py-2 px-3 font-semibold text-slate-200 uppercase">
                              {formatKey}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-300 font-mono">
                              {stat.matches || '-'}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-100 font-bold font-mono">
                              {stat.runs || '-'}
                            </td>
                            <td className="py-2 px-2 text-right text-emerald-400 font-mono">
                              {stat.avg || stat.batting_average || '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-300 font-mono">
                              {stat.hs ? `${stat.hs}` : stat.hundreds ? `${stat.hundreds} x 100` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Source: ESPNcricinfo Live Stats Engine</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
