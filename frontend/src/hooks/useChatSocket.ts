import { useEffect, useRef, useState, useCallback } from 'react';
import { ChatMessage, FlyingReaction, Poll } from '../types/cricket';

const CRICKET_PREFIXES = [
  'CoverDrive', 'GooglyMaster', 'YorkerKing', 'HelicopterShot', 'SillyPoint',
  'DoosraGuru', 'ReverseSweep', 'SquareCut', 'BouncerAce', 'UpperCut',
  'ThirdUmpire', 'LegGlance', 'PinchHitter', 'MaidenOver', 'HatTrickHero',
];

const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1',
];

function getOrCreateUserIdentity() {
  let userId = localStorage.getItem('cricket_chat_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('cricket_chat_user_id', userId);
  }

  let nickname = localStorage.getItem('cricket_chat_nickname');
  if (!nickname) {
    const prefix = CRICKET_PREFIXES[Math.floor(Math.random() * CRICKET_PREFIXES.length)];
    const num = Math.floor(Math.random() * 90 + 10);
    nickname = `${prefix}_${num}`;
    localStorage.setItem('cricket_chat_nickname', nickname);
  }

  let color = localStorage.getItem('cricket_chat_avatar_color');
  if (!color) {
    color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    localStorage.setItem('cricket_chat_avatar_color', color);
  }

  return { userId, nickname, color };
}

export function useChatSocket(seriesId: number | null, matchId: number | null) {
  const [identity, setIdentity] = useState(getOrCreateUserIdentity);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [reactions, setReactions] = useState<FlyingReaction[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rateLimitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update user handle
  const setNickname = useCallback((newNick: string) => {
    const trimmed = newNick.trim().slice(0, 24);
    if (trimmed) {
      localStorage.setItem('cricket_chat_nickname', trimmed);
      setIdentity((prev) => ({ ...prev, nickname: trimmed }));
    }
  }, []);

  // Fetch initial prediction polls via REST
  const fetchPolls = useCallback(async () => {
    if (!matchId) return;
    try {
      const res = await fetch(`/api/v1/matches/${matchId}/polls?session_id=${identity.userId}`);
      if (res.ok) {
        const data: Poll[] = await res.json();
        setPolls(data);
      }
    } catch (e) {
      // Non-fatal
    }
  }, [matchId, identity.userId]);

  // Vote on a poll
  const votePoll = useCallback(
    async (pollId: number, optionId: string) => {
      if (!matchId) return;
      try {
        const res = await fetch(`/api/v1/matches/${matchId}/polls/${pollId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            option_id: optionId,
            session_id: identity.userId,
          }),
        });
        if (res.ok) {
          const updated: Poll = await res.json();
          setPolls((prev) => prev.map((p) => (p.id === pollId ? updated : p)));
        } else {
          const errData = await res.json();
          alert(errData.detail || 'Failed to submit vote');
        }
      } catch (e) {
        console.error('Vote error:', e);
      }
    },
    [matchId, identity.userId]
  );

  // Connect WebSocket
  const connect = useCallback(() => {
    if (!seriesId || !matchId) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const loc = window.location;
    const wsProtocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${loc.host}/ws/chat/${seriesId}/${matchId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          switch (payload.type) {
            case 'chat_history':
              if (Array.isArray(payload.messages)) {
                setMessages(payload.messages);
              }
              if (typeof payload.viewer_count === 'number') {
                setViewerCount(payload.viewer_count);
              }
              break;

            case 'chat_message':
              setMessages((prev) => {
                const next = [...prev, payload];
                return next.length > 100 ? next.slice(-100) : next;
              });
              break;

            case 'viewer_count':
              if (typeof payload.count === 'number') {
                setViewerCount(payload.count);
              }
              break;

            case 'reaction': {
              const newReaction: FlyingReaction = {
                id: payload.id || Math.random().toString(),
                emoji: payload.emoji,
                sender: payload.sender,
                x: Math.floor(Math.random() * 70) + 15, // 15% to 85% horizontal
                timestamp: payload.timestamp,
              };
              setReactions((prev) => [...prev, newReaction]);

              // Auto remove reaction after 2.5s
              setTimeout(() => {
                setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
              }, 2500);
              break;
            }

            case 'poll_created':
              setPolls((prev) => [payload.poll, ...prev.filter((p) => p.id !== payload.poll.id)]);
              break;

            case 'poll_updated':
              setPolls((prev) =>
                prev.map((p) =>
                  p.id === payload.poll.id
                    ? { ...payload.poll, user_voted_option_id: p.user_voted_option_id }
                    : p
                )
              );
              break;

            case 'error':
              if (payload.code === 'RATE_LIMITED') {
                setRateLimitSeconds(2);
                if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
                rateLimitTimerRef.current = setInterval(() => {
                  setRateLimitSeconds((sec) => {
                    if (sec <= 1) {
                      clearInterval(rateLimitTimerRef.current!);
                      return 0;
                    }
                    return sec - 1;
                  });
                }, 1000);
              }
              break;

            default:
              break;
          }
        } catch (e) {
          // ignore non-json
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.warn('WS chat connect failed:', e);
    }
  }, [seriesId, matchId]);

  // Keep-alive ping
  useEffect(() => {
    connect();
    fetchPolls();

    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
    };
  }, [connect, fetchPolls]);

  // Send Chat Message
  const sendMessage = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (rateLimitSeconds > 0) return;

      const payload = {
        type: 'chat_message',
        message: clean,
        user_id: identity.userId,
        username: identity.nickname,
        avatar_color: identity.color,
      };

      wsRef.current.send(JSON.stringify(payload));
    },
    [identity, rateLimitSeconds]
  );

  // Send Floating Emoji Reaction
  const sendReaction = useCallback(
    (emoji: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      // Optimistically trigger flying particle for the current user right away
      const localReaction: FlyingReaction = {
        id: Math.random().toString(),
        emoji,
        sender: identity.nickname,
        x: Math.floor(Math.random() * 70) + 15,
      };
      setReactions((prev) => [...prev, localReaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== localReaction.id));
      }, 2500);

      // Broadcast over WebSocket to all room viewers
      wsRef.current.send(
        JSON.stringify({
          type: 'reaction',
          emoji,
          user_id: identity.userId,
          username: identity.nickname,
        })
      );
    },
    [identity]
  );

  return {
    identity,
    setNickname,
    messages,
    viewerCount,
    reactions,
    polls,
    isConnected,
    rateLimitSeconds,
    sendMessage,
    sendReaction,
    votePoll,
    fetchPolls,
  };
}
