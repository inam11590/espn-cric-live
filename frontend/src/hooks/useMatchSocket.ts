import { useEffect, useRef, useState, useCallback } from 'react';
import { MatchDetail } from '../types/cricket';

interface UseMatchSocketResult {
  matchDetail: MatchDetail | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  isScoreUpdated: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useMatchSocket(seriesId: number | null, matchId: number | null): UseMatchSocketResult {
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isScoreUpdated, setIsScoreUpdated] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevScoreSignatureRef = useRef<string>('');
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to extract a fingerprint of the current score to detect real changes
  const getScoreSignature = (data: MatchDetail | null): string => {
    if (!data) return '';
    const t1 = `${data.team_1?.score || ''}_${data.team_1?.name || ''}`;
    const t2 = `${data.team_2?.score || ''}_${data.team_2?.name || ''}`;
    const inn = (data.innings || [])
      .map((i) => `${i.runs}/${i.wickets}(${i.overs})`)
      .join('-');
    const status = data.status_text || '';
    return `${t1}|${t2}|${inn}|${status}`;
  };

  const handleNewMatchData = useCallback((data: MatchDetail) => {
    const newSig = getScoreSignature(data);
    if (prevScoreSignatureRef.current && prevScoreSignatureRef.current !== newSig) {
      // Trigger visual highlight animation
      setIsScoreUpdated(true);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => {
        setIsScoreUpdated(false);
      }, 1500);
    }
    prevScoreSignatureRef.current = newSig;
    setMatchDetail(data);
    setLastUpdated(new Date());
    setError(null);
  }, []);

  // Fetch match details via HTTP REST
  const fetchMatchDetails = useCallback(
    async (silent = false) => {
      if (!seriesId || !matchId) return;
      if (!silent) setIsLoading(true);

      try {
        const res = await fetch(`/api/v1/matches/${seriesId}/${matchId}`);
        if (!res.ok) {
          throw new Error(`Failed to load match: ${res.statusText}`);
        }
        const data: MatchDetail = await res.json();
        handleNewMatchData(data);
      } catch (err: any) {
        console.error('Error fetching match detail:', err);
        if (!silent) {
          setError(err.message || 'Unable to load match scorecard');
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [seriesId, matchId, handleNewMatchData]
  );

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (!seriesId || !matchId) return;

    // Clean up existing socket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const loc = window.location;
    const wsProtocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use host directly (works with Vite proxy or FastAPI direct serving)
    const wsUrl = `${wsProtocol}//${loc.host}/ws/matches/${seriesId}/${matchId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.data) {
            handleNewMatchData(payload.data);
          } else if (payload.event === 'score_update' && payload.match) {
            handleNewMatchData(payload.match);
          }
        } catch (e) {
          // If plain text (e.g., pong)
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, max 15s
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(2, attempt), 15000);
        reconnectAttemptRef.current += 1;

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      };

      ws.onerror = (e) => {
        console.warn('WebSocket connection error:', e);
        ws.close();
      };
    } catch (e) {
      console.warn('Failed to initialize WebSocket:', e);
    }
  }, [seriesId, matchId, handleNewMatchData]);

  // Main lifecycle
  useEffect(() => {
    if (!seriesId || !matchId) {
      setMatchDetail(null);
      setIsLoading(false);
      return;
    }

    prevScoreSignatureRef.current = '';
    fetchMatchDetails(false);
    connectWebSocket();

    // 15-second HTTP polling safety net in case WebSocket is unavailable or behind restrictive proxy
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
      fetchMatchDetails(true);
    }, 15000);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, [seriesId, matchId, fetchMatchDetails, connectWebSocket]);

  return {
    matchDetail,
    isLoading,
    error,
    isConnected,
    isScoreUpdated,
    lastUpdated,
    refresh: () => fetchMatchDetails(false),
  };
}
