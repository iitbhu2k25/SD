import React from "react";

const coreValues = [
  {
    title: "Scientific Rigor & Accuracy",
    description:
      "All analyses, models, and recommendations are grounded in validated data, robust methodologies, and established hydrological and computational principles.",
  },
  {
    title: "Holistic & Integrated Thinking",
    description:
      "The DSS adopts an integrated surface water–groundwater–socio-economic perspective, recognizing the interconnected nature of water systems and governance structures.",
  },
  {
    title: "Sustainability & Resilience",
    description:
      "The project prioritizes long-term environmental sustainability, climate resilience, and adaptive management to ensure future water security.",
  },
  {
    title: "Transparency & Accountability",
    description:
      "Model assumptions, data sources, and outputs are designed to be transparent, traceable, and reproducible, fostering trust among stakeholders and decision-makers.",
  },
  {
    title: "Stakeholder Inclusivity",
    description:
      "The DSS values participatory approaches, incorporating inputs from government agencies, communities, academia, and industry to reflect real-world needs and constraints.",
  },
  {
    title: "Scalability & Replicability",
    description:
      "All frameworks and modules are designed to be scalable across river basins and adaptable to diverse hydro-climatic and socio-economic contexts.",
  },
];

const DSSCoreValues: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <span className="inline-block text-sm uppercase tracking-wider text-blue-200 mb-3">
            Core Values
          </span>
          <h1 className="text-3xl md:text-4xl font-bold max-w-3xl">
            Principles Guiding the Decision Support System
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-200 leading-relaxed">
            The development and implementation of the Decision Support System for
            Water Resource Management are guided by a set of foundational values
            that ensure credibility, inclusivity, and long-term impact.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Values Grid */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {coreValues.map((value, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm p-8 hover:shadow-md transition"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-slate-900">
                    {value.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Closing Statement */}
        <section className="mt-16 bg-blue-50 border border-blue-100 rounded-xl p-10">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">
            A Values-Driven Decision Support Platform
          </h2>
          <p className="text-slate-700 leading-relaxed max-w-4xl">
            By embedding these core values into every layer of design and
            implementation, the DSS ensures that water resource management
            decisions are scientifically sound, socially inclusive, transparent,
            and adaptable to future challenges.
          </p>
        </section>
      </main>

      
    </div>
  );
};

export default DSSCoreValues;
