'use client';
import React, { useEffect, useRef, useState } from 'react';

interface Slide {
  title: string;
  body: string;
  image: string;
  alt?: string;
}

interface SwiperSectionProps {
  heroBg: string;
  slides: Slide[];
}

function SwiperSection({
  heroBg = "/Images/about/Dept.jpg",
  slides = [] as Slide[],
}) {
  const wrapperRef = useRef<HTMLElement | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Automatic slide rotation every 4 seconds (slower for mobile)
  useEffect(() => {
    if (slides.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [slides.length]);

  return (
    <section
      ref={wrapperRef}
      className="relative w-full min-h-screen"
    >
      <div className="relative min-h-screen lg:h-screen">
        <div
          className="absolute inset-0 bg-center bg-cover bg-fixed -z-10 pointer-events-none"
          style={{ backgroundImage: `url('${heroBg}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20 pointer-events-none -z-10" />

        <div className="relative z-10 h-full w-full flex items-center py-12 lg:py-0">
          <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
            <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 lg:gap-12 xl:gap-16 items-center">
              
              {/* Text Content */}
              <div className="text-white order-2 lg:order-1 text-center lg:text-left">
                <div className="inline-block px-3 py-2 sm:px-4 sm:py-2 bg-white/10 backdrop-blur-sm text-white rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                  Our Distinguished Team
                </div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight mb-4 sm:mb-6 leading-tight">
                  {slides[currentSlide]?.title || "Leading Researchers"}
                </h3>
                <p className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed mb-6 sm:mb-8 max-w-2xl mx-auto lg:mx-0">
                  {slides[currentSlide]?.body || "Meet our expert faculty members"}
                </p>

                {/* Slide indicators */}
                <div className="flex justify-center lg:justify-start space-x-2 mb-8 lg:mb-0">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                        index === currentSlide ? 'w-6 sm:w-8 bg-white' : 'w-3 sm:w-4 bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Image Carousel */}
              <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
                <div className="relative">
                  {/* Image container with responsive sizing */}
                  <div className="relative h-[50vh] w-[280px] sm:h-[60vh] sm:w-[320px] md:h-[65vh] md:w-[380px] lg:h-[70vh] lg:w-[420px] xl:h-[75vh] xl:w-[480px]">
                    {slides.map((slide, index) => (
                      <div
                        key={index}
                        className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                          index === currentSlide
                            ? 'opacity-100 transform translate-x-0 scale-100 rotate-0 z-10'
                            : index === (currentSlide - 1 + slides.length) % slides.length
                            ? 'opacity-30 sm:opacity-40 transform -translate-x-4 sm:-translate-x-6 lg:-translate-x-8 scale-90 sm:scale-95 -rotate-6 sm:-rotate-12 z-5'
                            : index === (currentSlide + 1) % slides.length
                            ? 'opacity-30 sm:opacity-40 transform translate-x-4 sm:translate-x-6 lg:translate-x-8 scale-90 sm:scale-95 rotate-6 sm:rotate-12 z-5'
                            : 'opacity-0 transform translate-x-8 sm:translate-x-12 lg:translate-x-16 scale-80 sm:scale-90 rotate-45 z-0'
                        }`}
                      >
                        <img
                          src={slide.image}
                          alt={slide.alt || slide.title}
                          className="h-full w-full object-cover rounded-lg sm:rounded-xl shadow-xl sm:shadow-2xl shadow-black/30"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded-lg sm:rounded-xl" />

                        {/* Show overlay only on current slide - responsive text */}
                        {index === currentSlide && (
                          <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 text-white">
                            <h4 className="text-sm sm:text-lg lg:text-xl font-semibold leading-tight">{slide.title}</h4>
                            <p className="text-xs sm:text-sm text-white/90 mt-1 line-clamp-2">{slide.body}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Decorative elements - responsive sizing */}
                  <div className="absolute -top-2 sm:-top-4 -right-2 sm:-right-4 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-white/10 rounded-full blur-xl animate-pulse"></div>
                  <div className="absolute -bottom-2 sm:-bottom-4 -left-2 sm:-left-4 w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-white/5 rounded-full blur-xl"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ModernAboutPage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);

    // Enhanced intersection observer for staggered animations
    const els = Array.from(document.querySelectorAll('.reveal-on-scroll'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, index) => {
          if (e.isIntersecting) {
            setTimeout(() => {
              e.target.classList.add('opacity-100', 'translate-y-0', 'scale-100');
            }, index * 100); // Staggered animation
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );

    els.forEach((el) => {
      el.classList.add(
        'opacity-0',
        'translate-y-8',
        'sm:translate-y-16',
        'scale-95',
        'transition-all',
        'duration-1000',
        'ease-out'
      );
      io.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      io.disconnect();
    };
  }, []);

  const professors = [
    {
      image: "/Images/about/gaur.jpg",
      title: "Prof. Shishir Gaur",
      body: "Department of Civil Engineering IIT(BHU) - Specializing in Water Resource Management and Hydrology"
    },
    {
      image: "/Images/about/ohri.jpg",
      title: "Prof. Anurag Ohri",
      body: "Department of Civil Engineering IIT(BHU) - Expert in Environmental Engineering and Sustainable Development"
    },
    {
      image: "/Images/about/soni.jpeg",
      title: "Prof. Pramod Soni",
      body: "Department of Civil Engineering IIT(BHU) - Research in Water Systems and Climate Change Adaptation"
    }
  ];

  return (
    <div className="relative overflow-x-hidden">
      {/* Global transparent background that moves with scroll */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-5 pointer-events-none z-0"
        style={{
          backgroundImage: `url('/Images/about/Dept.jpg')`,
          transform: `translateY(${scrollY * 0.2}px)`
        }}
      />

      {/* Hero Section */}
      <section className="relative h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/Images/about/Dept.jpg')`,
            transform: `translateY(${scrollY * 0.5}px)`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-blue-800/60 to-indigo-900/70" />

        <div className="relative z-10 flex items-center justify-center h-full text-white text-center px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-bold mb-6 sm:mb-8 tracking-tight animate-fadeInUp animation-delay-300 leading-tight">
              Water Resource
              <span className="block text-blue-300 mt-1 sm:mt-2">Management DSS</span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl mb-8 sm:mb-12 leading-relaxed opacity-90 max-w-4xl mx-auto animate-fadeInUp animation-delay-600">
              Comprehensive Decision Support System for Sustainable Water Resource Management through Advanced Technology Integration
            </p>
            <div className="flex items-center justify-center space-x-3 sm:space-x-4 animate-fadeInUp animation-delay-900">
              <div className="w-8 sm:w-12 lg:w-16 h-0.5 sm:h-1 bg-blue-400"></div>
              <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-blue-400 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full animate-pulse"></div>
              </div>
              <div className="w-8 sm:w-12 lg:w-16 h-0.5 sm:h-1 bg-blue-400"></div>
            </div>
          </div>
        </div>

        {/* Enhanced scroll indicator */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="flex flex-col items-center space-y-1 sm:space-y-2 animate-bounce">
            <span className="text-white/70 text-xs sm:text-sm uppercase tracking-wider">Scroll</span>
            <div className="w-5 h-8 sm:w-6 sm:h-10 border-2 border-white/50 rounded-full flex justify-center">
              <div className="w-0.5 sm:w-1 h-2 sm:h-3 bg-white/70 rounded-full mt-1.5 sm:mt-2 animate-pulse"></div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10">
        {/* Introduction Section */}
        <section className="py-16 sm:py-20 lg:py-32 px-4 sm:px-6 bg-white/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="reveal-on-scroll">
                <div className="inline-block px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full text-xs sm:text-sm font-medium mb-6 sm:mb-8">
                  Project Introduction
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-6 sm:mb-10 leading-tight">
                  Sustainable Water
                  <span className="block text-transparent bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text">
                    Resource Solutions
                  </span>
                </h2>
                <div className="space-y-6 sm:space-y-8 text-gray-700 leading-relaxed">
                  <p className="text-base sm:text-lg lg:text-xl">
                    This project addresses the critical need for a comprehensive Decision Support System (DSS) to manage water resources effectively. The DSS integrates sophisticated models and simulations to support sustainable Water Resource Management, ultimately contributing to the achievement of Sustainable Development Goals (SDGs).
                  </p>
                  <p className="text-sm sm:text-base lg:text-lg">
                    Water Resource Management is a complex, multi-dimensional challenge exacerbated by climate change, urban expansion, and socio-economic dynamics. The aim of this DSS is to provide holistic solutions to water management by combining hydrological, socio-economic, and ecological factors through an integrated modeling framework.
                  </p>
                  <div className="flex items-center space-x-3 sm:space-x-4 pt-2 sm:pt-4">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                    <span className="text-blue-600 font-semibold text-sm sm:text-base">Advancing SDG Implementation</span>
                  </div>
                </div>
              </div>
              
              <div className="reveal-on-scroll">
                <div className="relative group">
                  <img
                    src="/Images/about/varuna1.png"
                    alt="Water Resource Management"
                    className="rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl w-full h-[300px] sm:h-[400px] lg:h-[500px] object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent rounded-2xl sm:rounded-3xl"></div>
                  <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6">
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6">
                      <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 mb-1 sm:mb-2">Ganga River Management</h3>
                      <p className="text-gray-600 text-xs sm:text-sm lg:text-base">Comprehensive water quality monitoring and sustainable resource management</p>
                    </div>
                  </div>
                  {/* Decorative elements */}
                  <div className="absolute -top-2 sm:-top-4 -right-2 sm:-right-4 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-blue-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                  <div className="absolute -bottom-2 sm:-bottom-4 -left-2 sm:-left-4 w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-cyan-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Professors Section with SwiperSection */}
        <SwiperSection
          heroBg="/Images/about/Dept.jpg"
          slides={professors as Slide[]}
        />

        {/* Project Goals Section */}
        <section className="relative py-16 sm:py-20 lg:py-32 px-4 sm:px-6 overflow-hidden">
          {/* Radiant gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-blue-50 to-white"></div>

          {/* Accent gradient glow */}
          <div className="absolute -top-40 -left-40 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] bg-gradient-to-br from-green-300/40 to-emerald-400/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] bg-gradient-to-tr from-blue-300/30 to-indigo-400/20 rounded-full blur-3xl"></div>

          <div className="relative max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left Image */}
              <div className="reveal-on-scroll order-2 lg:order-1">
                <div className="relative group">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/3/3a/Doppler_Weather_Radar_Station_on_Kailasagiri_%28May_2019%29.jpg"
                    alt="Weather Monitoring Technology"
                    className="rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl w-full h-[300px] sm:h-[400px] lg:h-[500px] object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-2xl sm:rounded-3xl"></div>
                  <div className="absolute top-4 sm:top-6 left-4 sm:left-6">
                    <div className="bg-green-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium shadow-md">
                      Advanced Monitoring
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Content */}
              <div className="reveal-on-scroll order-1 lg:order-2 relative z-10">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-gray-900 mb-8 sm:mb-12 leading-tight tracking-tight">
                  Project
                  <span className="block text-transparent bg-gradient-to-r from-green-600 via-emerald-500 to-teal-600 bg-clip-text animate-gradient">
                    Goals
                  </span>
                </h2>
                <div className="space-y-6 sm:space-y-8 lg:space-y-10">
                  {([
                    "Development of a Data Management Framework to handle large-scale, multi-source water data",
                    "Design of an Integrated Hydro-Computational Modeling Framework to simulate water behaviors",
                    "Creation of a Graphical User Interface (GUI) for simplified decision-making and visual data representation",
                    "Implementation of a stakeholder engagement platform to facilitate inclusive Water Resource Management",
                    "Development of policy recommendation modules adapted to changing environmental conditions"
                  ] as string[]).map((objective: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-start space-x-4 sm:space-x-6 group hover:translate-x-1 transition-all duration-300"
                    >
                      <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-tr from-green-500 to-emerald-500 text-white flex items-center justify-center font-bold text-sm sm:text-base lg:text-lg shadow-lg shadow-green-500/30 group-hover:scale-110 group-hover:shadow-emerald-500/50 transition-all duration-300">
                        {index + 1}
                      </div>
                      <p className="text-sm sm:text-base lg:text-lg text-gray-700 leading-relaxed pt-1 sm:pt-2 group-hover:text-gray-900 transition-colors duration-300">
                        {objective}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Applications Section */}
        <section className="relative py-16 sm:py-20 lg:py-32 px-4 sm:px-6 overflow-hidden bg-gradient-to-br from-gray-900 via-indigo-950 to-black">
          {/* Accent gradient orbs */}
          <div className="absolute -top-40 -left-40 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] bg-gradient-to-br from-indigo-600/20 to-purple-600/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] bg-gradient-to-tr from-blue-600/20 to-emerald-500/10 rounded-full blur-3xl"></div>

          <div className="relative max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-12 sm:mb-16 lg:mb-20 reveal-on-scroll">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white mb-6 sm:mb-8">
                Transforming Water
                <span className="block text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text animate-gradient">
                  Management
                </span>
              </h2>
              <p className="text-base sm:text-lg lg:text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                Our DSS addresses critical water management challenges across multiple sectors with innovative solutions
              </p>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  icon: "🌧️",
                  title: "Drought Management",
                  description: "Early warning systems and resource allocation optimization during water scarcity conditions",
                  gradient: "from-red-500 to-orange-500",
                },
                {
                  icon: "🌊",
                  title: "Flood Prevention",
                  description: "Real-time monitoring and predictive modeling to mitigate flooding risks in vulnerable areas",
                  gradient: "from-blue-500 to-cyan-500",
                },
                {
                  icon: "💧",
                  title: "Groundwater Management",
                  description: "Sustainable utilization strategies based on recharge rates, extraction patterns, and contamination risks",
                  gradient: "from-teal-500 to-green-500",
                },
                {
                  icon: "🏙️",
                  title: "Urban Water Supply",
                  description: "Optimization of distribution networks, leakage detection, and demand forecasting for growing urban centers",
                  gradient: "from-purple-500 to-indigo-500",
                },
                {
                  icon: "🌾",
                  title: "Agricultural Water",
                  description: "Precision irrigation scheduling and crop water requirement modeling to maximize agricultural productivity",
                  gradient: "from-green-500 to-emerald-500",
                },
                {
                  icon: "🏞️",
                  title: "Ecosystem Protection",
                  description: "Monitoring and preserving aquatic ecosystems while maintaining sustainable water resource utilization",
                  gradient: "from-emerald-500 to-teal-500",
                },
              ].map((app, index) => (
                <div key={index} className="reveal-on-scroll group">
                  <div className="bg-white/5 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 p-6 sm:p-8 h-full border border-white/10">
                    <div
                      className={`w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 bg-gradient-to-r ${app.gradient} rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mb-6 sm:mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg`}
                    >
                      {app.icon}
                    </div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-3 sm:mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-gray-100 group-hover:to-gray-400 transition-all duration-300">
                      {app.title}
                    </h3>
                    <p className="text-gray-300 leading-relaxed text-sm sm:text-base">
                      {app.description}
                    </p>
                    <div className="mt-4 sm:mt-6 flex items-center text-xs sm:text-sm font-medium text-gray-400 group-hover:text-gray-200 transition-colors duration-300">
                      <span>Learn more</span>
                      <svg
                        className="ml-2 w-3 h-3 sm:w-4 sm:h-4 transform group-hover:translate-x-1 transition-transform duration-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Technology Framework */}
        <section className="py-16 sm:py-20 lg:py-32 px-4 sm:px-6 bg-gradient-to-br from-white/90 to-purple-50/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="reveal-on-scroll">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-6 sm:mb-10 leading-tight">
                  Technological
                  <span className="block text-transparent bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text">
                    Framework
                  </span>
                </h2>
                <p className="text-base sm:text-lg lg:text-xl text-gray-700 mb-8 sm:mb-12 leading-relaxed">
                  Our DSS utilizes cutting-edge data sources and advanced analytics to provide comprehensive water resource insights through integrated technology solutions.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {[
                    { name: "Central Water Commission", abbr: "CWC", color: "from-blue-500 to-blue-600" },
                    { name: "India Meteorological Dept", abbr: "IMD", color: "from-green-500 to-green-600" },
                    { name: "NASA MODIS Satellites", abbr: "SAT", color: "from-purple-500 to-purple-600" },
                    { name: "IoT Sensor Networks", abbr: "IoT", color: "from-orange-500 to-orange-600" }
                  ].map((source, index) => (
                    <div key={index} className="group">
                      <div className="flex items-center space-x-3 sm:space-x-4 p-4 sm:p-6 bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 group-hover:scale-105">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-r ${source.color} text-white rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm shadow-lg group-hover:rotate-6 transition-transform duration-300`}>
                          {source.abbr}
                        </div>
                        <span className="text-gray-700 font-semibold group-hover:text-gray-900 transition-colors duration-300 text-sm sm:text-base">{source.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="reveal-on-scroll">
                <div className="relative group">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/3/35/AWS%28Automatic_Weather_station%29.JPG"
                    alt="Advanced Weather Station Technology"
                    className="rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl w-full h-[300px] sm:h-[400px] lg:h-[500px] object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl sm:rounded-3xl"></div>
                  <div className="absolute top-4 sm:top-6 right-4 sm:right-6">
                    <div className="bg-purple-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-ping"></div>
                      <span>Live Data</span>
                    </div>
                  </div>
                  <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6">
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6">
                      <h3 className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 mb-1 sm:mb-2">Automated Weather Station</h3>
                      <p className="text-gray-600 text-xs sm:text-sm">Real-time meteorological data collection for precise water resource modeling</p>
                    </div>
                  </div>
                  {/* Enhanced decorative elements */}
                  <div className="absolute -top-3 sm:-top-6 -right-3 sm:-right-6 w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-purple-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                  <div className="absolute -bottom-3 sm:-bottom-6 -left-3 sm:-left-6 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-pink-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Collaborations Section */}
        <section className="relative w-full min-h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-neutral-900 to-indigo-950 text-neutral-100">
          {/* Accent gradient orbs */}
          <div className="absolute -top-40 -left-40 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] bg-gradient-to-br from-emerald-500/20 to-teal-400/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] bg-gradient-to-tr from-indigo-500/20 to-purple-600/10 rounded-full blur-3xl"></div>

          <div className="relative grid h-full grid-cols-1 lg:grid-cols-[35%_65%] min-h-screen">
            {/* Left Image */}
            <div className="relative h-[40vh] lg:h-full">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Kendujhar%2C_Odisha%2C_India_-_panoramio_%2824%29.jpg/960px-Kendujhar%2C_Odisha%2C_India_-_panoramio_%2824%29.jpg?20170620025307"
                alt="Coastal cleanup volunteers at work"
                className="h-full w-full object-cover brightness-90 contrast-110 lg:rounded-r-3xl shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent lg:rounded-r-3xl"></div>
            </div>

            {/* Right Content */}
            <div className="flex items-center py-12 lg:py-0">
              <div className="px-4 sm:px-6 md:px-8 lg:px-16 max-w-4xl mx-auto">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text mb-6">
                  Key Collaborations
                </h2>

                <p className="mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg leading-relaxed text-gray-300 first-letter:uppercase first-letter:text-2xl sm:first-letter:text-3xl lg:first-letter:text-4xl first-letter:font-semibold first-letter:mr-2 first-letter:float-left">
                  This DSS works in alignment with national water projects including:
                </p>

                <ul className="mt-6 sm:mt-8 space-y-3 sm:space-y-4 text-sm sm:text-base lg:text-lg leading-relaxed">
                  <li className="flex items-start space-x-3">
                    <span className="mt-1.5 sm:mt-2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 flex-shrink-0"></span>
                    <span>
                      <strong>Jal Jeevan Mission:</strong> Supporting the aim of providing safe drinking water to all households.
                    </span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="mt-1.5 sm:mt-2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 flex-shrink-0"></span>
                    <span>
                      <strong>Atal Bhujal Yojana:</strong> Enhancing groundwater management through community participation.
                    </span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="mt-1.5 sm:mt-2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-r from-blue-400 to-cyan-500 flex-shrink-0"></span>
                    <span>
                      <strong>National Hydrological Project:</strong> Improving the accessibility of water resources information.
                    </span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="mt-1.5 sm:mt-2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-r from-pink-400 to-red-500 flex-shrink-0"></span>
                    <span>
                      <strong>National Groundwater Management Improvement Program-2:</strong> Supporting sustainable groundwater management.
                    </span>
                  </li>
                </ul>

                <p className="mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg leading-relaxed text-gray-300">
                  By integrating these missions' goals into our system, we aim to enhance India's water resource management capabilities.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.8s ease-out forwards;
        }
        
        .animation-delay-300 {
          animation-delay: 0.3s;
        }
        
        .animation-delay-600 {
          animation-delay: 0.6s;
        }
        
        .animation-delay-900 {
          animation-delay: 0.9s;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}