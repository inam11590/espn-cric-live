import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Users,
  Pause,
  Play,
  Dice5,
  Edit2,
  Check,
  X,
  MessageSquare,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { ChatMessage, Poll } from '../../types/cricket';
import { MatchPollWidget } from './MatchPollWidget';

interface LiveChatPanelProps {
  messages: ChatMessage[];
  viewerCount: number;
  nickname: string;
  avatarColor: string;
  rateLimitSeconds: number;
  polls: Poll[];
  onSendMessage: (msg: string) => void;
  onSetNickname: (newNick: string) => void;
  onVotePoll: (pollId: number, optionId: string) => void;
  className?: string;
}

export const LiveChatPanel: React.FC<LiveChatPanelProps> = ({
  messages,
  viewerCount,
  nickname,
  avatarColor,
  rateLimitSeconds,
  polls,
  onSendMessage,
  onSetNickname,
  onVotePoll,
  className = '',
}) => {
  const [inputText, setInputText] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [tempNick, setTempNick] = useState(nickname);
  const [showPolls, setShowPolls] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages if enabled
  useEffect(() => {
    if (isAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAutoScroll]);

  // Handle scroll event to toggle auto-scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAutoScroll(isAtBottom);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || rateLimitSeconds > 0) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleSaveNickname = () => {
    if (tempNick.trim()) {
      onSetNickname(tempNick.trim());
    }
    setIsEditingNick(false);
  };

  const generateNewNickname = () => {
    const prefixes = [
      'CoverDrive', 'GooglyMaster', 'YorkerKing', 'HelicopterShot', 'SillyPoint',
      'DoosraGuru', 'ReverseSweep', 'SquareCut', 'BouncerAce', 'UpperCut',
      'ThirdUmpire', 'LegGlance', 'PinchHitter', 'MaidenOver', 'HatTrickHero',
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(Math.random() * 90 + 10);
    const generated = `${prefix}_${num}`;
    setTempNick(generated);
    onSetNickname(generated);
  };

  const charCount = inputText.length;
  const isNearLimit = charCount >= 140;

  return (
    <div className={`flex flex-col h-full bg-[#0c111c] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl ${className}`}>
      {/* ------------------------------------------------------------------ */}
      {/* 1. CHAT HEADER                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Fan Zone Live Chat</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <Users className="w-2.5 h-2.5" />
                {viewerCount}
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1.5">
          {polls.length > 0 && (
            <button
              onClick={() => setShowPolls(!showPolls)}
              title={showPolls ? 'Hide active prediction polls' : 'Show prediction polls'}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                showPolls
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Polls ({polls.length})</span>
            </button>
          )}

          {/* Pause / Resume Auto-scroll Toggle */}
          <button
            onClick={() => setIsAutoScroll(!isAutoScroll)}
            title={isAutoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
            className={`p-1.5 rounded-lg border transition ${
              isAutoScroll
                ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
            }`}
          >
            {isAutoScroll ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. USER HANDLE BAR (ANONYMOUS CRICKET NICKNAME)                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between text-[11px]">
        {isEditingNick ? (
          <div className="flex items-center gap-1.5 w-full">
            <input
              type="text"
              value={tempNick}
              maxLength={24}
              onChange={(e) => setTempNick(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              placeholder="Enter your cricket handle"
              autoFocus
            />
            <button
              onClick={handleSaveNickname}
              className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
              title="Save"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setTempNick(nickname);
                setIsEditingNick(false);
              }}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: avatarColor }}
                className="w-2.5 h-2.5 rounded-full inline-block"
              />
              <span className="text-slate-400">Chatting as:</span>
              <strong className="text-slate-200 font-mono">{nickname}</strong>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setTempNick(nickname);
                  setIsEditingNick(true);
                }}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                title="Edit nickname"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={generateNewNickname}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
                title="Randomize cricket nickname"
              >
                <Dice5 className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. OPTIONAL COLLAPSIBLE POLLS BANNER                               */}
      {/* ------------------------------------------------------------------ */}
      {showPolls && polls.length > 0 && (
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
          <MatchPollWidget polls={polls} onVote={onVotePoll} />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. AUTO-SCROLLING MESSAGES LIST                                    */}
      {/* ------------------------------------------------------------------ */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <span className="text-3xl mb-2">🏏</span>
            <p className="font-semibold text-slate-400">Match Chat is Quiet</p>
            <p className="text-[11px] mt-1">
              Be the first to share your cheer, prediction, or reaction!
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.username === nickname;
            return (
              <div
                key={m.id}
                className={`flex items-start gap-2 ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                >
                  {m.username.charAt(0).toUpperCase()}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                    isMe
                      ? 'bg-emerald-600/90 text-white rounded-tr-none'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-tl-none'
                  }`}
                >
                  <div
                    className={`flex items-center gap-1.5 mb-0.5 text-[10px] font-mono ${
                      isMe ? 'text-emerald-200 justify-end' : 'text-slate-400'
                    }`}
                  >
                    <span className="font-bold truncate max-w-[120px]">{m.username}</span>
                    {m.badge && (
                      <span className="px-1 rounded bg-slate-900 text-[9px] text-amber-400 font-sans uppercase">
                        {m.badge}
                      </span>
                    )}
                    <span>
                      {m.timestamp
                        ? new Date(m.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                  <p className="break-words leading-relaxed">{m.message}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pause indicator banner when user scrolls up */}
      {!isAutoScroll && (
        <div className="bg-amber-500/10 border-t border-amber-500/30 px-3 py-1 flex items-center justify-between text-[11px] text-amber-300">
          <span>Auto-scroll paused</span>
          <button
            onClick={() => {
              setIsAutoScroll(true);
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="underline font-semibold hover:text-white"
          >
            Jump to latest
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. STICKY INPUT BAR                                                */}
      {/* ------------------------------------------------------------------ */}
      <form
        onSubmit={handleSend}
        className="p-2.5 bg-slate-900 border-t border-slate-800/80"
      >
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            maxLength={160}
            onChange={(e) => setInputText(e.target.value)}
            disabled={rateLimitSeconds > 0}
            placeholder={
              rateLimitSeconds > 0
                ? `Slow down... (${rateLimitSeconds}s)`
                : 'Send a message (160 chars max)...'
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-20 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 transition disabled:opacity-50"
          />

          <div className="absolute right-1.5 flex items-center gap-1.5">
            {/* Character counter */}
            <span
              className={`text-[10px] font-mono ${
                isNearLimit ? 'text-amber-400 font-bold' : 'text-slate-500'
              }`}
            >
              {charCount}/160
            </span>

            <button
              type="submit"
              disabled={!inputText.trim() || rateLimitSeconds > 0}
              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white transition disabled:opacity-40 disabled:hover:bg-emerald-600 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Rate limit warning banner */}
        {rateLimitSeconds > 0 && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400 font-medium">
            <ShieldAlert className="w-3 h-3" />
            <span>Anti-spam: You can chat again in {rateLimitSeconds}s.</span>
          </div>
        )}
      </form>
    </div>
  );
};
