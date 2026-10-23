import React, { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, PieChart, Sparkles } from 'lucide-react';
import { Poll } from '../../types/cricket';

interface MatchPollWidgetProps {
  polls: Poll[];
  onVote: (pollId: number, optionId: string) => void;
  className?: string;
}

export const MatchPollWidget: React.FC<MatchPollWidgetProps> = ({
  polls,
  onVote,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!polls || polls.length === 0) {
    return null;
  }

  const activePoll = polls[Math.min(currentIndex, polls.length - 1)];
  const hasVoted = Boolean(activePoll.user_voted_option_id);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : polls.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < polls.length - 1 ? prev + 1 : 0));
  };

  return (
    <div
      className={`bg-gradient-to-br from-slate-900/95 via-[#0d1424] to-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden ${className}`}
    >
      {/* Background glow accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2">
          {activePoll.is_active ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Live Prediction
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
              Ended
            </span>
          )}

          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <PieChart className="w-3 h-3 text-slate-500" />
            {activePoll.total_votes} {activePoll.total_votes === 1 ? 'vote' : 'votes'}
          </span>
        </div>

        {polls.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 font-mono mr-1">
              {currentIndex + 1}/{polls.length}
            </span>
            <button
              onClick={handlePrev}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Previous poll"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNext}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Next poll"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Question */}
      <h4 className="text-sm font-bold text-white mb-3.5 leading-snug relative z-10">
        {activePoll.question}
      </h4>

      {/* Options List */}
      <div className="space-y-2 relative z-10">
        {activePoll.options.map((opt) => {
          const isSelected = activePoll.user_voted_option_id === opt.id;

          if (hasVoted || !activePoll.is_active) {
            // RESULT VIEW: Animated progress bar
            return (
              <div
                key={opt.id}
                className={`relative overflow-hidden rounded-xl border p-2.5 transition-all ${
                  isSelected
                    ? 'border-emerald-500/60 bg-emerald-950/20 shadow-sm shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/40'
                }`}
              >
                {/* Progress bar background fill */}
                <div
                  style={{ width: `${opt.percentage}%` }}
                  className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out opacity-25 ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                      : 'bg-slate-600'
                  }`}
                />

                <div className="relative z-10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    )}
                    <span className={isSelected ? 'text-emerald-300 font-bold' : ''}>
                      {opt.text}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[11px] text-slate-400">({opt.votes})</span>
                    <span
                      className={`text-xs font-bold ${
                        isSelected ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {opt.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // VOTING VIEW: Interactive click-to-vote buttons
          return (
            <button
              key={opt.id}
              onClick={() => onVote(activePoll.id, opt.id)}
              className="w-full text-left p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:text-white transition duration-150 flex items-center justify-between text-xs font-medium text-slate-300 group shadow-sm"
            >
              <span className="group-hover:translate-x-1 transition-transform">
                {opt.text}
              </span>
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 uppercase tracking-wider transition-colors flex items-center gap-1">
                <Sparkles className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                Vote
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>{hasVoted ? '✓ You voted on this poll' : 'Tap an option to cast your vote'}</span>
        <span>Anonymous & Live</span>
      </div>
    </div>
  );
};
