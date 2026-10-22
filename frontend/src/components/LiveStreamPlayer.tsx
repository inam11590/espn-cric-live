import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  PictureInPicture,
  Tv,
  AlertCircle,
  Radio,
  Layers,
} from 'lucide-react';
import { StreamServer } from '../types/cricket';

interface LiveStreamPlayerProps {
  matchTitle?: string;
  servers?: StreamServer[];
  isLive?: boolean;
}

const DEFAULT_SERVERS: StreamServer[] = [
  {
    server_name: 'Main HD Server (1080p)',
    stream_type: 'hls',
    stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    quality: '1080p',
    is_active: true,
  },
  {
    server_name: 'CORS Proxy HLS (Bypass)',
    stream_type: 'proxy_hls',
    stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    quality: '1080p',
    is_active: true,
  },
  {
    server_name: 'Backup Stream (720p)',
    stream_type: 'hls',
    stream_url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    quality: '720p',
    is_active: true,
  },
  {
    server_name: 'World Feed (Iframe Embed)',
    stream_type: 'iframe',
    stream_url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1',
    quality: '1080p',
    is_active: true,
  },
];

export const LiveStreamPlayer: React.FC<LiveStreamPlayerProps> = ({
  matchTitle = 'Live Cricket Broadcast',
  servers = DEFAULT_SERVERS,
  isLive = true,
}) => {
  const activeServers = servers && servers.length > 0 ? servers : DEFAULT_SERVERS;

  const [currentServerIdx, setCurrentServerIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true); // default muted for autoplay compliance
  const [volume, setVolume] = useState<number>(1);
  const [isTheater, setIsTheater] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [qualityLevels, setQualityLevels] = useState<{ index: number; label: string }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef<number>(0);

  const currentServer = activeServers[currentServerIdx] || activeServers[0];

  // Resolve stream URL (direct or via HLS CORS proxy)
  const getPlayableUrl = (server: StreamServer): string => {
    if (server.stream_type === 'proxy_hls') {
      const encodedUrl = encodeURIComponent(server.stream_url);
      const refererParam = server.referer ? `&referer=${encodeURIComponent(server.referer)}` : '';
      return `/api/v1/proxy/hls?url=${encodedUrl}${refererParam}`;
    }
    return server.stream_url;
  };

  // Switch to next backup server upon fatal error
  const failoverToNextServer = () => {
    if (activeServers.length <= 1) return;
    const nextIdx = (currentServerIdx + 1) % activeServers.length;
    setErrorNotice(`Stream stall detected. Auto-switching to ${activeServers[nextIdx].server_name}...`);
    setTimeout(() => {
      setErrorNotice(null);
      setCurrentServerIdx(nextIdx);
    }, 2000);
  };

  // Initialize HLS or Iframe on server change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (currentServer.stream_type === 'iframe') {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const streamUrl = getPlayableUrl(currentServer);
    setErrorNotice(null);

    // Destroy existing instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
        enableWorker: true,
        autoStartLoad: true,
        manifestLoadingTimeOut: 15000,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        retryCountRef.current = 0;
        const levels = data.levels.map((lvl, index) => ({
          index,
          label: lvl.height ? `${lvl.height}p` : `Level ${index + 1}`,
        }));
        setQualityLevels(levels);

        video.play().catch(() => {
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (retryCountRef.current < 2) {
                retryCountRef.current++;
                hls.startLoad();
              } else {
                failoverToNextServer();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              failoverToNextServer();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari / iOS
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => setIsPlaying(false));
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentServerIdx, currentServer]);

  // Video playback controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    if (!newMuted && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleQualitySelect = (levelIdx: number) => {
    setCurrentQuality(levelIdx);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIdx;
    }
    setShowQualityMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('Picture-in-picture error:', e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-[#0e131d] rounded-2xl overflow-hidden border border-[#232b3e] shadow-2xl transition-all duration-300 ${
        isTheater ? 'w-full max-w-full' : 'w-full'
      }`}
    >
      {/* Top Header / Server Switcher Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#131926]/90 backdrop-blur-md border-b border-[#232b3e] z-20 flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          {isLive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
              LIVE
            </span>
          )}
          <h3 className="text-sm md:text-base font-bold text-white truncate max-w-[280px] sm:max-w-[450px]">
            {matchTitle}
          </h3>
        </div>

        {/* Server Switcher Tabs */}
        <div className="flex items-center bg-[#0a0d14] p-1 rounded-lg border border-[#232b3e] overflow-x-auto max-w-full">
          <div className="flex items-center text-xs text-slate-400 px-2 font-medium">
            <Radio className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Server:
          </div>
          {activeServers.map((server, idx) => {
            const isActive = idx === currentServerIdx;
            return (
              <button
                key={idx}
                onClick={() => setCurrentServerIdx(idx)}
                className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {server.server_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Video Screen (16:9 Aspect Ratio) */}
      <div className="relative w-full aspect-video bg-black group flex items-center justify-center overflow-hidden">
        {/* Error / Failover Notification Toast */}
        {errorNotice && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-amber-500/90 text-black text-xs font-bold rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm animate-bounce">
            <AlertCircle className="w-4 h-4" />
            {errorNotice}
          </div>
        )}

        {/* Iframe Playback Mode */}
        {currentServer.stream_type === 'iframe' ? (
          <iframe
            src={currentServer.stream_url}
            title={matchTitle}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          /* HLS Native / HLS.js Video Element */
          <>
            <video
              ref={videoRef}
              onClick={togglePlay}
              className="w-full h-full object-contain cursor-pointer"
              playsInline
              muted={isMuted}
            />

            {/* Stream Type Pill Overlay */}
            <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-cyan-400 border border-cyan-500/30">
              {currentServer.stream_type === 'proxy_hls' ? 'HLS (CORS PROXY)' : 'HLS DIRECT'}
            </div>

            {/* Floating Custom Controls Bar (Fade in on hover) */}
            <div className="absolute inset-x-0 bottom-0 z-20 px-4 py-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-between text-white">
              {/* Left Controls: Play/Pause, Volume */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={togglePlay}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-5 h-5 text-cyan-400" /> : <Play className="w-5 h-5 text-white" />}
                </button>

                {/* Live Sync Badge */}
                <div className="flex items-center space-x-1 text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>SYNC</span>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center space-x-2">
                  <button onClick={toggleMute} className="p-1.5 hover:text-cyan-400 transition-colors">
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              </div>

              {/* Right Controls: Quality, PiP, Theater, Fullscreen */}
              <div className="flex items-center space-x-2 relative">
                {/* Quality Menu Toggle */}
                {qualityLevels.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="p-2 hover:text-cyan-400 transition-colors flex items-center text-xs font-medium gap-1"
                    >
                      <Settings className="w-4 h-4" />
                      <span>{currentQuality === -1 ? 'Auto' : qualityLevels.find((q) => q.index === currentQuality)?.label}</span>
                    </button>

                    {showQualityMenu && (
                      <div className="absolute right-0 bottom-10 bg-[#131926] border border-[#232b3e] rounded-xl shadow-2xl p-1.5 w-28 flex flex-col space-y-1 z-30">
                        <button
                          onClick={() => handleQualitySelect(-1)}
                          className={`px-2 py-1 text-xs rounded-md text-left ${
                            currentQuality === -1 ? 'bg-cyan-500 text-black font-bold' : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          Auto
                        </button>
                        {qualityLevels.map((lvl) => (
                          <button
                            key={lvl.index}
                            onClick={() => handleQualitySelect(lvl.index)}
                            className={`px-2 py-1 text-xs rounded-md text-left ${
                              currentQuality === lvl.index ? 'bg-cyan-500 text-black font-bold' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {lvl.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Picture in Picture */}
                <button onClick={togglePiP} className="p-2 hover:text-cyan-400 transition-colors" title="Picture in Picture">
                  <PictureInPicture className="w-4 h-4" />
                </button>

                {/* Theater Mode */}
                <button
                  onClick={() => setIsTheater(!isTheater)}
                  className={`p-2 hover:text-cyan-400 transition-colors ${isTheater ? 'text-cyan-400' : ''}`}
                  title="Theater Mode"
                >
                  <Tv className="w-4 h-4" />
                </button>

                {/* Fullscreen */}
                <button onClick={toggleFullscreen} className="p-2 hover:text-cyan-400 transition-colors" title="Fullscreen">
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Meta Strip */}
      <div className="px-4 py-2.5 bg-[#0a0d14] flex items-center justify-between text-xs text-slate-400 border-t border-[#232b3e]">
        <div className="flex items-center space-x-2">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Active Server: <strong className="text-white">{currentServer.server_name}</strong></span>
          <span className="text-slate-600">•</span>
          <span>Quality: <span className="text-cyan-400 font-semibold">{currentServer.quality}</span></span>
        </div>
        <div className="text-[11px] text-slate-500">HLS.js Engine • Low Latency Mode</div>
      </div>
    </div>
  );
};
