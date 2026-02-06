'use client';
import React from 'react';
import { Calendar, Users, MapPin, Award, BookOpen, Target, Layers, Navigation, Database, Map } from 'lucide-react';
import ImageSlider from '@/components/ImageView';

interface EventSection {
  title: string;
  date: string;
  location: string;
  description: string;
  highlights: string[];
  images?: { title: string; alt: string }[];
}
const Img11=[
    "/Images/activity/Imagess/meeting/img1.jpeg",
    "/Images/activity/Imagess/meeting/img2.jpeg",
    "/Images/activity/Imagess/meeting/img3.jpeg"
]
const TrainImg=[
    "/Images/activity/Imagess/training/img4.jpeg",
    "/Images/activity/Imagess/training/img5.jpeg",
    "/Images/activity/Imagess/training/img6.jpeg"
]
const EventsPage: React.FC = () => {
  const dssEvent: EventSection = {
    title: "DSS-Expert Meeting cum Workshop",
    date: "21 July 2025",
    location: "Seminar Hall, Department of Civil Engineering, IIT (BHU)",
    description: "A one-day technical and stakeholder interaction programme on the Decision Support System (DSS) for Water Resource Management was successfully organized, bringing together academicians, domain experts, industry professionals, and policymakers to deliberate on contemporary challenges and innovations in water resource management.",
    highlights: [
      "Environmental forecasting and flood protection practices",
      "Water resource planning and industrial DSS applications",
      "System dynamics approaches under DSS-WRM",
      "Expert lectures delivered in offline and online modes",
      "Panel discussion on practical implementation and policy relevance",
      "Strengthening collaborative, data-driven water governance"
    ],
  };

  const mikeEvent: EventSection = {
    title: "MIKE Training Programme",
    date: "15th - 19th December 2025",
    location: "SLCR Laboratory, IIT (BHU)",
    description: "The Hydrological Modelling Using MIKE+ Training Programme was conducted by Ramboll India as part of the Decision Support System (DSS) for Water Resource Management under the Smart Laboratory on Clean River (SLCR). The programme was designed to build technical capacity among researchers, project staff, and students.",
    highlights: [
      "Rainfall–Runoff (RR), Hydrodynamic (HD), and Data Assimilation (DA) models",
      "Integrated river–catchment models for flood forecasting",
      "GIS-based model building and data management",
      "Model calibration, validation, and scenario simulations",
      "Hands-on practice with MIKE+ and MIKE View tools",
      "Science-based, data-driven water resource management capacity building"
    ],
    
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Topographic Background Pattern */}
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="topo" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M 0 50 Q 50 40, 100 50 T 200 50" stroke="#06b6d4" fill="none" strokeWidth="0.5" opacity="0.3"/>
              <path d="M 0 100 Q 50 90, 100 100 T 200 100" stroke="#06b6d4" fill="none" strokeWidth="0.5" opacity="0.3"/>
              <path d="M 0 150 Q 50 140, 100 150 T 200 150" stroke="#06b6d4" fill="none" strokeWidth="0.5" opacity="0.3"/>
              <circle cx="50" cy="50" r="2" fill="#06b6d4" opacity="0.3"/>
              <circle cx="150" cy="100" r="2" fill="#06b6d4" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo)"/>
        </svg>
      </div>

      {/* Header with Cartographic Style */}
      <header className="relative border-b border-cyan-500/20 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/50 via-slate-950/80 to-slate-950"></div>
        
        <div className="relative max-w-7xl mx-auto px-8 py-16">
          {/* Coordinate Grid Decoration */}
          <div className="absolute top-4 right-8 font-mono text-xs text-cyan-400/40 tracking-wider">
            25.2677° N, 82.9913° E
          </div>
          
          <div className="flex items-start gap-6 mb-8">
            <div className="hidden md:block p-4 bg-cyan-500/10 border border-cyan-500/30 rounded">
              <Layers className="w-12 h-12 text-cyan-400" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em' }}>
                WATER RESOURCE
                <span className="block text-cyan-400 font-semibold">MANAGEMENT INITIATIVES</span>
              </h1>
              <p className="text-xl text-slate-300 font-light tracking-wide" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                Decision Support System (DSS) for Sustainable Water Governance
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-cyan-400/80 font-mono text-sm tracking-wide border-l-2 border-cyan-500/50 pl-4">
            <MapPin className="w-4 h-4" />
            <span>INDIAN INSTITUTE OF TECHNOLOGY (BHU), VARANASI</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-16">
        {/* DSS-Expert Meeting Section */}
        <section className="mb-24 relative">
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 via-cyan-500/50 to-transparent"></div>
          
          <div className="relative">
            {/* Section Header with GIS Style */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center justify-center w-12 h-12 bg-cyan-500/20 border border-cyan-500/40 rounded-sm">
                <Users className="w-6 h-6 text-cyan-400" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <div className="font-mono text-xs text-cyan-400/60 tracking-widest mb-1">EVENT_01 / WORKSHOP</div>
                <h2 className="text-4xl font-light tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  DSS-EXPERT MEETING CUM WORKSHOP
                </h2>
              </div>
            </div>

            {/* Content Card with GIS Data Layer Style */}
            <div className="bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm rounded-sm overflow-hidden shadow-2xl">
              {/* Metadata Bar */}
              <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700/50 flex flex-wrap gap-6 font-mono text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400 font-semibold">DATE:</span>
                  <span>{dssEvent.date}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Navigation className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400 font-semibold">LOCATION:</span>
                  <span>{dssEvent.location}</span>
                </div>
              </div>

              <div className="p-8">
                <p className="text-slate-300 text-lg leading-relaxed mb-8" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  {dssEvent.description}
                </p>

                {/* Technical Highlights Grid */}
                <div className="relative bg-slate-800/30 border border-slate-700/50 rounded-sm p-6">
                  <div className="absolute top-0 left-0 px-3 py-1 bg-cyan-500/20 border-b border-r border-cyan-500/40 font-mono text-xs text-cyan-400 tracking-widest">
                    KEY HIGHLIGHTS
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 mt-8">
                    {dssEvent.highlights.map((highlight, index) => (
                      <div key={index} className="flex items-start gap-3 group">
                        <div className="mt-1 w-1.5 h-1.5 bg-cyan-400 rotate-45 group-hover:bg-cyan-300 transition-colors"></div>
                        <span className="text-slate-300 text-sm leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                          {highlight}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <ImageSlider images={Img11}  interval={2000} direction="rtl" />

                {/* Conclusion Banner */}
                <div className="mt-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent"></div>
                  <div className="relative border-l-4 border-cyan-500 pl-6 py-4">
                    <div className="font-mono text-xs text-cyan-400/60 tracking-widest mb-2">OUTCOME</div>
                    <p className="text-slate-300 italic leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      The programme concluded with a vote of thanks and group photograph, marking a meaningful step toward strengthening collaborative, data-driven, and sustainable water resource management initiatives under the DSS framework.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MIKE Training Programme Section */}
        <section className="relative">
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 via-emerald-500/50 to-transparent"></div>
          
          <div className="relative">
            {/* Section Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center justify-center w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-sm">
                <Database className="w-6 h-6 text-emerald-400" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <div className="font-mono text-xs text-emerald-400/60 tracking-widest mb-1">EVENT_02 / TRAINING</div>
                <h2 className="text-4xl font-light tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  MIKE TRAINING PROGRAMME
                </h2>
              </div>
            </div>

            {/* Content Card */}
            <div className="bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm rounded-sm overflow-hidden shadow-2xl">
              {/* Metadata Bar */}
              <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700/50 flex flex-wrap gap-6 font-mono text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">DURATION:</span>
                  <span>{mikeEvent.date}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Navigation className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">VENUE:</span>
                  <span>{mikeEvent.location}</span>
                </div>
              </div>

              <div className="p-8">
                {/* Partner Badge */}
                <div className="inline-flex items-center gap-3 mb-6 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-sm">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <div className="font-mono text-sm">
                    <span className="text-emerald-400">CONDUCTED BY:</span>
                    <span className="text-slate-300 ml-2">Ramboll India | SLCR</span>
                  </div>
                </div>

                <p className="text-slate-300 text-lg leading-relaxed mb-8" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  {mikeEvent.description}
                </p>

                {/* Training Framework */}
                <div className="relative bg-slate-800/30 border border-slate-700/50 rounded-sm p-6 mb-8">
                  <div className="absolute top-0 left-0 px-3 py-1 bg-emerald-500/20 border-b border-r border-emerald-500/40 font-mono text-xs text-emerald-400 tracking-widest">
                    TECHNICAL COVERAGE
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 mt-8">
                    {mikeEvent.highlights.map((highlight, index) => (
                      <div key={index} className="flex items-start gap-3 group">
                        <div className="mt-1 w-1.5 h-1.5 bg-emerald-400 rotate-45 group-hover:bg-emerald-300 transition-colors"></div>
                        <span className="text-slate-300 text-sm leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                          {highlight}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visual Documentation Grid */}
                 <ImageSlider images={TrainImg}  interval={2000} direction="ltr" />
                {/* Impact Statement */}
                <div className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent"></div>
                  <div className="relative border-l-4 border-emerald-500 pl-6 py-4">
                    <div className="font-mono text-xs text-emerald-400/60 tracking-widest mb-2">IMPACT</div>
                    <p className="text-slate-300 italic leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      The training strengthened institutional and technical capacity for science-based, data-driven water resource management, directly supporting the operationalization of the DSS for small river basin management in India.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>


      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
      `}</style>
    </div>
  );
};

export default EventsPage;