"use client";

import Image from "next/image";
import { useEffect } from "react";

export default function ProductPage() {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".fade-in")
    );
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("opacity-100", "translate-y-0", "scale-100");
          }
        });
      },
      { threshold: 0.2 }
    );
    els.forEach((el) => {
      el.classList.add(
        "opacity-0",
        "translate-y-8",
        "scale-95",
        "transition-all",
        "duration-700",
        "ease-out"
      );
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <div className="bg-slate-50 text-slate-900 antialiased">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
        <div className="absolute inset-0">
          <Image
            src="/Images/about/main_background.jpg"
            alt="Water Management Background"
            fill
            className="object-cover opacity-20"
            priority
          />
          {/* GIS Grid Overlay */}
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(to right, rgb(59 130 246 / 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(59 130 246 / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }} />
        </div>

        {/* Satellite Orbits */}
        <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="satellite" x="0" y="0" width="300" height="300" patternUnits="userSpaceOnUse">
              <circle cx="150" cy="150" r="100" fill="none" stroke="rgb(59 130 246)" strokeWidth="2" strokeDasharray="5,5">
                <animateTransform attributeName="transform" type="rotate" from="0 150 150" to="360 150 150" dur="20s" repeatCount="indefinite"/>
              </circle>
              <circle cx="150" cy="150" r="70" fill="none" stroke="rgb(20 184 166)" strokeWidth="2" strokeDasharray="3,3">
                <animateTransform attributeName="transform" type="rotate" from="360 150 150" to="0 150 150" dur="15s" repeatCount="indefinite"/>
              </circle>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#satellite)" />
        </svg>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl">
            <div className="fade-in mb-6">
              <span className="inline-block text-blue-700 text-sm font-mono tracking-[0.3em] uppercase border-2 border-blue-600/40 px-6 py-2 rounded-full bg-white/90 backdrop-blur-sm shadow-lg">
                🛰️ DSS Platform
              </span>
            </div>
            <h1 className="fade-in text-6xl md:text-8xl font-black mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-700">
              Decision Support System
            </h1>
            <p className="fade-in text-xl md:text-2xl text-slate-700 leading-relaxed max-w-3xl font-medium">
              A comprehensive platform integrating sophisticated models and simulations for sustainable water resource management aligned with SDGs
            </p>
          </div>
        </div>

        {/* Animated GIS markers */}
        <div className="absolute top-20 left-10 w-6 h-6 bg-blue-500 rounded-full shadow-lg border-4 border-white animate-ping" />
        <div className="absolute top-40 right-20 w-5 h-5 bg-teal-500 rounded-full shadow-lg border-4 border-white animate-ping" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-40 left-1/4 w-5 h-5 bg-emerald-500 rounded-full shadow-lg border-4 border-white animate-ping" style={{ animationDelay: '1s' }} />
        
        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-blue-600/50 rounded-full p-1 bg-white/50">
            <div className="w-1.5 h-3 bg-blue-600 rounded-full mx-auto animate-pulse" />
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-32 relative bg-white">
        {/* Remote Sensing Pattern */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgb(59 130 246 / 0.15) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="fade-in">
              <div className="mb-6">
                <span className="text-blue-700 text-sm font-mono tracking-[0.2em] uppercase bg-blue-50 px-4 py-2 rounded-full border border-blue-300">
                  📊 Overview
                </span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-tight text-slate-900">
                Tackling Water Management Challenges
              </h2>
              <div className="space-y-6 text-lg text-slate-700">
                <p className="leading-relaxed">
                  This project addresses the critical need for a comprehensive Decision Support System (DSS) to manage water resources effectively. The DSS integrates sophisticated models and simulations to support sustainable Water Resource Management.
                </p>
                <p className="leading-relaxed">
                  Water Resource Management is a complex, multi-dimensional challenge exacerbated by climate change, urban expansion, and socio-economic dynamics. Our DSS provides holistic solutions by combining hydrological, socio-economic, and ecological factors.
                </p>
              </div>
            </div>

            <div className="fade-in relative">
              <div className="relative h-[600px] rounded-2xl overflow-hidden border-4 border-blue-200 shadow-2xl shadow-blue-500/20">
                <Image
                  src="/Images/about/Varanasi_Munshi_Ghat.jpg"
                  alt="Varanasi Munshi Ghat"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/40 via-transparent to-transparent" />
              </div>
              {/* Decorative GIS element */}
              <div className="absolute -bottom-6 -right-6 w-32 h-32 border-4 border-blue-400 rounded-lg opacity-50" />
              <div className="absolute -top-6 -left-6 w-24 h-24 border-4 border-teal-400 rounded-lg opacity-50" />
            </div>
          </div>
        </div>
      </section>

      {/* Objectives */}
      <section className="py-32 bg-gradient-to-br from-cyan-50 via-blue-50 to-teal-50 relative overflow-hidden">
        {/* Topographic Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="topo-lines" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M0,50 Q50,30 100,50 T200,50" fill="none" stroke="rgb(59 130 246)" strokeWidth="2" />
              <path d="M0,100 Q50,80 100,100 T200,100" fill="none" stroke="rgb(20 184 166)" strokeWidth="2" />
              <path d="M0,150 Q50,130 100,150 T200,150" fill="none" stroke="rgb(16 185 129)" strokeWidth="2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo-lines)" />
        </svg>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="fade-in order-2 lg:order-1 relative">
              <div className="relative h-[600px] rounded-2xl overflow-hidden border-4 border-cyan-200 shadow-2xl shadow-cyan-500/20">
                <Image
                  src="/Images/about/Doppler_Weather_Radar_Station_Kailasagiri.jpg"
                  alt="Weather Radar Station"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/40 via-transparent to-transparent" />
              </div>
              <div className="absolute -top-6 -left-6 w-32 h-32 border-4 border-cyan-400 rounded-full opacity-50" />
              <div className="absolute -bottom-6 -right-6 w-24 h-24 border-4 border-blue-400 rounded-full opacity-50" />
            </div>

            <div className="fade-in order-1 lg:order-2">
              <div className="mb-6">
                <span className="text-cyan-700 text-sm font-mono tracking-[0.2em] uppercase bg-cyan-50 px-4 py-2 rounded-full border border-cyan-300">
                  🎯 Mission
                </span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-12 leading-tight text-slate-900">
                Project Objectives
              </h2>
              <div className="space-y-6">
                {[
                  {
                    num: "01",
                    title: "Data Management Framework",
                    desc: "Handle large-scale, multi-source water data efficiently",
                  },
                  {
                    num: "02",
                    title: "Hydro-Computational Modeling",
                    desc: "Simulate water behaviors with integrated frameworks",
                  },
                  {
                    num: "03",
                    title: "Intuitive GUI Interface",
                    desc: "Simplified decision-making with visual data representation",
                  },
                  {
                    num: "04",
                    title: "Stakeholder Engagement",
                    desc: "Platform for inclusive water resource management",
                  },
                  {
                    num: "05",
                    title: "Policy Recommendations",
                    desc: "Adaptive modules for changing environmental conditions",
                  },
                ].map((obj, idx) => (
                  <div
                    key={idx}
                    className="group flex gap-6 p-6 rounded-xl bg-white border-2 border-cyan-200 hover:border-cyan-500 hover:shadow-xl hover:shadow-cyan-500/20 transition-all duration-300"
                  >
                    <span className="text-4xl font-black text-cyan-600/40 group-hover:text-cyan-600 transition-colors">
                      {obj.num}
                    </span>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-slate-900 group-hover:text-cyan-700 transition-colors">
                        {obj.title}
                      </h3>
                      <p className="text-slate-600">{obj.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Applications */}
      <section className="py-32 relative bg-white">
        {/* GIS Layer Pattern */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `
            linear-gradient(45deg, rgb(16 185 129 / 0.1) 25%, transparent 25%),
            linear-gradient(-45deg, rgb(16 185 129 / 0.1) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgb(16 185 129 / 0.1) 75%),
            linear-gradient(-45deg, transparent 75%, rgb(16 185 129 / 0.1) 75%)
          `,
          backgroundSize: '60px 60px',
          backgroundPosition: '0 0, 0 30px, 30px -30px, -30px 0px'
        }} />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="fade-in">
              <div className="mb-6">
                <span className="text-emerald-700 text-sm font-mono tracking-[0.2em] uppercase bg-emerald-50 px-4 py-2 rounded-full border border-emerald-300">
                  🌐 Use Cases
                </span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-12 leading-tight text-slate-900">
                Potential Applications
              </h2>
              <div className="space-y-8">
                {[
                  {
                    icon: "🌵",
                    title: "Drought Management",
                    desc: "Early warning systems and resource allocation optimization during water scarcity",
                  },
                  {
                    icon: "🌊",
                    title: "Flood Prevention",
                    desc: "Real-time monitoring and predictive modeling to mitigate flooding risks",
                  },
                  {
                    icon: "💧",
                    title: "Groundwater Management",
                    desc: "Sustainable utilization based on recharge rates and extraction patterns",
                  },
                  {
                    icon: "🏙️",
                    title: "Urban Water Supply",
                    desc: "Distribution network optimization and demand forecasting",
                  },
                  {
                    icon: "🌾",
                    title: "Agricultural Water",
                    desc: "Precision irrigation scheduling and crop water requirement modeling",
                  },
                ].map((app, idx) => (
                  <div
                    key={idx}
                    className="group flex gap-6 items-start p-6 rounded-xl bg-white border-2 border-emerald-200 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/20 transition-all duration-300"
                  >
                    <span className="text-4xl group-hover:scale-125 transition-transform">
                      {app.icon}
                    </span>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {app.title}
                      </h3>
                      <p className="text-slate-600">{app.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="fade-in relative">
              <div className="relative h-[700px] rounded-2xl overflow-hidden border-4 border-emerald-200 shadow-2xl shadow-emerald-500/20">
                <Image
                  src="/Images/about/varuna1.png"
                  alt="Varuna Platform"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/40 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 border-4 border-emerald-400 rounded-lg rotate-12 opacity-50" />
              <div className="absolute -top-6 -left-6 w-24 h-24 border-4 border-teal-400 rounded-lg -rotate-12 opacity-50" />
            </div>
          </div>
        </div>
      </section>

      {/* Collaborations */}
      <section className="py-32 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 relative">
        {/* Network Connection Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="network" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <line x1="0" y1="50" x2="100" y2="50" stroke="rgb(245 158 11)" strokeWidth="1.5" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="rgb(245 158 11)" strokeWidth="1.5" />
              <circle cx="50" cy="50" r="5" fill="rgb(245 158 11)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#network)" />
        </svg>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="fade-in order-2 lg:order-1 relative">
              <div className="relative h-[600px] rounded-2xl overflow-hidden border-4 border-amber-200 shadow-2xl shadow-amber-500/20">
                <Image
                  src="/Images/about/Kendujhar_Odisha.jpg"
                  alt="Kendujhar Odisha"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-amber-900/40 via-transparent to-transparent" />
              </div>
              <div className="absolute -top-6 -left-6 w-32 h-32 border-4 border-amber-400 rounded-full opacity-50" />
              <div className="absolute -bottom-6 -right-6 w-24 h-24 border-4 border-orange-400 rounded-full opacity-50" />
            </div>

            <div className="fade-in order-1 lg:order-2">
              <div className="mb-6">
                <span className="text-amber-700 text-sm font-mono tracking-[0.2em] uppercase bg-amber-50 px-4 py-2 rounded-full border border-amber-300">
                  🤝 Partnerships
                </span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-tight text-slate-900">
                Key Collaborations
              </h2>
              <p className="text-xl text-slate-700 mb-12 font-medium">
                Working in alignment with national water projects:
              </p>
              <div className="space-y-6">
                {[
                  {
                    title: "Jal Jeevan Mission",
                    desc: "Supporting safe drinking water access for all households",
                  },
                  {
                    title: "Atal Bhujal Yojana",
                    desc: "Enhancing groundwater management through community participation",
                  },
                  {
                    title: "National Hydrological Project",
                    desc: "Improving accessibility of water resources information",
                  },
                  {
                    title: "National Groundwater Management Improvement Program-2",
                    desc: "Supporting sustainable groundwater management practices",
                  },
                ].map((collab, idx) => (
                  <div
                    key={idx}
                    className="group p-6 rounded-xl bg-white border-2 border-amber-200 hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/20 transition-all duration-300"
                  >
                    <h3 className="text-xl font-bold mb-2 text-slate-900 group-hover:text-amber-700 transition-colors">
                      {collab.title}
                    </h3>
                    <p className="text-slate-600">{collab.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Framework */}
      <section className="py-32 relative bg-white">
        {/* Hexagon Pattern (like satellite imagery) */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `
            linear-gradient(30deg, rgb(139 92 246 / 0.1) 12%, transparent 12.5%, transparent 87%, rgb(139 92 246 / 0.1) 87.5%, rgb(139 92 246 / 0.1)),
            linear-gradient(150deg, rgb(139 92 246 / 0.1) 12%, transparent 12.5%, transparent 87%, rgb(139 92 246 / 0.1) 87.5%, rgb(139 92 246 / 0.1)),
            linear-gradient(30deg, rgb(139 92 246 / 0.1) 12%, transparent 12.5%, transparent 87%, rgb(139 92 246 / 0.1) 87.5%, rgb(139 92 246 / 0.1)),
            linear-gradient(150deg, rgb(139 92 246 / 0.1) 12%, transparent 12.5%, transparent 87%, rgb(139 92 246 / 0.1) 87.5%, rgb(139 92 246 / 0.1))
          `,
          backgroundSize: '80px 140px',
          backgroundPosition: '0 0, 0 0, 40px 70px, 40px 70px, 0 0, 40px 70px'
        }} />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="fade-in">
              <div className="mb-6">
                <span className="text-violet-700 text-sm font-mono tracking-[0.2em] uppercase bg-violet-50 px-4 py-2 rounded-full border border-violet-300">
                  🛰️ Technology
                </span>
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-tight text-slate-900">
                Advanced Data Integration
              </h2>
              <p className="text-xl text-slate-700 mb-12 font-medium">
                Utilizing cutting-edge data sources:
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  "CWC Monitoring Stations",
                  "IMD Weather Forecasts",
                  "NASA MODIS Satellites",
                  "Sentinel Imagery",
                  "IoT Sensor Networks",
                  "Real-time Ground Data",
                ].map((tech, idx) => (
                  <div
                    key={idx}
                    className="group p-4 rounded-xl bg-white border-2 border-violet-200 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/20 transition-all duration-300 text-center"
                  >
                    <span className="text-sm font-semibold text-slate-900 group-hover:text-violet-700 transition-colors">
                      {tech}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-12 text-lg text-slate-700 leading-relaxed">
                By combining these data sources with system thinking methodologies, the DSS facilitates informed decision-making at multiple levels of Water Resource Management.
              </p>
            </div>

            <div className="fade-in relative">
              <div className="relative h-[600px] rounded-2xl overflow-hidden border-4 border-violet-200 shadow-2xl shadow-violet-500/20">
                <Image
                  src="/Images/about/AWS(Automatic_Weather_station).jpg"
                  alt="Automatic Weather Station"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-violet-900/40 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 border-4 border-violet-400 rounded-lg rotate-45 opacity-50" />
              <div className="absolute -top-6 -left-6 w-24 h-24 border-4 border-purple-400 rounded-lg -rotate-45 opacity-50" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative bg-gradient-to-br from-blue-100 via-cyan-100 to-teal-100">
        {/* Map Pin Decorations */}
        <div className="absolute top-10 left-20 text-blue-600 text-5xl animate-bounce">📍</div>
        <div className="absolute bottom-10 right-20 text-teal-600 text-5xl animate-bounce" style={{ animationDelay: '0.5s' }}>📍</div>
        <div className="absolute top-1/2 left-1/4 text-cyan-600 text-4xl animate-bounce" style={{ animationDelay: '1s' }}>🌍</div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="fade-in max-w-4xl mx-auto text-center">
            <h2 className="text-5xl md:text-6xl font-bold mb-8 text-slate-900">
              Ready to Transform Water Management?
            </h2>
            <p className="text-xl text-slate-700 mb-12 max-w-2xl mx-auto">
              Join us in building a sustainable future through intelligent water resource management powered by GIS and remote sensing
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold transition-all hover:shadow-xl hover:shadow-blue-500/50 hover:scale-105 border-2 border-blue-700">
                Get Started
              </button>
              <button className="bg-white border-2 border-blue-600 hover:bg-blue-50 text-blue-700 px-8 py-4 rounded-full font-semibold transition-all hover:shadow-xl">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
