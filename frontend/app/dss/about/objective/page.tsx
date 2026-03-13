import React from "react";

const objectives = [
  {
    title: "Data Management Framework",
    description:
      "Develop a robust framework capable of handling large-scale, multi-source water datasets including hydrological, hydrogeological, meteorological, water quality, socio-economic, and remote sensing data.",
  },
  {
    title: "Integrated Hydro-Computational Modeling",
    description:
      "Simulate water availability, quality, floods, groundwater dynamics, river–aquifer interactions, and climate change impacts using advanced computational models.",
  },
  {
    title: "Interactive Decision Support Interface",
    description:
      "Enable simplified decision-making through intuitive dashboards, GIS-based maps, scenario analysis tools, and automated reporting.",
  },
  {
    title: "Stakeholder Engagement Platform",
    description:
      "Support inclusive, transparent, and participatory water resource management through knowledge sharing and stakeholder collaboration.",
  },
  {
    title: "Policy Support & Recommendations",
    description:
      "Develop adaptive policy recommendation modules aligned with national water missions and evolving governance frameworks.",
  },
];

const DSSObjectives: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Decision Support System (DSS) for Water Resource Management
          </h1>
          <p className="text-lg text-blue-100 max-w-3xl">
            A comprehensive, integrated, and scalable digital platform designed
            to strengthen scientific, institutional, and policy-driven
            decision-making in India’s water sector.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        {/* Overview */}
        <section className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-2xl font-semibold mb-4">
            Objectives of the DSS
          </h2>
          <p className="leading-relaxed text-slate-600">
            The Decision Support System (DSS) has been developed to address the
            increasing complexity of water resource management driven by climate
            variability, rapid urbanization, rising water demands, and competing
            sectoral needs. A key focus of the system is effective sewage
            management through systematic assessment of sewage loads,
            prioritization of treatment interventions, and identification of
            suitable locations for treatment infrastructure.
          </p>
          <p className="leading-relaxed text-slate-600 mt-4">
            By integrating large volumes of heterogeneous data with advanced
            analytical and computational models, the DSS transforms raw data into
            actionable knowledge. This reduces uncertainty, improves
            transparency, and minimizes unintended consequences in
            water-related interventions.
          </p>
        </section>

        {/* Capabilities */}
        <section className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-xl font-semibold mb-3">
              Evidence-Based Planning & Scenario Analysis
            </h3>
            <p className="text-slate-600 leading-relaxed">
              The DSS enables simulation of hydrological processes, forecasting
              of future conditions, and evaluation of alternative management
              strategies under changing environmental and socio-economic
              scenarios. It supports both short-term operational decisions and
              long-term strategic planning at river basin, regional, and local
              scales.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-8">
            <h3 className="text-xl font-semibold mb-3">
              Decision-Maker Friendly Design
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Through an intuitive graphical user interface and interactive
              visualizations, the DSS makes complex scientific analyses
              accessible to policymakers, planners, and implementing agencies,
              enabling easy interpretation, scenario comparison, and
              decision-ready outputs.
            </p>
          </div>
        </section>

        {/* Major Objectives */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">
            Major Objectives of the DSS
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {objectives.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
              >
                <h3 className="text-lg font-semibold mb-3 text-blue-700">
                  {item.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Alignment */}
        <section className="bg-blue-50 border border-blue-100 rounded-xl p-8">
          <h3 className="text-xl font-semibold mb-3 text-blue-800">
            National Alignment & Impact
          </h3>
          <p className="text-slate-700 leading-relaxed">
            The DSS is aligned with the National Water Mission and associated
            national programs, contributing to improved water use efficiency,
            sustainable resource management, and enhanced institutional capacity
            across India.
          </p>
        </section>
      </main>

    
    </div>
  );
};

export default DSSObjectives;
