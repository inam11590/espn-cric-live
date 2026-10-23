import React from 'react';
import { FlyingReaction } from '../../types/cricket';

interface ReactionOverlayProps {
  reactions: FlyingReaction[];
  onSendReaction: (emoji: string) => void;
  disabled?: boolean;
}

const REACTION_OPTIONS = [
  { emoji: '🏏', label: 'Cricket' },
  { emoji: '🔥', label: 'On Fire' },
  { emoji: '6️⃣', label: 'Six!' },
  { emoji: '4️⃣', label: 'Four!' },
  { emoji: '☝️', label: 'Wicket!' },
  { emoji: '👏', label: 'Clap' },
];

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({
  reactions,
  onSendReaction,
  disabled = false,
}) => {
  return (
    <div className="relative w-full">
      {/* ------------------------------------------------------------------ */}
      {/* 1. FLOATING PARTICLE ANIMATION CONTAINER                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute -top-64 left-0 right-0 h-64 pointer-events-none overflow-hidden z-40">
        {reactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.x ?? 50}%` }}
            className="absolute bottom-4 flex flex-col items-center animate-float-up pointer-events-none select-none"
          >
            <span className="text-3xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
              {r.emoji}
            </span>
            {r.sender && (
              <span className="text-[10px] font-mono font-bold text-slate-200 bg-slate-900/80 px-1.5 py-0.5 rounded-full border border-slate-700/60 mt-0.5 shadow">
                {r.sender}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. REACTION ACTION DOCK TOOLBAR                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800/90 backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-lg shadow-black/30">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="hidden sm:inline">Live Reactions</span>
          <span className="text-[10px] text-slate-500 hidden md:inline">• Tap to celebrate</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {REACTION_OPTIONS.map((opt) => (
            <button
              key={opt.emoji}
              type="button"
              disabled={disabled}
              onClick={() => onSendReaction(opt.emoji)}
              title={opt.label}
              className="group relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 hover:border-emerald-500/50 hover:scale-110 active:scale-95 transition duration-150 text-lg sm:text-xl shadow-sm hover:shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{opt.emoji}</span>
              <span className="absolute -top-7 scale-0 group-hover:scale-100 transition-all duration-150 text-[10px] font-semibold bg-slate-950 text-slate-200 px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-50">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
