"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, useAnimate } from "framer-motion";

// --- DATA ---
const gridItems = [
  {
    href: "dss/home/home_grid/home_card/basic_module",
    imgSrc: "/Images/GridSection/basicmodule.jpg",
    alt: "STP Module",
    title: "STP Module",
    acronym: "SM",
    description: "Essential tools for sewage load estimation and predictions",
    color: "from-blue-400/30 to-blue-600/40",
  },
  {
    href: "dss/home/home_grid/home_card/gwm",
    imgSrc: "/Images/GridSection/gwm.webp",
    alt: "Ground Water Management",
    title: "Ground Water Management",
    acronym: "gwm",
    description: "Advanced tools for sustainable groundwater resource management",
    color: "from-blue-400/30 to-blue-600/40",
  },
  {
    href: "dss/home/home_grid/home_card/rwm",
    imgSrc: "/Images/GridSection/rwm.jpeg",
    alt: "River Water Management",
    title: "River Water Management",
    acronym: "rwm",
    description: "Integrated solutions for river ecosystems and flood control",
    color: "from-blue-400/30 to-blue-600/40",
  },
  {
    href: "dss/home/home_grid/home_card/wrm",
    imgSrc: "/Images/GridSection/wrm.jpg",
    alt: "Water Resource Management",
    title: "Water Resource Management",
    acronym: "wrm",
    description: "Optimizing water supply and demand forecasting",
    color: "from-blue-400/30 to-blue-600/40",
  },
  {
    href: "dss/home/home_grid/home_card/shsd",
    imgSrc: "/Images/GridSection/shs.jpeg",
    alt: "Socio-Hydrological System",
    title: "Socio-Hydrological System",
    acronym: "SHSD",
    description: "Integrating water management with socio-economic factors",
    color: "from-blue-400/30 to-blue-600/40",
  },
];

// --- COMPONENTS ---

// 1. Smoke Particle Component (For Header)
const SmokeCloud = ({ delay, x }: { delay: number; x: number }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0, y: 0 }}
    animate={{ 
      scale: [0, 1.5, 2], 
      opacity: [0, 0.8, 0], 
      y: [0, 20, 40],
      x: [0, x] 
    }}
    transition={{ duration: 1.5, delay: delay, ease: "easeOut" }}
    className="absolute bottom-0 w-8 h-8 rounded-full bg-slate-200 blur-md"
    style={{ left: '50%', transform: 'translateX(-50%)' }}
  />
);

// 2. The Rocket Header Component
const RocketHeader = () => {
  const [scope, animate] = useAnimate();
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    const sequence = async () => {
      // 1. Countdown
      setCountdown("3");
      await new Promise(r => setTimeout(r, 600));
      setCountdown("2");
      await new Promise(r => setTimeout(r, 600));
      setCountdown("1");
      await new Promise(r => setTimeout(r, 600));
      setCountdown("LIFT OFF");
      
      // 2. Shake Launchpad
      await animate("#launchpad", { x: [-2, 2, -2, 2, 0] }, { duration: 0.3 });

      // 3. Rocket Blast Off
      animate("#rocket", { y: -150, opacity: 0 }, { duration: 1.5, ease: "easeIn" });
      
      // 4. Text Reveal (Follows rocket)
      animate("#main-text", { y: 0, opacity: 1 }, { duration: 0.8, delay: 0.2 });
      
      // 5. Cleanup countdown
      await new Promise(r => setTimeout(r, 500));
      setCountdown(null);
    };

    const timer = setTimeout(() => {
        sequence();
    }, 500);

    return () => clearTimeout(timer);
  }, [animate]);

  return (
    <div ref={scope} className="relative h-[250px] w-full max-w-4xl mx-auto mb-16 flex flex-col items-center justify-end overflow-hidden">
      
      {/* Background Atmosphere */}
      <motion.div 
         initial={{ opacity: 0 }}
         whileInView={{ opacity: 1 }}
         transition={{ delay: 2, duration: 2 }}
         className="absolute inset-0 bg-gradient-to-t from-blue-50 via-transparent to-transparent z-0"
      />

      {/* Countdown Overlay */}
      {countdown && (
        <motion.div 
          key={countdown}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 1 }}
          exit={{ scale: 2, opacity: 0 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 text-6xl font-black text-slate-900/10 pointer-events-none"
        >
          {countdown}
        </motion.div>
      )}

      {/* The Rocket */}
      <motion.div id="rocket" className="relative z-20 mb-4" initial={{ y: 0 }}>
        <svg width="60" height="100" viewBox="0 0 60 100" fill="none">
           {/* Flame */}
           <motion.path 
             d="M30 100 L20 80 L30 85 L40 80 Z" 
             fill="#f97316" 
             animate={{ scaleY: [1, 1.2, 0.9, 1.3, 1] }} 
             transition={{ repeat: Infinity, duration: 0.1 }}
           />
           {/* Body */}
           <path d="M30 0 C15 0 10 30 10 60 H50 C50 30 45 0 30 0Z" fill="white" stroke="#334155" strokeWidth="2" />
           {/* Window */}
           <circle cx="30" cy="30" r="10" fill="#3b82f6" stroke="#334155" strokeWidth="2" />
           {/* Fins */}
           <path d="M10 60 L0 80 H20 L10 60Z" fill="#ef4444" stroke="#334155" strokeWidth="2" />
           <path d="M50 60 L60 80 H40 L50 60Z" fill="#ef4444" stroke="#334155" strokeWidth="2" />
        </svg>
      </motion.div>

      {/* Smoke Effects */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 w-20 h-20">
         {[...Array(8)].map((_, i) => (
             <SmokeCloud key={i} delay={2.3 + (i * 0.1)} x={(i % 2 === 0 ? 1 : -1) * Math.random() * 40} />
         ))}
      </div>

      {/* Main Text (Initially Hidden Below) */}
      <motion.div 
        id="main-text" 
        className="absolute bottom-10 z-30 text-center"
        initial={{ y: 100, opacity: 0 }}
      >
        <div className="inline-block bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-3 shadow-lg animate-bounce">
           JUST LAUNCHED
        </div>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-800 tracking-tight drop-shadow-sm">
           KNOW YOUR MODULE
        </h2>
        <p className="text-slate-500 text-sm mt-2 font-medium">
           Explore the newly deployed decision support tools
        </p>
      </motion.div>

      {/* Launchpad Line */}
      <motion.div 
        id="launchpad"
        className="w-full h-[2px] bg-slate-200 z-10 relative"
      >
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-20 h-[4px] bg-slate-400" />
      </motion.div>

    </div>
  );
};

