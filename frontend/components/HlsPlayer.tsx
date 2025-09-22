'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

interface HLSVideoPlayerProps {
  src: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

const VideoSection: React.FC<HLSVideoPlayerProps> = ({
  src,
  title = "India Visit Conclusive",
  thumbnail = "/Images/video-thumbnail.jpg"
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<string>('Auto');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        lowLatencyMode: false,
        startLevel: -1,
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 90,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 4,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 4,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
      });
      
      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (event, data) => {

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError(`Video loading failed: ${data.details || 'Unknown error'}`);
              setIsLoading(false);
              break;
          }
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels.map((level) => 
          `${level.height}p`
        );
        setAvailableQualities(['Auto', ...levels]);
        setIsLoading(false);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        if (hls.levels[data.level]) {
          const level = hls.levels[data.level];
          setCurrentQuality(`${level.height}p`);
        }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', () => setIsLoading(false));
      video.addEventListener('error', () => {
        setError('Video failed to load');
        setIsLoading(false);
      });
    } else {
      setError('HLS is not supported in this browser');
      setIsLoading(false);
    }

    const handleTimeUpdate = () => {
      if (video.duration) {
        setCurrentTime(video.currentTime);
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [src]);

  // Fixed: Show controls on click and keep visible
  const handleVideoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setShowControls(true);
    
    // Keep controls visible for 4 seconds
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  // Fixed: Fullscreen state management with proper aspect ratio
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement ||
                               (document as any).webkitFullscreenElement ||
                               (document as any).mozFullScreenElement ||
                               (document as any).msFullscreenElement;
      
      setIsFullscreen(!!fullscreenElement);
      
      if (fullscreenElement) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    video.currentTime = pos * duration;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const changeQuality = (qualityIndex: number) => {
    if (hlsRef.current) {
      if (qualityIndex === 0) {
        hlsRef.current.currentLevel = -1;
        setCurrentQuality('Auto');
      } else {
        hlsRef.current.currentLevel = qualityIndex - 1;
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const enterFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if ((video as any).webkitRequestFullscreen) {
      (video as any).webkitRequestFullscreen();
    } else if ((video as any).mozRequestFullScreen) {
      (video as any).mozRequestFullScreen();
    } else if ((video as any).msRequestFullscreen) {
      (video as any).msRequestFullscreen();
    }
  };

  if (error) {
    return (
      <section className="py-4 sm:py-8 md:py-12 px-3 sm:px-4 md:px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="w-full max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6 md:p-8 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Play className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-red-800 mb-2">Video Unavailable</h3>
            <p className="text-sm sm:text-base text-red-600 mb-4">{error}</p>
            <div className="text-xs sm:text-sm text-red-500">
              <p>Please check your connection and try again.</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-4 sm:py-8 md:py-12 lg:py-16 px-3 sm:px-4 md:px-6">
      <div className="w-full max-w-7xl mx-auto">
        

        {/* Video Container - Fixed fullscreen aspect ratio */}
        <div className={`relative bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-lg sm:shadow-xl md:shadow-2xl overflow-hidden transform hover:scale-[1.01] sm:hover:scale-[1.02] transition-all duration-300 ${
          isFullscreen ? 'fixed inset-0 z-50 bg-black rounded-none flex items-center justify-center' : ''
        }`}>
          {/* Video Player */}
          <div 
            className={`relative bg-black overflow-hidden group ${
              isFullscreen 
                ? 'w-full h-full max-w-[100vw] max-h-[100vh] flex items-center justify-center' 
                : 'aspect-video rounded-t-lg sm:rounded-t-xl md:rounded-t-2xl'
            }`}
            onClick={handleVideoClick}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900">
                <div className="text-center text-white px-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 border-2 sm:border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3 sm:mb-4"></div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">Loading Video</h3>
                  <p className="text-sm sm:text-base text-blue-200">Preparing adaptive streaming...</p>
                  <div className="mt-3 sm:mt-4 bg-white/20 rounded-full h-1.5 sm:h-2 w-48 sm:w-64 mx-auto overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-400 to-purple-400 h-full w-1/3 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            )}

            <video
              ref={videoRef}
              className={`${isFullscreen ? 'max-w-full max-h-full w-auto h-auto' : 'w-full h-full'} object-contain`}
              style={{ display: isLoading ? 'none' : 'block' }}
              playsInline
              preload="metadata"
              aria-label={`Video player: ${title}`}
            />

            {/* Custom Controls Overlay */}
            {!isLoading && (
              <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
                {/* Play/Pause Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${
                    isFullscreen ? 'w-24 h-24' : 'w-16 h-16 sm:w-20 sm:h-20'
                  } bg-white/20 backdrop-blur-sm border-2 border-white/50 rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-200 group`}
                  aria-label={isPlaying ? 'Pause video' : 'Play video'}
                >
                  {isPlaying ? (
                    <Pause className={`${isFullscreen ? 'w-10 h-10' : 'w-6 h-6 sm:w-8 sm:h-8'} text-white ml-0`} />
                  ) : (
                    <Play className={`${isFullscreen ? 'w-10 h-10' : 'w-6 h-6 sm:w-8 sm:h-8'} text-white ml-1`} />
                  )}
                </button>

                {/* Bottom Controls */}
                <div className={`absolute bottom-0 left-0 right-0 ${isFullscreen ? 'p-8' : 'p-2 sm:p-4'}`}>
                  {/* Progress Bar */}
                  <div 
                    className={`w-full ${isFullscreen ? 'h-4' : 'h-1.5 sm:h-2'} bg-white/30 rounded-full cursor-pointer ${isFullscreen ? 'mb-6' : 'mb-2 sm:mb-3'} group`}
                    onClick={handleProgressClick}
                  >
                    <div 
                      className={`h-full bg-gradient-to-r from-sky-400 to-blue-700 rounded-full relative group-hover:${isFullscreen ? 'h-5' : 'h-2 sm:h-3'} transition-all duration-200`}
                      style={{ width: `${progress}%` }}
                    >
                      <div className={`absolute right-0 top-1/2 transform -translate-y-1/2 ${isFullscreen ? 'w-6 h-6' : 'w-3 h-3 sm:w-4 sm:h-4'} bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200`}></div>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex items-center justify-between text-white">
                    <div className={`flex items-center ${isFullscreen ? 'space-x-8' : 'space-x-2 sm:space-x-4'}`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlay();
                        }}
                        className={`${isFullscreen ? 'p-4' : 'p-1.5 sm:p-2'} hover:bg-white/20 rounded-full transition-colors`}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? <Pause className={`${isFullscreen ? 'w-8 h-8' : 'w-4 h-4 sm:w-5 sm:h-5'}`} /> : <Play className={`${isFullscreen ? 'w-8 h-8' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />}
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMute();
                        }}
                        className={`${isFullscreen ? 'p-4' : 'p-1.5 sm:p-2'} hover:bg-white/20 rounded-full transition-colors`}
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? <VolumeX className={`${isFullscreen ? 'w-8 h-8' : 'w-4 h-4 sm:w-5 sm:h-5'}`} /> : <Volume2 className={`${isFullscreen ? 'w-8 h-8' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />}
                      </button>

                      <span className={`${isFullscreen ? 'text-lg' : 'text-xs sm:text-sm'} font-medium ${isFullscreen ? 'block' : 'hidden xs:block'}`}>
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className={`flex items-center ${isFullscreen ? 'space-x-6' : 'space-x-1 sm:space-x-2'}`}>
                      {/* Quality Selector */}
                      <select
                        value={currentQuality}
                        onChange={(e) => {
                          const index = availableQualities.indexOf(e.target.value);
                          changeQuality(index);
                        }}
                        className={`${isFullscreen ? 'block text-base px-4 py-3' : 'hidden sm:block text-xs sm:text-sm px-1.5 sm:px-2 py-1'} bg-black/50 text-white rounded border border-white/30 hover:bg-black/70 transition-colors`}
                        aria-label="Video quality"
                      >
                        {availableQualities.map((quality) => (
                          <option key={quality} value={quality} className="bg-black">
                            {quality}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          enterFullscreen();
                        }}
                        className={`${isFullscreen ? 'p-4' : 'p-1.5 sm:p-2'} hover:bg-white/20 rounded-full transition-colors`}
                        aria-label="Enter fullscreen"
                      >
                        <Maximize className={`${isFullscreen ? 'w-8 h-8' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quality Indicator */}
                <div className={`absolute ${isFullscreen ? 'top-8 right-8 text-base px-6 py-3' : 'top-2 sm:top-4 right-2 sm:right-4 text-xs px-2 sm:px-3 py-1'} bg-black/50 backdrop-blur-sm text-white rounded-full border border-white/20`}>
                  {currentQuality}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoSection;

