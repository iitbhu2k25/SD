'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Maximize2, Volume2, Settings } from 'lucide-react';

interface ImageData {
  src: string;
  title?: string;
  description?: string;
}

interface CinemaGalleryProps {
  images?: ImageData[];
  autoPlayInterval?: number;
  className?: string;
}

const CinemaImageGallery: React.FC<CinemaGalleryProps> = ({
  images = [
    {
      src: "/Images/gallery/g1.jpg",
      title: "Image 1",
      description: "Description"
    },
    {
      src: "/Images/gallery/g2.jpg",
      title: "Image 2",
      description: "Description"
    },
    {
      src: "/Images/gallery/g3.jpg",
      title: "Image 3",
      description: "Description"
    }],
  autoPlayInterval = 3000,
  className = ""
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // Progress bar animation
  useEffect(() => {
    if (!isPlaying) {
      setProgress(0);
      return;
    }

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressPercent = (elapsed / autoPlayInterval) * 100;
      
      if (progressPercent >= 100) {
        setProgress(100);
        clearInterval(progressInterval);
      } else {
        setProgress(progressPercent);
      }
    }, 16); // ~60fps

    return () => clearInterval(progressInterval);
  }, [currentIndex, isPlaying, autoPlayInterval]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, autoPlayInterval);

    return () => clearTimeout(timer);
  }, [currentIndex, isPlaying, autoPlayInterval, images.length]);

  const handleImageChange = useCallback((index: number) => {
    setIsLoading(true);
    setCurrentIndex(index);
    setProgress(0);
    setTimeout(() => setIsLoading(false), 300);
  }, []);

  const goToPrevious = useCallback(() => {
    const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    handleImageChange(newIndex);
  }, [currentIndex, images.length, handleImageChange]);

  const goToNext = useCallback(() => {
    const newIndex = (currentIndex + 1) % images.length;
    handleImageChange(newIndex);
  }, [currentIndex, images.length, handleImageChange]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
    setProgress(0);
  }, [isPlaying]);

  const currentImage = images[currentIndex];

  return (
    <div className={`relative w-full h-screen bg-black overflow-hidden ${className}`}>
      {/* Theater Ambient Background */}
      <div className="absolute inset-0 bg-gradient-radial from-gray-900/20 via-black to-black" />
      
      {/* Cinema Screen Container */}
      <div className="relative w-full h-full flex flex-col">
        
        {/* Main Cinema Screen */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12">
          <div className="relative w-full max-w-7xl mx-auto">
            
            {/* Screen Glow Effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 rounded-3xl blur-xl opacity-60" />
            
            {/* Main Screen */}
            <div className="relative aspect-video w-full bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
              
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
              
              {/* Main Image */}
              <img
                src={currentImage.src}
                alt={currentImage.title || `Cinema slide ${currentIndex + 1}`}
                className={`w-full h-full object-cover transition-all duration-700 ${
                  isLoading ? 'opacity-50 scale-110' : 'opacity-100 scale-100'
                }`}
                onLoad={() => setIsLoading(false)}
              />
              
              {/* Film Grain Overlay */}
              <div className="absolute inset-0 bg-black/10 mix-blend-overlay opacity-30" 
                   style={{
                     backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`,
                     backgroundSize: '3px 3px'
                   }} />
              
              {/* Navigation Controls */}
              <button
                onClick={goToPrevious}
                className="absolute left-6 top-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-sm text-white p-4 rounded-full border border-white/20 hover:bg-black/90 hover:scale-110 transition-all duration-200 group opacity-0 hover:opacity-100 focus:opacity-100"
              >
                <ChevronLeft size={28} className="group-hover:scale-110 transition-transform" />
              </button>
              
              <button
                onClick={goToNext}
                className="absolute right-6 top-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-sm text-white p-4 rounded-full border border-white/20 hover:bg-black/90 hover:scale-110 transition-all duration-200 group opacity-0 hover:opacity-100 focus:opacity-100"
              >
                <ChevronRight size={28} className="group-hover:scale-110 transition-transform" />
              </button>
              
              {/* Image Info Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 sm:p-8">
                <h2 className="text-white text-2xl sm:text-3xl md:text-4xl font-bold mb-2 tracking-wide">
                  {currentImage.title}
                </h2>
                <p className="text-gray-300 text-sm sm:text-base md:text-lg font-light">
                  {currentImage.description}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Cinema Control Panel */}
        <div className="bg-gradient-to-t from-black via-gray-900/95 to-transparent backdrop-blur-sm border-t border-gray-800/50 p-4 sm:p-6">
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-gray-400 text-sm mb-2">
              <span>{String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</span>
              <span className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
                {isPlaying ? 'LIVE' : 'PAUSED'}
              </span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {/* Main Controls */}
          <div className="flex items-center justify-between">
            
            {/* Left Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlayPause}
                className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-all duration-200 hover:scale-110 shadow-lg"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              
              <div className="hidden sm:flex items-center gap-3 text-gray-400">
                <Volume2 size={20} />
                <Settings size={20} className="hover:text-white cursor-pointer transition-colors" />
                <Maximize2 size={20} className="hover:text-white cursor-pointer transition-colors" />
              </div>
            </div>
            
            {/* Thumbnail Theater Seats */}
            <div className="flex-1 mx-6 overflow-hidden">
              <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pb-2">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageChange(index)}
                    className={`flex-shrink-0 relative group transition-all duration-300 ${
                      index === currentIndex 
                        ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-black scale-110' 
                        : 'hover:scale-105'
                    }`}
                  >
                    <div className="relative w-12 h-8 sm:w-16 sm:h-10 md:w-20 md:h-12 rounded overflow-hidden bg-gray-800 border border-gray-700">
                      <img
                        src={image.src}
                        alt={`Seat ${index + 1}`}
                        className={`w-full h-full object-cover transition-all duration-300 ${
                          index === currentIndex 
                            ? 'opacity-100 brightness-110' 
                            : 'opacity-60 hover:opacity-100 grayscale hover:grayscale-0'
                        }`}
                      />
                      
                      {/* Seat Number */}
                      <div className={`absolute inset-x-0 bottom-0 text-center text-xs font-mono ${
                        index === currentIndex ? 'bg-red-500 text-white' : 'bg-black/70 text-gray-300'
                      }`}>
                        {String(index + 1).padStart(2, '0')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Right Info */}
            <div className="text-right text-gray-400 text-sm hidden md:block min-w-[100px]">
              <div className="font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="text-xs opacity-60">CINEMA MODE</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Keyboard Shortcuts Hint */}
      <div className="absolute top-4 right-4 text-gray-500 text-xs hidden lg:block">
        <div className="bg-black/50 backdrop-blur-sm rounded px-2 py-1 border border-gray-800">
          ← → Space ESC
        </div>
      </div>
    </div>
  );
};

export default CinemaImageGallery;