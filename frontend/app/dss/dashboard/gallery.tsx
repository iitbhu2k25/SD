// frontend/app/dss/varuna/dashboard/gallery.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, AlertCircle, MapPin
} from 'lucide-react';

interface GalleryImage {
  name: string;
  path: string;
  folder: string;
}

interface GallerySection {
  id: string;
  title: string;
  subtitle: string;
  folderPath: string;
  images: GalleryImage[];
}

// --- 1. DEFINITIONS ---

const GALLERY_SECTIONS: Omit<GallerySection, 'images'>[] = [
  {
    id: 'drone',
    title: 'Drone Aerial Views',
    subtitle: 'Aerial Perspectives',
    folderPath: '/Images/dashboard/gallery/drone'
  },
  {
    id: 'site_visit',
    title: 'Site Visits',
    subtitle: 'Ground Documentation',
    folderPath: '/Images/dashboard/gallery/site_visit'
  },
  {
    id: 'sampling',
    title: 'Field Work ',
    subtitle: 'Scientific Analysis',
    folderPath: '/Images/dashboard/gallery/sampling'
  },
  {
    id: 'conferences',
    title: 'Events at SLCR',
    subtitle: 'Stakeholder Engagement',
    folderPath: '/Images/dashboard/gallery/conferences'
  },
  {
    id: 'activities',
    title: 'Visitors at SLCR',
    subtitle: 'Collaborative Efforts',
    folderPath: '/Images/dashboard/gallery/activities'
  },
  {
    id: 'outreach',
    title: 'SLCR Outreach',
    subtitle: 'Collaborative Efforts',
    folderPath: '/Images/dashboard/gallery/outreach'
  },
  {
    id: 'biodiversity', 
    title: 'Biodiversity & Ecology', 
    subtitle: 'Flora and Fauna', 
    folderPath: '/Images/dashboard/gallery/biodiversity' 
  }
];

// --- 2. SUB-COMPONENTS ---

const SidebarCard = ({ section, onSelect, isActive }: { section: GallerySection; onSelect: (id: string) => void; isActive: boolean }) => {
  const thumbnail = section.images[0]?.path || 'https://via.placeholder.com/300x150?text=Varuna';

  return (
    <div 
      onClick={() => onSelect(section.id)}
      className={`
        relative w-full h-28 rounded-lg overflow-hidden cursor-pointer group mb-3 shadow-md transition-all duration-300 border-2
        ${isActive ? 'border-blue-600 ring-2 ring-blue-200 transform scale-[1.02]' : 'border-transparent hover:shadow-xl'}
      `}
    >
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
        style={{ backgroundImage: `url('${thumbnail}')` }}
      />
      <div className={`absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-all ${isActive ? 'bg-black/60' : ''}`} />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
        <h3 className="text-white text-lg font-bold leading-tight drop-shadow-md">
          {section.title}
        </h3>
      </div>
    </div>
  );
};