export default function GridSection() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="py-8 sm:py-12 md:py-16 px-4 sm:px-6 bg-gray-50 overflow-hidden">
      
      {/* Background Starfield (Subtle) for the Rocket Context */}
      <div className="absolute inset-0 z-0 pointer-events-none">
          {[...Array(15)].map((_, i) => (
             <div 
                key={i}
                className="absolute bg-slate-300 rounded-full"
                style={{
                    width: Math.random() * 3 + 'px',
                    height: Math.random() * 3 + 'px',
                    top: Math.random() * 50 + '%', // Only top half
                    left: Math.random() * 100 + '%',
                    opacity: 0.3
                }}
             />
          ))}
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* --- ROCKET HEADER --- */}
        <RocketHeader />

        {/* --- ORIGINAL GRID CARDS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 md:gap-8">
          {gridItems.map((item, i) => (
            <Link key={i} href={item.href} className="block">
              <div
                className="group relative bg-white rounded-xl shadow-lg overflow-hidden h-[350px] sm:h-[480px] md:h-[300px] transform transition-all duration-300 hover:shadow-2xl"
                style={{ 
                  transform: hoveredIndex === i ? "translateY(-8px)" : "translateY(0)",
                  transition: "transform 0.3s ease, box-shadow 0.3s ease"
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Image Container with Overlay */}
                <div className="relative h-32 sm:h-36 md:h-40 overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-b ${item.color} z-10`}></div>
                  <Image
                    src={item.imgSrc}
                    alt={item.alt}
                    width={400}
                    height={300}
                    className="w-full h-full object-cover transition-transform duration-500 scale-125 group-hover:scale-100"
                  />
                  {/* Acronym Badge and Title Container */}
                  <div className="absolute top-0 left-0 w-full p-3 sm:p-4 z-20 flex justify-between items-center">
                    <h3 className="text-white font-bold text-base sm:text-lg drop-shadow-lg line-clamp-2 pr-2">{item.title}</h3>
                    <div className="bg-white rounded-full h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 flex items-center justify-center shadow-lg">
                      <span className="text-xs sm:text-sm font-bold text-blue-700">
                        {item.acronym || "BM"}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-3 sm:p-4 md:p-5">
                  <p className="text-gray-600 text-xs sm:text-sm line-clamp-3 mb-2 sm:mb-4">
                    {item.description}
                  </p>
                  
                  {/* Explore Button */}
                  <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-5 right-3 sm:right-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-medium text-blue-600">Explore Module</span>
                      <div className="bg-blue-100 rounded-full h-6 w-6 sm:h-8 sm:w-8 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}