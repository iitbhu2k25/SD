"use client";
import Image from "next/image";

import { useEffect } from "react";
import { SwiperSection } from "@/components/SwiperSection";

export default function GovernmentStyleAboutPage() {
  const HERO_BG = "/Images/about/main_background.jpg";

  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal-on-scroll")
    );
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting)
            e.target.classList.add("opacity-100", "translate-y-0");
        });
      },
      { threshold: 0.35 }
    );
    els.forEach((el) => {
      el.classList.add(
        "opacity-0",
        "translate-y-10",
        "transition-all",
        "duration-700",
        "ease-out",
        "will-change-transform"
      );
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const slides = [
    {
      image: "/Images/about/Anurag_Ohri_Sir.jpg",
      title: "Prof. Anurag Ohri",
      position: "Principal Investigator",
      body: "Department of Civil Engineering IIT(BHU)",
    },
    {
      image: "/Images/about/Pramod_Sir.jpg",
      title: "Prof. Pramod Soni",
      position: "Principal Investigator",
      body: "Department of Civil Engineering IIT(BHU)",
    },
    {
      image: "/Images/about/Shashir_Gaur_Sir.jpg",
      title: "Prof. Shishir Gaur",
      position: "Coordinator",
      body: "Department of Civil Engineering IIT(BHU)",
    },
    {
      image: "", // Empty Tile
      title: "Co-Principal Investigator",
      body: "Modeling and Creating the Water Management System",
    },
    {
      image: "/Images/about/Om_Damani_Sir.jpg",
      title: "Prof. Om Damani",
      body: "Department of Computer Science, IIT Bombay",
    },
    {
      image: "/Images/about/PK_Mishra_Sir.avif",
      title: "Prof P. K. Mishra",
      body: "Department of Chemical Engineering, IIT(BHU)",
    },
    {
      image: "/Images/about/Medha_Jha_Mam.jpeg",
      title: "Prof. Medha Jha",
      body: "Department of Chemical Engineering, IIT(BHU)",
    },
    {
      image: "/Images/about/Tanima_Dutta_Mam.webp",
      title: "Prof. Tanima Dutta",
      body: "Department of Computer Sc. and Engg., IIT(BHU)",
    },
    {
      image: "/Images/about/Shyam_Kamal_Sir.jpg",
      title: "Prof. Shyam Kamal, Associate Professor",
      body: "Dept of Electrical Engineering, IIT(BHU)",
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
    {
      image: "", // Empty Tile
      title: "Research & Development Team",
      body: "",
    },
    {
      image: "/Images/about/Akash_Sir.png",
      title: "Dr. Akash Tiwari",
      title_type: "normal",
      body: "(Research Associate)",
    },
    {
      image: "/Images/about/Alok_Sir.jpg",
      title: "Dr. Alok Raj",
      title_type: "normal",
      body: "Data Analyst (YP)",
    },
    {
      image: "/Images/about/hariom.png",
      title: "Hariom Singh Rathore",
      title_type: "normal",
      body: "Programmer (YP)",
    },
    {
      image: "/Images/about/sample_photo.jpg",
      title: "Rajat Saxena",
      title_type: "normal",
      body: "(Software Engineer)",
    },
    {
      image: "/Images/about/Muskan.jpeg",
      title: "Muskan Gupta",
      title_type: "normal",
      body: "(Software Engineer)",
    },
    {
      image: "/Images/about/Rajkumar.jpg",
      title: "Rajkumar Choudhury",
      title_type: "normal",
      body: "(Software Engineer)",
    },
    {
      image: "/Images/about/Anas.webp",
      title: "Anas Khan",
      title_type: "normal",
      body: "(Software Engineer)",
    },
  ];

  return (
    <div className="bg-neutral-950 text-neutral-100 font-['Roboto',_system-ui,_Arial,_sans-serif] antialiased">
      <section className="w-full min-h-screen lg:h-screen bg-neutral-50 text-neutral-900">
        <div className="h-px bg-slate-200/80" aria-hidden />{" "}
        {/* subtle divider */}
        <div className="flex flex-col lg:grid lg:grid-cols-[60%_40%] min-h-screen lg:h-full">
          <div className="flex items-center order-first lg:order-none flex-none lg:flex-auto">
            <div className="p-6 sm:px-8 md:px-12 lg:px-16 sm:py-10 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl max-lg:text-center font-bold tracking-tight text-neutral-800">
                Introduction
              </h2>
              <p className="mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg leading-relaxed first-letter:uppercase first-letter:text-6xl first-letter:font-semibold first-letter:mr-2 first-letter:float-left">
                This project addresses the critical need for a comprehensive
                Decision Support System (DSS) to manage water resources
                effectively. The DSS integrates sophisticated models and
                simulations to support sustainable Water Resource Management,
                ultimately contributing to the achievement of Sustainable
                Development Goals (SDGs).
              </p>
              <p className="mt-5 text-sm sm:text-base lg:text-lg leading-relaxed">
                Water Resource Management is a complex, multi-dimensional
                challenge exacerbated by climate change, urban expansion, and
                socio-economic dynamics. The aim of this DSS is to provide
                holistic solutions to water management by combining
                hydrological, socio-economic, and ecological factors through an
                integrated modeling framework.
              </p>
            </div>
          </div>
          <div className="order-last lg:order-none flex-1 lg:flex-none">
            <Image
              src="/Images/about/Varanasi_Munshi_Ghat.jpg"
              alt="Volunteers cleaning a riverbank"
              className="h-full w-full object-cover"
              width={2000}
              height={2000}
            />
          </div>
        </div>
      </section>

      <div className="overflow-x-visible">
        <SwiperSection
          heroBg="/Images/about/main_background.jpg"
          slides={slides}
        />
      </div>

      <section className="w-full min-h-screen lg:h-screen bg-neutral-900 text-neutral-100">
        <div className="flex flex-col lg:grid lg:grid-cols-[40%_60%] min-h-screen lg:h-full">
          <div className="order-last lg:order-none flex-1 lg:flex-none">
            <Image
              src="/Images/about/Doppler_Weather_Radar_Station_Kailasagiri.jpg"
              alt="Community river cleanup effort"
              className="h-full w-full object-cover"
              width={1000} height={1000}
            />
          </div>
          <div className="flex items-center order-first lg:order-none flex-none lg:flex-auto">
            <div className="p-6 sm:px-8 md:px-12 lg:px-16 sm:py-10 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl max-lg:text-center font-bold tracking-tight text-neutral-50">
                Project Objectives
              </h2>
              <ul className="mt-6 list-decimal list-outside pl-6 space-y-2.5 marker:text-slate-400 marker:font-semibold text-sm s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           m:text-base lg:text-lg leading-relaxed">
                <li>
                  Development of a Data Management Framework to handle
                  large-scale, multi-source water data.
                </li>
                <li>
                  Design of an Integrated Hydro-Computational Modeling Framework
                  to simulate water behaviors.
                </li>
                <li>
                  Creation of a Graphical User Interface (GUI) for simplified
                  decision-making and visual data representation.
                </li>
                <li>
                  Implementation of a stakeholder engagement platform to
                  facilitate inclusive Water Resource Management.
                </li>
                <li>
                  Development of policy recommendation modules adapted to
                  changing environmental conditions.
                </li>
              </ul>
              <p className="mt-5 text-sm sm:text-base lg:text-lg leading-relaxed">
                The above objectives are aligned with the National Water Mission
                and aim to enhance water resource management capabilities
                throughout India.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full min-h-screen lg:h-screen bg-neutral-50 text-neutral-900">
        <div className="flex flex-col lg:grid lg:grid-cols-[60%_40%] min-h-screen lg:h-full">
          <div className="flex items-center order-first lg:order-none flex-none lg:flex-auto">
            <div className="p-6 sm:px-8 md:px-12 lg:px-16 sm:py-10 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl max-lg:text-center font-bold tracking-tight text-neutral-800">
                Potential Applications
              </h2>
              <ul className="mt-6 list-disc list-outside pl-6 space-y-3 marker:text-slate-500 text-sm sm:text-base lg:text-lg leading-relaxed">
                <li>
                  <strong>Drought Management</strong> — Early warning systems
                  and resource allocation optimization during water scarcity
                  conditions.
                </li>
                <li>
                  <strong>Flood Prevention</strong> — Real-time monitoring and
                  predictive modeling to mitigate flooding risks in vulnerable
                  areas.
                </li>
                <li>
                  <strong>Groundwater Management</strong> — Sustainable
                  utilization strategies based on recharge rates, extraction
                  patterns, and contamination risks.
                </li>
                <li>
                  <strong>Urban Water Supply</strong> — Optimization of
                  distribution networks, leakage detection, and demand
                  forecasting for growing urban centers.
                </li>
                <li>
                  <strong>Agricultural Water</strong> — Precision irrigation
                  scheduling and crop water requirement modeling to maximize
                  agricultural productivity.
                </li>
              </ul>
            </div>
          </div>
          <div className="order-last lg:order-none flex-1 lg:flex-none">
            <Image
              src="/Images/about/varuna1.png"
              alt="Riverside flood protection levee"
              className="h-full w-full object-cover"
              width={1000} height={1000}
              unoptimized={false}
            />
          </div>
        </div>
      </section>

      <section className="w-full min-h-screen lg:h-screen bg-neutral-900 text-neutral-100">
        <div className="flex flex-col lg:grid lg:grid-cols-[40%_60%] min-h-screen lg:h-full">
          <div className="order-last lg:order-none flex-1 lg:flex-none">
            <Image
              src="/Images/about/Kendujhar_Odisha.jpg"
              alt="Coastal cleanup volunteers at work"
              className="h-full w-full object-cover"
              width={1000} height={1000}
            />
          </div>
          <div className="flex items-center order-first lg:order-none flex-none lg:flex-auto">
            <div className="p-6 sm:px-8 md:px-12 lg:px-16 sm:py-10 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl max-lg:text-center font-bold tracking-tight text-neutral-50">
                Key Collaborations
              </h2>
              <p className="mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg leading-relaxed first-letter:uppercase first-letter:text-4xl first-letter:font-semibold first-letter:mr-2 first-letter:float-left">
                This DSS works in alignment with national water projects
                including:
              </p>
              <ul className="mt-4 list-disc list-outside pl-6 space-y-3 marker:text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed">
                <li>
                  <strong>Jal Jeevan Mission:</strong> Supporting the aim of
                  providing safe drinking water to all households.
                </li>
                <li>
                  <strong>Atal Bhujal Yojana:</strong> Enhancing groundwater
                  management through community participation.
                </li>
                <li>
                  <strong>National Hydrological Project:</strong> Improving the
                  accessibility of water resources information.
                </li>
                <li>
                  <strong>
                    National Groundwater Management Improvement Program-2:
                  </strong>{" "}
                  Supporting sustainable groundwater management.
                </li>
              </ul>

              <p className="mt-5 text-sm sm:text-base lg:text-lg leading-relaxed">
                By integrating these missions' goals into our system, we aim to
                enhance India's water resource management capabilities.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full min-h-screen lg:h-screen bg-neutral-50 text-neutral-900">
        <div className="flex flex-col lg:grid lg:grid-cols-[60%_40%] min-h-screen lg:h-full">
          <div className="flex items-center order-first lg:order-none flex-none lg:flex-auto">
            <div className="p-6 sm:px-8 md:px-12 lg:px-16 sm:py-10 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl max-lg:text-center font-bold tracking-tight text-neutral-800">
                Technological Framework
              </h2>
              <p className="mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg leading-relaxed first-letter:uppercase first-letter:text-4xl first-letter:font-semibold first-letter:mr-2 first-letter:float-left">
                The DSS utilizes advanced data from sources such as:
              </p>
              <ul className="mt-4 list-disc list-outside pl-6 space-y-3 marker:text-slate-500 text-sm sm:text-base lg:text-lg leading-relaxed">
                <li>Central Water Commission (CWC) monitoring stations</li>
                <li>India Meteorological Department (IMD) weather forecasts</li>
                <li>
                  Satellite imagery from NASA's MODIS and Sentinel satellites
                </li>
                <li>Ground-level monitoring through IoT sensor networks</li>
              </ul>
              <p className="mt-5 text-sm sm:text-base lg:text-lg leading-relaxed">
                By combining these data sources and applying system thinking
                methodologies, the DSS facilitates informed, effective
                decision-making at multiple levels of Water Resource Management.
              </p>
            </div>
          </div>
          <div className="order-last lg:order-none flex-1 lg:flex-none">
            <Image
              src="/Images/about/AWS(Automatic_Weather_station).jpg"
              alt="Groundwater monitoring well"
              className="h-full w-full object-cover"
              width={1920}
              height={1080}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