const SectionImageBrowser = ({ section }: { section: GallerySection }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(section.images[0] || null);

  const getDisplayFileName = (fileName: string) => {
    let nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    return nameWithoutExt.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  useEffect(() => {
    setCurrentIndex(0);
    setSelectedImage(section.images[0] || null);
  }, [section.id]);

  const handlePrevious = () => {
    if (section.images.length === 0) return;
    const newIndex = (currentIndex - 1 + section.images.length) % section.images.length;
    setCurrentIndex(newIndex);
    setSelectedImage(section.images[newIndex]);
  };

  const handleNext = () => {
    if (section.images.length === 0) return;
    const newIndex = (currentIndex + 1) % section.images.length;
    setCurrentIndex(newIndex);
    setSelectedImage(section.images[newIndex]);
  };

  if (section.images.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">No images found in the {section.title} folder.</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn bg-white p-6 rounded-2xl shadow-lg border border-gray-200 mt-8">
      <div className="flex items-center justify-between mb-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
             {section.title}
          </h2>
          <p className="text-sm text-gray-500">Viewing {currentIndex + 1} of {section.images.length} images</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Image Area - RESTRUCTURED */}
        <div className="lg:col-span-9 flex flex-col shadow-sm rounded-xl overflow-hidden border border-gray-200">
          
          {/* 1. Image Container (Top) */}
          <div className="relative h-[500px] bg-gray-50 group w-full flex items-center justify-center">
            {selectedImage && (
              <img 
                src={selectedImage.path} 
                alt={selectedImage.name} 
                className="w-full h-full object-contain p-1" 
              />
            )}
            
            {/* Navigation Arrows (Overlaid on image area) */}
            <button 
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 backdrop-blur-sm text-white p-3 rounded-full transition-all opacity-0 group-hover:opacity-100 shadow-lg"
            >
              <ChevronLeft size={28} />
            </button>
            <button 
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 backdrop-blur-sm text-white p-3 rounded-full transition-all opacity-0 group-hover:opacity-100 shadow-lg"
            >
              <ChevronRight size={28} />
            </button>
          </div>

          {/* 2. Name Strip  */}
          <div className="h-16 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 flex items-center justify-center relative border-t-2 border-b-2 border-gradient-to-r from-blue-500 to-cyan-500">
            <style jsx>{`
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .animate-fadeIn {
                animation: fadeIn 0.5s ease-out;
              }
            `}</style>
            <div className="absolute inset-0 opacity-0 hover:opacity-200 transition-opacity duration-300 bg-gradient-to-r from-blue-900/20 to-cyan-900/20"></div>
            
            <div className="relative flex flex-col items-center gap-1">
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r bg-gradient-to-r from-amber-400 via-yellow-100 to-amber-400 text-lg tracking-widest uppercase drop-shadow-lg animate-fadeIn">
                {selectedImage ? getDisplayFileName(selectedImage.name) : ''}
              </span>
              <div className="h-0.5 w-32 bg-gradient-to-r from-transparent via-amber-200 to-transparent"></div>
            </div>
          </div>
        </div>

        {/* Thumbnails Sidebar */}
        <div className="lg:col-span-3 flex flex-col gap-2 h-[556px] overflow-y-auto custom-scrollbar pr-2">
          {section.images.map((img, idx) => (
            <div 
              key={idx}
              onClick={() => { setSelectedImage(img); setCurrentIndex(idx); }}
              className={`
                relative w-full h-24 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all
                ${selectedImage?.path === img.path ? 'border-blue-600 opacity-100 ring-2 ring-blue-200' : 'border-transparent opacity-60 hover:opacity-100'}
              `}
            >
              <img src={img.path} alt="" className="w-full h-full object-cover" />
              <div className={`absolute bottom-0 left-0 right-0 p-1 text-white text-xs font-medium text-center bg-black/50 transition-opacity 
                ${selectedImage?.path === img.path ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
              `}>
                  {getDisplayFileName(img.name)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


// --- 3. MAIN COMPONENT ---

export default function VarunaGallery() {
  const [sections, setSections] = useState<GallerySection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('drone');
  const [loading, setLoading] = useState(true);

  const INTRO_IMAGE_PATH = '/Images/dashboard/gallery/main.jpeg';

  const STATIC_IMAGE_MANIFEST: { [key: string]: string[] } = {
    'drone': ['View1.png', 'View2.png', 'View3.png', 'View4.png', 'View5.png', 'View6.png', 'View7.png'],
    'site_visit': ['BLW_STP.jpeg', 'VARUNAPUL_NADESAR.jpeg'],
    'sampling': ['Picture1.jpg', 'Picture2.jpg', 'Picture4.jpg', 'Picture5.jpg', 'Picture6.jpg', 'Picture3.jpeg', 'Picture7.jpeg'],
    'conferences': ['RHAR_conference_2025.jpg','FOREIGN_DELEGATE.jpg','RHAR_2025.jpg','WORKSHOP.png'],
    'activities': ['Mr.Dheeraj Joshi Director NMCG.png','Mr. Dheeraj Joshi in Meeting.png','ISRO MEMBERS.png'],
    'biodiversity': [
        'aquatic plants.jpg',
        'Asian openbill.jpg',
        'Asian water snake.jpg',
        'bamboo.jpg',
        'banyan.jpg',
        'Bat.jpg',
        'beetle.jpg',
        'black drongo.jpg',
        'butterfly.jpg',
        'carp.jpg',
        'caterpillar.jpg',
        'cattail.jpg',
        'Cattle egret.jpg',
        'cocklebur.jpg',
        'Common kingfisher.jpg',
        'Cormorant.jpg',
        'datura.jpg',
        'Grasshopper.jpg',
        'Frog.jpg',
        'fungus.jpg',
        'Garden lizard.jpg',
        'Hydrophytes.jpg',
        'Indian Jujube.jpg',
        'Indian pond heron.jpg',
        'Indian Roller.jpg',
        'klip daga.jpg',
        'laughing dove.jpg',
        'Marsilea (clover).jpg',
        'Metallic shield bug.jpg',
        'Mollusca.jpg',
        'Myna.jpg',
        'Nilgai.jpg',
        'Oriental magpie Robin.jpg',
        'Peacock.jpg',
        'Peahens.jpg',
        'plain tiger.jpg',
        'pond.jpg',
        'Red wattled lapwing.jpg',
        'riparian vegetation.jpg',
        'Sarus Crane.jpg',
        'toothache.jpg',
        'water hen.jpg',
        'water strider.jpg',
        'Lady bug beetle.jpeg',
        'water birdnest.jpg'
    ],
    'outreach': ['NMCG_Review_Meeting.jpeg', 'NMCG_Review.jpeg']
  };

  useEffect(() => {
    const loadData = () => {
      const populatedSections = GALLERY_SECTIONS.map(sec => ({
        ...sec,
        images: (STATIC_IMAGE_MANIFEST[sec.id] || []).map((fileName, idx) => ({
          name: fileName, 
          path: `${sec.folderPath}/${fileName}`,
          folder: sec.id
        }))
      }));
      setSections(populatedSections);
      setLoading(false);
    };
    loadData();
  }, []);

  const activeSection = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6 md:p-12 font-sans text-gray-800 animate-fadeIn">
      <div className="max-w-7xl mx-auto">
        
        {/* --- TOP ROW: INTRODUCTION + SIDEBAR --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* LEFT COLUMN: Introduction */}
          <div className="lg:col-span-8">
            <div className="text-center mb-8 border-b-2 border-gray-200 pb-6">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 uppercase tracking-wide mb-3">
                THE VARUNA GALLERY: AN INITIATIVE OF SMART LABORATORY ON CLEAN RIVERS (SLCR) ,IIT BHU VARANASI
              </h1>
              <p className="text-lg font-medium text-gray-600 italic">
                A gallery for public awareness, conservation and restoration of the river
              </p>
            </div>

            <div className="prose prose-lg text-justify text-gray-700 leading-relaxed max-w-none">
              {/* Fixed Main Image */}
              <div className="float-right ml-8 mb-6 w-full md:w-5/12">
                <div className="bg-white p-2 rounded-xl shadow-lg border border-gray-200">
                  <img 
                    src={INTRO_IMAGE_PATH} 
                    alt="Varuna River Aerial View" 
                    className="rounded-lg w-full h-auto object-cover"
                    onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Main+Image+Not+Found'} 
                  />
                  <p className="text-xs text-center text-gray-500 mt-2 font-medium">Aerial view of the Varuna River Basin</p>
                </div>
              </div>

              <p className="mb-4 first-letter:text-5xl first-letter:font-bold first-letter:text-blue-900 first-letter:mr-3 first-letter:float-left">
                The Varuna River occupies a unique position in Varanasi's cultural and ecological ethos. 
                Historically significant as one of the two rivers (along with Assi) that give Varanasi its name, 
                it flows into the holy Ganges at the northern end of the city. From times immemorial, 
                the confluence has been a site of faith and reverence. However, the river's existence is 
                currently under severe threat due to the enormously increasing load of pollution year by year.
              </p>
              
              <p className="mb-4">
                Unlike the main Ganges stream, the Varuna has suffered from reduced flow and heavy encroachment. 
                The water, which should be a lifeline for the northern districts, often stagnates. A lack of dissolved 
                oxygen promotes the growth of anaerobic bacteria, leading to foul odors and a decline in aquatic life. 
                The present situation reflects decades of indifference towards the environment. The basin has been treated 
                as a reservoir for dumping waste—plastic bags, industrial effluent from small-scale dyeing units, and untreated sewage.
              </p>

              <p className="mb-4">
                Such exogenic activities have robbed the river of its pristine glory. Therefore, collective action from all 
                stakeholders—government, academia, and citizens—is needed to bring "Varuna" back to life. 
                <span className="font-bold text-blue-900"> The Smart Laboratory on Clean River (SLCR) at IIT (BHU)</span> has made a remarkable effort by establishing 
                this digital Varuna Gallery.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Sidebar Navigation */}
          <div className="lg:col-span-4 sticky top-6">
            <h2 className="text-2xl font-bold text-blue-900 mb-6 pb-2 border-b-2 border-blue-100">
              Varuna Gallery
            </h2>
            
            <div className="flex flex-col gap-2">
              {!loading && sections.map((section) => (
                <SidebarCard 
                  key={section.id} 
                  section={section} 
                  onSelect={setSelectedSectionId}
                  isActive={selectedSectionId === section.id}
                />
              ))}
            </div>
          </div>
        </div>

        {/* --- BOTTOM ROW: IMAGE GALLERY --- */}
        <div id="gallery-view" className="mt-4">
          {activeSection && (
            <SectionImageBrowser section={activeSection} />
          )}
        </div>

      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}