"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Megaphone, Calendar, FileText } from "lucide-react"; 
import { motion, AnimatePresence } from "framer-motion";

// --- START: CUSTOM EFFECT COMPONENTS ---

// 1. Galaxy Background Component (Canvas based)
const GalaxyBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;
    
    const stars: { x: number; y: number; size: number; speed: number }[] = [];
    const count = 150;

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2,
        speed: Math.random() * 0.5 + 0.1
      });
    }

    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      
      stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        
        star.y -= star.speed;
        if (star.y < 0) star.y = height;
      });

      animationFrameId = window.requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full z-0 opacity-60 pointer-events-none"
    />
  );
};

// 2. Pixel Transition Card Component
const PixelTransitionImage = ({ src, alt }: { src: string; alt: string }) => {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    setIsActive(false);
    const timer = setTimeout(() => setIsActive(true), 50);
    return () => clearTimeout(timer);
  }, [src]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-900">
      <AnimatePresence mode="wait">
        <motion.img
          key={src}
          src={src}
          alt={alt}
          initial={{ opacity: 0, scale: 1, filter: "blur(10px)" }} 
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 1 }} 
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0 w-full h-full object-contain" 
        />
      </AnimatePresence>
      
      <div className="absolute inset-0 grid grid-cols-10 grid-rows-10 pointer-events-none">
        {Array.from({ length: 100 }).map((_, i) => (
          <motion.div
            key={`${src}-${i}`}
            initial={{ opacity: 1, background: "#0f172a" }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: Math.random() * 0.5 }}
            className="w-full h-full"
          />
        ))}
      </div>
    </div>
  );
};

// 3. Variable Proximity Text Component
const VariableProximity = ({ 
  label, 
  className = "",
  radius = 100,
  spacing = "mr-4"
}: { 
  label: string, 
  className?: string,
  radius?: number,
  spacing?: string
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const words = label.split(" ");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const spans = container.querySelectorAll('span.proximity-word');
      spans.forEach((span) => {
        const rect = span.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
        const factor = Math.max(0, 1 - distance / radius);
        
        (span as HTMLElement).style.transform = `scale(${1 + factor * 0.1})`;
        (span as HTMLElement).style.fontWeight = factor > 0.5 ? '700' : '400';
        (span as HTMLElement).style.textShadow = factor > 0.5 ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none';
        (span as HTMLElement).style.color = factor > 0.5 ? '#ffffff' : '#e2e8f0'; 
      });
    };

    const handleMouseLeave = () => {
      const spans = container.querySelectorAll('span.proximity-word');
      spans.forEach((span) => {
        (span as HTMLElement).style.transform = 'scale(1)';
        (span as HTMLElement).style.fontWeight = '400';
        (span as HTMLElement).style.textShadow = 'none';
        (span as HTMLElement).style.color = '#e2e8f0';
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if(container) container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [radius]);

  return (
    <div ref={containerRef} className={`${className} cursor-default`}>
      {words.map((word, i) => (
        <span 
          key={i} 
          className={`proximity-word inline-block transition-all duration-75 ${spacing}`}
          style={{ transformOrigin: 'center' }}
        >
          {word}
        </span>
      ))}
    </div>
  );
};

// 4. Plasma Background Component
const PlasmaBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-100 z-0 rounded-lg">
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
          x: [0, 50, 0],
          y: [0, 30, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, -90, 0],
          x: [0, -30, 0],
          y: [0, 50, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-10%] right-[-20%] w-[70%] h-[70%] bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          x: [0, 40, 0],
          y: [0, -40, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-20%] left-[20%] w-[70%] h-[70%] bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
      />
    </div>
  );
};

// 5. Silk Background Component (Kept exactly as requested)
const SilkBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#f8fafc");
      gradient.addColorStop(1, "#f1f5f9");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(59, 130, 246, 0.15)";
      ctx.lineWidth = 1;

      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        for (let x = 0; x < width; x += 10) {
          const y = height / 2 + 
                    Math.sin(x * 0.01 + time + i * 0.5) * 50 + 
                    Math.sin(x * 0.02 + time * 0.5) * 20;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      time += 0.01;
      requestAnimationFrame(draw);
    };

    const animationId = requestAnimationFrame(draw);

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0 pointer-events-none" />;
};

// --- END: CUSTOM EFFECT COMPONENTS ---

