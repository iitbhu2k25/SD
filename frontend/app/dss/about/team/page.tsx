"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import Link from 'next/link';

interface TeamMember {
  image: string;
  title: string;
  position?: string;
  body: string;
  title_type?: string;
  url?: string;
}

export default function TeamPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".fade-in-up")
    );
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("opacity-100", "translate-y-0");
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => {
      el.classList.add(
        "opacity-0",
        "translate-y-12",
        "transition-all",
        "duration-700",
        "ease-out"
      );
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  // Leadership & Dignitaries
  const leadership: TeamMember[] = [
    {
      image: "/Images/navbar/persons/CR_patil.jpg",
      title: "Shri C.R. Patil",
      position: "Hon'ble Union Minister",
      body: "Ministry of Jal Shakti",
    },
    {
      image: "/Images/navbar/persons/secretary1.jpg",
      title: "Shri V.L. Kantha Rao",
      position: "Secretary",
      body: "Department of Water Resources, River Development & Ganga Rejuvenation",
    },
    {
      image: "/Images/navbar/persons/Rajeev_Mital1.jpg",
      title: "Shri Rajeev Mittal",
      position: "Director General",
      body: "National Mission for Clean Ganga",
    },
    {
      image: "/Images/navbar/persons/nalin_sir.png",
      title: "Shri Nalin Kumar Srivastava",
      position: "Deputy Director General",
      body: "National Mission for Clean Ganga",
    },
    {
      image: "/Images/navbar/persons/dheeraj_joshi.jpeg",
      title: "Shri Dheeraj Joshi",
      position: "Director (Urban)",
      body: "National Mission for Clean Ganga",
    },
  ];

  // Principal Investigators
  const teamMembers: TeamMember[] = [
    {
      image: "/Images/navbar/persons/Anurag_Ohri_Sir.jpg",
      title: "Prof. Anurag Ohri",
      position: "Principal Investigator",
      body: "Department of Civil Engineering, IIT (BHU) Varanasi",
      url: "https://www.iitbhu.ac.in/dept/civ/people/aohriciv"
    },
    {
      image: "/Images/navbar/persons/Pramod_Sir.jpg",
      title: "Prof. Pramod Soni",
      position: "Principal Investigator",
      body: "Department of Civil Engineering, IIT (BHU) Varanasi",
      url: "https://www.iitbhu.ac.in/dept/civ/people/pramodciv"
    },
  ];

  const coInvestigators: TeamMember[] = [
    {
      image: "/Images/about/Om_Damani_Sir.jpg",
      title: "Prof. Om Damani",
      body: "Department of Computer Science, IIT Bombay",
    },
    {
      image: "/Images/about/PK_Mishra_Sir.avif",
      title: "Prof. P. K. Mishra",
      body: "Department of Chemical Engineering, IIT (BHU) Varanasi",
    },
    {
      image: "/Images/about/Medha_Jha_Mam.jpeg",
      title: "Prof. Medha Jha",
      body: "Department of Chemical Engineering, IIT (BHU) Varanasi",
    },
    {
      image: "/Images/about/Tanima_Dutta_Mam.webp",
      title: "Prof. Tanima Dutta",
      body: "Department of Computer Science and Engineering, IIT (BHU) Varanasi",
    },
    {
      image: "/Images/about/Shyam_Kamal_Sir.jpg",
      title: "Prof. Shyam Kamal",
      position: "Associate Professor",
      body: "Department of Electrical Engineering, IIT (BHU) Varanasi",
    },
    {
      image: "/Images/about/Pooja_Parsad_Mam.jpg",
      title: "Prof. Pooja Prasad",
      body: "School of Public Policy, IIT Delhi",
    },
    {
      image: "/Images/about/Nikhil_Bugalia_Sir.webp",
      title: "Prof. Nikhil Bugalia",
      body: "Department of Civil Engineering, IIT Madras",
    },
    {
      image: "/Images/about/Ram_Avtar_Sir.jpg",
      title: "Prof. Ram Avtar",
      body: "Faculty of Environmental Earth Science, Hokkaido University, Japan",
    },
  ];

  const rdTeam: TeamMember[] = [
    {
      image: "/Images/about/Akash_Sir.png",
      title: "Dr. Akash Tiwari",
      body: "Research Associate",
      title_type: "normal",
    },
    {
      image: "/Images/about/Alok_Sir.jpg",
      title: "Dr. Alok Raj",
      body: "Data Analyst (Young Professional)",
      title_type: "normal",
    },
    {
      image: "/Images/about/hariom.png",
      title: "Hariom Singh Rathore",
      body: "Programmer (Young Professional)",
      title_type: "normal",
    },
    {
      image: "/Images/about/rajat.webp",
      title: "Rajat Saxena",
      body: "Software Architect",
      title_type: "normal",
    },
    {
      image: "/Images/about/Muskan.jpeg",
      title: "Muskan Gupta",
      body: "Software Engineer",
      title_type: "normal",
    },
    {
      image: "/Images/about/Rajkumar.jpg",
      title: "Rajkumar Choudhury",
      body: "Software Engineer",
      title_type: "normal",
    },
    {
      image: "/Images/about/Anas.webp",
      title: "Anas Khan",
      body: "Software Engineer",
      title_type: "normal",
    },
    {
      image: "/Images/about/gaurav.webp",
      title: "Gaurav Kumar",
      body: "Software Engineer",
      title_type: "normal",
    },
  ];

  const CardContent = ({ member }: { member: TeamMember }) => (
    <div className="aspect-square relative overflow-hidden bg-teal-50 cursor-pointer group">
      {member.image && (
        <Image
          src={member.image}
          alt={member.title}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-700"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-teal-900/60 via-transparent to-transparent" />
    </div>
  );

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-50 text-slate-900">
      {/* Hero Section */}
      <section className="relative h-screen overflow-hidden">
        {/* Background Image - Fixed */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{ backgroundImage: "url('/Images/about/main_background.jpg')" }}
        />

        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/55 via-teal-50/45 to-emerald-50/55" />

        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgb(59 130 246 / 0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(59 130 246 / 0.15) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Topographic Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="topo" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M0,50 Q50,30 100,50 T200,50" fill="none" stroke="rgb(59 130 246)" strokeWidth="1.5" />
              <path d="M0,100 Q50,80 100,100 T200,100" fill="none" stroke="rgb(20 184 166)" strokeWidth="1.5" />
              <path d="M0,150 Q50,130 100,150 T200,150" fill="none" stroke="rgb(16 185 129)" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo)" />
        </svg>

        <div className="relative z-10 container mx-auto px-6 h-full flex flex-col justify-center items-center text-center">
          <div className="fade-in-up">
            <div className="inline-block mb-6">
              <span className="text-blue-700 text-sm font-mono tracking-[0.3em] uppercase border-2 border-blue-600/30 px-6 py-2 rounded-full bg-white/80 backdrop-blur-sm shadow-lg">
                🌍 Our Team
              </span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-br from-blue-700 via-teal-600 to-emerald-700">
              Meet the Experts
            </h1>
            <p className="text-xl md:text-2xl text-slate-700 max-w-3xl mx-auto font-medium">
              Leading researchers and engineers driving innovation in water resource management
            </p>
          </div>
        </div>

        {/* GIS Marker Points */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-blue-500 rounded-full shadow-lg animate-ping" />
        <div className="absolute top-40 right-20 w-3 h-3 bg-teal-500 rounded-full shadow-lg animate-ping" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-40 left-1/4 w-3 h-3 bg-emerald-500 rounded-full shadow-lg animate-ping" style={{ animationDelay: '1s' }} />
      </section>

      {/* Leadership & Dignitaries */}
      <section className="py-32 relative overflow-hidden">
        {/* Background Image - Fixed */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{ backgroundImage: "url('/Images/about/Varanasi_Munshi_Ghat.jpg')" }}
        />
        <div className="absolute inset-0 bg-white/35" />

        {/* Satellite Grid Background */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `
            radial-gradient(circle at 2px 2px, rgb(59 130 246 / 0.15) 1px, transparent 0)
          `,
          backgroundSize: '32px 32px'
        }} />

        <div className="container mx-auto px-6 relative z-10">
          <div className="fade-in-up mb-16">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent" />
              <span className="text-blue-700 text-sm font-mono tracking-[0.2em] uppercase bg-blue-50 px-4 py-2 rounded-full border border-blue-200">
                🏛️ Leadership
              </span>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent" />
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-center mb-4 text-slate-900">
              Leadership & Dignitaries
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 max-w-7xl mx-auto items-stretch">
            {leadership.map((member, idx) => (
              <div
                key={idx}
                className="fade-in-up group h-full"
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                <div className="relative h-full flex flex-col overflow-hidden rounded-2xl bg-white border-2 border-blue-200 hover:border-blue-500 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/30">

                  {/* Image Section */}
                  <div className="relative aspect-square overflow-hidden bg-blue-50">
                    {member.image && (
                      <Image
                        src={member.image}
                        alt={member.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-blue-900/60 via-transparent to-transparent" />
                  </div>

                  {/* Content Section */}
                  <div className="p-6 flex flex-col flex-1 bg-gradient-to-br from-white to-blue-50/30">
                    <div className="mb-3">
                      <span className="inline-block text-xs font-mono text-blue-700 bg-blue-100 px-3 py-1 rounded-full border border-blue-300">
                        {member.position}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold mb-3 text-slate-900 group-hover:text-blue-700 transition-colors leading-tight">
                      {member.title}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed">
                      {member.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principal Investigators */}
      <section className="py-32 relative overflow-hidden">
        {/* Background Image - Fixed */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{ backgroundImage: "url('/Images/about/Doppler_Weather_Radar_Station_Kailasagiri.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/95 via-cyan-50/90 to-blue-50/95" />

        {/* Remote Sensing Wave Pattern */}
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="waves" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(20 184 166)" strokeWidth="1" />
                <circle cx="50" cy="50" r="30" fill="none" stroke="rgb(59 130 246)" strokeWidth="1" />
                <circle cx="50" cy="50" r="20" fill="none" stroke="rgb(16 185 129)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#waves)" />
          </svg>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="fade-in-up mb-16">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-teal-600 to-transparent" />
              <span className="text-teal-700 text-sm font-mono tracking-[0.2em] uppercase bg-teal-50 px-4 py-2 rounded-full border border-teal-300">
                📡 Principal Investigators
              </span>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-teal-600 to-transparent" />
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-center mb-4 text-slate-900">
              Principal Investigators
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto">
            {teamMembers.map((member, idx) => (
              <div
                key={idx}
                className="fade-in-up group"
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                <div className="relative overflow-hidden rounded-2xl bg-white border-2 border-teal-200 hover:border-teal-500 transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/30">

                  {member.url ? (
                    <Link href={member.url} target="_blank" rel="noopener noreferrer">
                      <CardContent member={member} />
                    </Link>
                  ) : (
                    <CardContent member={member} />
                  )}

                  <div className="p-7 bg-gradient-to-br from-white to-teal-50/30">
                    <span className="inline-block text-xs font-mono text-teal-700 bg-teal-100 px-3 py-1 rounded-full border border-teal-300 mb-3">
                      {member.position}
                    </span>

                    <h3 className="text-2xl font-bold mb-3 text-slate-900 group-hover:text-teal-700 transition-colors">
                      {member.title}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed">{member.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Co-Principal Investigators */}
      <section className="py-32 relative overflow-hidden">
        {/* Background Image - Fixed */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{ backgroundImage: "url('/Images/about/Kendujhar_Odisha.jpg')" }}
        />
        <div className="absolute inset-0 bg-white/35" />

        {/* GIS Coordinate Grid */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `
            linear-gradient(to right, rgb(16 185 129 / 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(16 185 129 / 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }} />

        <div className="container mx-auto px-6 relative z-10">
          <div className="fade-in-up mb-16">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-emerald-600 to-transparent" />
              <span className="text-emerald-700 text-sm font-mono tracking-[0.2em] uppercase bg-emerald-50 px-4 py-2 rounded-full border border-emerald-300">
                🛰️ Co-Principal Investigators
              </span>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-emerald-600 to-transparent" />
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-center mb-4 text-slate-900">
              Co-Principal Investigators
            </h2>
            <p className="text-center text-slate-600 text-lg max-w-2xl mx-auto font-medium">
              Modeling and Creating the Water Management System
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {coInvestigators.map((member, idx) => (
              <div
                key={idx}
                className="fade-in-up group"
                style={{ transitionDelay: `${idx * 50}ms` }}
              >
                <div className="relative overflow-hidden rounded-xl bg-white border-2 border-emerald-200 hover:border-emerald-500 transition-all duration-500 h-full hover:shadow-xl hover:shadow-emerald-500/20">
                  <div className="aspect-square relative overflow-hidden bg-emerald-50">
                    {member.image && (
                      <Image
                        src={member.image}
                        alt={member.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/50 via-transparent to-transparent" />
                  </div>
                  <div className="p-6 bg-gradient-to-br from-white to-emerald-50/30">
                    <h3 className="text-lg font-bold mb-2 text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight">
                      {member.title}
                    </h3>
                    {member.position && (
                      <p className="text-xs text-emerald-700 mb-2 font-semibold">{member.position}</p>
                    )}
                    <p className="text-sm text-slate-600 leading-relaxed">{member.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* R&D Team */}
      <section className="py-32 relative overflow-hidden">
        {/* Background Image - Fixed */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{ backgroundImage: "url('/Images/about/AWS(Automatic_Weather_station).jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50/95 via-purple-50/90 to-indigo-50/95" />

        {/* Hexagon Pattern */}
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
          <div className="fade-in-up mb-16">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-violet-600 to-transparent" />
              <span className="text-violet-700 text-sm font-mono tracking-[0.2em] uppercase bg-violet-50 px-4 py-2 rounded-full border border-violet-300">
                💻 Development
              </span>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-violet-600 to-transparent" />
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-center mb-4 text-slate-900">
              Research & Development Team
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {rdTeam.map((member, idx) => (
              <div
                key={idx}
                className="fade-in-up group"
                style={{ transitionDelay: `${idx * 50}ms` }}
              >
                <div className="relative overflow-hidden rounded-xl bg-white border-2 border-violet-200 hover:border-violet-500 transition-all duration-500 h-full hover:shadow-xl hover:shadow-violet-500/20">
                  <div className="aspect-square relative overflow-hidden bg-violet-50">
                    {member.image && (
                      <Image
                        src={member.image}
                        alt={member.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-violet-900/50 via-transparent to-transparent" />
                  </div>
                  <div className="p-6 bg-gradient-to-br from-white to-violet-50/30">
                    <h3 className="text-lg font-semibold mb-2 text-slate-900 group-hover:text-violet-700 transition-colors leading-tight">
                      {member.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{member.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 relative bg-gradient-to-br from-blue-100 via-teal-100 to-emerald-100">
        {/* Map Pins Decoration */}
        <div className="absolute top-10 left-20 text-blue-600 text-4xl animate-bounce">📍</div>
        <div className="absolute bottom-10 right-20 text-teal-600 text-4xl animate-bounce" style={{ animationDelay: '0.5s' }}>📍</div>

        <div className="container mx-auto px-6 text-center relative z-10">
          <div className="fade-in-up">
            <h3 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">
              Join Our Mission
            </h3>
            <p className="text-slate-700 text-lg max-w-2xl mx-auto mb-8">
              We're always looking for talented individuals passionate about sustainable water management
            </p>
            <Link href="/dss/contact">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 border-2 border-blue-700">
                Contact Us
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}