'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Heart, Download, Share2, Search } from 'lucide-react';

const galleryImages = [
  '/Images/gallery/g1.jpg',
  '/Images/gallery/g2.webp',
  '/Images/gallery/g3.webp',
  '/Images/gallery/g4.webp',
  '/Images/gallery/g5.webp',
  '/Images/gallery/g6.webp',
  '/Images/gallery/g7.webp',
  '/Images/gallery/g8.webp',
  '/Images/gallery/g9.webp',
  '/Images/gallery/g10.webp',
];

const blurDataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknygsB0tLuFWJYIWPP8AV/8APaGQ4/m+tT6S8DK/ER/MJOl0iLi2dxfKgMrQ==";

export default function GalleryPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [likedImages, setLikedImages] = useState<Set<number>>(new Set());
  const [imageLoadStates, setImageLoadStates] = useState<{[key: number]: 'loading' | 'loaded' | 'error'}>({});

  // Filter images based on search
  const filteredImages = galleryImages.filter((_, index) => 
    index.toString().includes(searchQuery) || 
    `Image ${index + 1}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle image load states
  const handleImageLoad = (index: number) => {
    setImageLoadStates(prev => ({ ...prev, [index]: 'loaded' }));
  };

  const handleImageError = (index: number) => {
    setImageLoadStates(prev => ({ ...prev, [index]: 'error' }));
  };

  // Toggle like functionality
  const toggleLike = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImage && e.key === 'Escape') {
        setSelectedImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage]);

  // Generate random card styles for Pinterest-like layout
  const getCardStyle = (index: number) => {
    const patterns = [
      'col-span-1 row-span-1', // square
      'col-span-1 row-span-2', // tall
      'col-span-2 row-span-1', // wide
      'col-span-1 row-span-1', // square
      'col-span-1 row-span-2', // tall
    ];
    return patterns[index % patterns.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-4xl font-light text-gray-900 tracking-wide">Gallery</h1>
              <p className="text-gray-500 mt-1">{galleryImages.length} beautiful images</p>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-gray-300 focus:border-transparent outline-none text-sm bg-white shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto p-6">
        {filteredImages.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-800 mb-2">No images found</h3>
            <p className="text-gray-500">Try a different search term</p>
          </div>
        ) : (
          <div 
            className="grid gap-4 auto-rows-[200px]"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'
            }}
          >
            {filteredImages.map((src, index) => {
              const originalIndex = galleryImages.indexOf(src);
              const isLiked = likedImages.has(originalIndex);
              const loadState = imageLoadStates[originalIndex] || 'loading';
              
              return (
                <div
                  key={originalIndex}
                  className={`group relative cursor-pointer rounded-2xl overflow-hidden bg-white shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.02] ${getCardStyle(index)}`}
                  onClick={() => setSelectedImage(src)}
                >
                  {/* Image */}
                  <div className="relative w-full h-full">
                    <Image
                      src={src}
                      alt={`Gallery image ${originalIndex + 1}`}
                      fill
                      className={`object-cover transition-all duration-700 group-hover:scale-110 ${
                        loadState === 'loaded' ? 'opacity-100' : 'opacity-0'
                      }`}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      placeholder="blur"
                      blurDataURL={blurDataURL}
                      quality={85}
                      onLoad={() => handleImageLoad(originalIndex)}
                      onError={() => handleImageError(originalIndex)}
                    />

                    {/* Loading State */}
                    {loadState === 'loading' && (
                      <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                      </div>
                    )}

                    {/* Error State */}
                    {loadState === 'error' && (
                      <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                            <X className="w-6 h-6" />
                          </div>
                          <p className="text-sm">Failed to load</p>
                        </div>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      
                      {/* Top Actions */}
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button
                          onClick={(e) => toggleLike(originalIndex, e)}
                          className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-all duration-200 ${
                            isLiked 
                              ? 'bg-red-500 text-white scale-110' 
                              : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                        >
                          <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                        </button>
                      </div>

                      {/* Bottom Actions */}
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                        <span className="text-white font-medium text-sm">
                          Image {originalIndex + 1}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors duration-200"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors duration-200"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Like Indicator */}
                    {isLiked && (
                      <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                        <Heart className="w-5 h-5 text-white fill-current" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          {/* Close Button */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 z-10 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors duration-200"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image Container */}
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <div className="relative w-full h-full">
              <Image
                src={selectedImage}
                alt="Selected image"
                fill
                className="object-contain"
                sizes="100vw"
                quality={95}
                priority
              />
            </div>
          </div>

          {/* Image Actions */}
          <div className="absolute bottom-6 left-6 right-6 bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <h3 className="font-medium">High Quality Image</h3>
                <p className="text-sm text-white/80">Click outside to close</p>
              </div>
              
              <div className="flex gap-3">
                <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors duration-200">
                  <Heart className="w-5 h-5" />
                </button>
                <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors duration-200">
                  <Download className="w-5 h-5" />
                </button>
                <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors duration-200">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Keyboard Hint */}
          <div className="absolute top-6 left-6 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
            <p className="text-white/80 text-sm">Press <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">ESC</kbd> to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