const HomeHeader = () => {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [vmIndex, setVmIndex] = useState(0);

  // Hero carousel images
  const carouselImages = [
    "/Images/navbar/pictures/DSS1.jpeg",
    "/Images/navbar/pictures/DSS2.jpg",
    "/Images/navbar/pictures/DSS5.jpeg",
  ];

  // Dignitaries Data (Exactly 8 items now fit perfectly in 4 columns)
  const dignitaries = [
    {
      name: "Shri C R Patil",
      title: "Hon'ble Union Minister ,Ministry of Jal Shakti",
      image: "/Images/navbar/persons/CR_patil.jpg",
    },
    {
      name: "Shri V.L. Kantha Rao",
      title: "Secretary (DoWR,RD & GR)",
      image: "/Images/navbar/persons/secretary1.jpg",
    },
    {
      name: "Shri Rajeev Mittal",
      title: "DG , National Mission For Clean Ganga",
      image: "/Images/navbar/persons/Rajeev_Mital1.jpg",
    },
    {
      name: "Shri Nalin Kumar Srivastava",
      title: "DDG ,National Mission For Clean Ganga",
      image: "/Images/navbar/persons/nalin_sir.png",
    },
    {
      name: "Shri Dheeraj Joshi",
      title: "Director (Urban) , NMCG",
      image: "/Images/navbar/persons/dheeraj_joshi.jpeg",
    },
    {
      name: "Prof. Anurag Ohri",
      title: "Principal Investigator , IIT BHU Varanasi",
      image: "/Images/navbar/persons/Anurag_Ohri_Sir.jpg",
    },
    {
      name: "Prof. Pramod Soni",
      title: "Principal Investigator , IIT BHU Varanasi",
      image: "/Images/navbar/persons/Pramod_Sir.jpg",
    },
    {
      name: "Prof. Shishir Gaur",
      title: "Coordinator , IIT BHU Varanasi",
      image: "/Images/navbar/persons/sgsir.png",
    },
  ];

  // Vision and Mission Data
  const visionMissionData = [
    {
      type: "MISSION",
      title: "Our Mission",
      colorClass: "text-red-600", 
      text: "To provide a single window solution for comprehensive assessment, consolidated information of India's water resources and allied themes; to develop a standard national GIS framework for planning, development and management of water resources of the country.",
      image: "/Images/navbar/mission/mission-v1.png",
    },
    {
      type: "VISION",
      title: "Our Vision",
      colorClass: "text-blue-800",
      text: "To be a modern, state of the art repository of water resources and allied themes to facilitate information based sustainable development and management of water resources of the nation.",
      image: "/Images/navbar/mission/vision-v1.png",
    }
  ];

  const highlights = [
    { 
      title: "Training on New Modules including Water Data Online", 
      date: "2025-2026", 
      documentUrl: "/highlights/varuna_doc.pdf" 
    },
    { 
      title: "Interaction with State Nodal Officers", 
      date: "2023-2024", 
      documentUrl: "/highlights/varuna_doc.pdf" 
    },
    { 
      title: "Varuna Report ", 
      date: "2024-2025", 
      documentUrl: "/highlights/varuna_doc.pdf" 
    },
    { 
      title: "Framework Document of DSS", 
      date: "2023-2024", 
      documentUrl: "/highlights/varuna_doc.pdf" 
    }
  ];

  // Auto-rotate Hero carousel (5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselImages.length]);

  // Auto-rotate Vision/Mission (4 seconds)
  useEffect(() => {
    const vmInterval = setInterval(() => {
      setVmIndex((prev) => (prev + 1) % visionMissionData.length);
    }, 4000);
    return () => clearInterval(vmInterval);
  }, [visionMissionData.length]);

  return (
    <>
      <style jsx>{`
        @keyframes vertical-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .animate-scroll-vertical {
          animation: vertical-scroll 15s linear infinite;
        }
        .animate-scroll-vertical:hover {
          animation-play-state: paused;
        }
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Hero Section with Carousel and Content */}
      <div className="relative bg-gradient-to-b from-slate-900 to-slate-800 overflow-hidden">
        <GalaxyBackground />

        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-pattern"></div>
        </div>

        <div className="relative container mx-auto px-4 py-8 md:py-12 z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            
            {/* Left side - Carousel */}
            <div className="relative w-full h-80 md:h-96 bg-gray-900 rounded-lg overflow-hidden shadow-lg border border-slate-700">
              <div className="relative w-full h-full">
                <PixelTransitionImage 
                  src={carouselImages[carouselIndex]} 
                  alt={`Carousel slide ${carouselIndex + 1}`} 
                />
              </div>

              <button
                onClick={() =>
                  setCarouselIndex(
                    (prev) => (prev - 1 + carouselImages.length) % carouselImages.length
                  )
                }
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-50 hover:bg-opacity-80 p-2 rounded-full z-10 transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-gray-800" />
              </button>

              <button
                onClick={() =>
                  setCarouselIndex((prev) => (prev + 1) % carouselImages.length)
                }
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-50 hover:bg-opacity-80 p-2 rounded-full z-10 transition-all"
              >
                <ChevronRight className="w-5 h-5 text-gray-800" />
              </button>

              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
                {carouselImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCarouselIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === carouselIndex
                        ? "bg-white w-6"
                        : "bg-white bg-opacity-50"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right side - DSS Information */}
            <div className="text-white">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                <VariableProximity 
                  label="Decision Support System" 
                  className="cursor-pointer"
                  radius={150}
                />
              </h1>
              
              <VariableProximity 
                label="Water Resources Management in India - A comprehensive platform designed to support holistic water resources management. It integrates data collection, analysis, and visualization tools to facilitate informed decision-making for sustainable water resource planning and management across river basin."
                className="text-base md:text-lg text-gray-200 mb-6 leading-relaxed block"
                radius={100}
              />

              <p className="text-sm md:text-base text-gray-300 mb-6">
                Leveraging advanced analytics and real-time data integration, the DSS provides actionable insights for groundwater management, river water management, water resource allocation, sewage management and system dynamics modeling.
              </p>
              
              <Link href="/dss/about">
                <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full transition-colors duration-200 flex items-center space-x-2 shadow-lg">
                  <span>Learn More</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Dignitaries Grid Only */}
      <div className="bg-slate-50 py-10 border-t border-slate-200">
        <div className="container mx-auto px-4">
          
          <div className="relative p-6 rounded-xl overflow-hidden mb-10">
            {/* Plasma Background for Dignitaries */}
            <PlasmaBackground />

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {dignitaries.map((person, index) => (
                <div key={index} className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-slate-100 flex flex-col group h-full">
                  <div className="h-56 overflow-hidden relative flex-shrink-0">
                    <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300 z-10"></div>
                    <img 
                      src={person.image} 
                      alt={person.name} 
                      className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-4 text-center flex-grow flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-slate-800 mb-1 leading-tight">{person.name}</h3>
                    <p className="text-sm text-blue-600 font-medium leading-tight">{person.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Unified Vision, Mission & Highlights Section */}
          <div className="bg-white/80 rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
             
            {/* Silk Background covers both sections now */}
            <SilkBackground />
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Vision & Mission (Takes up 8 columns) */}
              <div className="lg:col-span-8 flex flex-col md:flex-row items-center gap-8 border-b lg:border-b-0 lg:border-r border-slate-200 pb-6 lg:pb-0 lg:pr-6">
                
                {/* Image Area */}
                <div className="md:w-1/3 flex flex-col items-center justify-center">
                  <div className="relative w-40 h-40 md:w-48 md:h-48 mb-4">
                    <img 
                      key={vmIndex} 
                      src={visionMissionData[vmIndex].image} 
                      onError={(e) => { e.currentTarget.style.display='none'; }}
                      alt={visionMissionData[vmIndex].title}
                      className="w-full h-full object-contain fade-in"
                    />
                    <div className="absolute inset-0 flex items-center justify-center -z-10">
                      <div className="text-center">
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-blue-500 to-blue-800 opacity-20">
                          {visionMissionData[vmIndex].type}
                        </h2>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text Area */}
                <div className="md:w-2/3 space-y-4 fade-in" key={`content-${vmIndex}`}>
                   <h3 className={`text-2xl font-bold ${visionMissionData[vmIndex].colorClass} border-b border-gray-100 pb-2`}>
                      {visionMissionData[vmIndex].title}
                   </h3>
                   <p className="text-gray-700 leading-relaxed text-sm md:text-base font-medium">
                      {visionMissionData[vmIndex].text}
                   </p>
                </div>
              </div>

              {/* Right Column: Highlights (Takes up 4 columns) */}
              <div className="lg:col-span-4 flex flex-col h-full pl-0 lg:pl-2">
                <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                   <h3 className="text-xl font-bold text-slate-800 flex items-center">
                     <Megaphone className="w-5 h-5 mr-2 text-blue-600" />
                     Highlights
                   </h3>
                </div>

                {/* Highlights Scrolling List */}
                <div className="flex-grow relative overflow-hidden h-[250px] bg-white/50 rounded-lg border border-slate-100 p-2">
                   <div className="absolute w-full animate-scroll-vertical hover:pause">
                      <ul className="space-y-3 pb-4">
                        {highlights.map((item, i) => (
                          <li key={`h-${i}`} className="group bg-white p-3 rounded shadow-sm hover:shadow-md transition-all border border-transparent hover:border-blue-100 cursor-pointer">
                             <a 
                               href={item.documentUrl} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="block w-full"
                             >
                                <div className="flex items-start">
                                   <FileText className="w-4 h-4 text-blue-500 mt-1 mr-2 flex-shrink-0" />
                                   <div>
                                      <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 leading-snug block mb-1">
                                        {item.title}
                                      </span>
                                      <span className="text-[10px] text-gray-500 flex items-center bg-gray-50 inline-block px-2 py-0.5 rounded">
                                        <Calendar className="w-3 h-3 mr-1"/> {item.date}
                                      </span>
                                   </div>
                                </div>
                             </a>
                          </li>
                        ))}
                      </ul>
                   </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default HomeHeader;