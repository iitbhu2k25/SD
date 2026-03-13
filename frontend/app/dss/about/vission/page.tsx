import React from "react";

const missionPoints = [
  {
    title: "Bridging Science, Policy & Practice",
    description:
      "Translate complex hydrological and socio-economic processes into actionable decision-support tools for planners and policymakers.",
  },
  {
    title: "Integrated Intelligence Platform",
    description:
      "Combine high-quality datasets, advanced modeling techniques, and systems-thinking approaches into a unified platform supporting forecasting, optimization, and scenario-based planning.",
  },
  {
    title: "Strengthening Water Governance",
    description:
      "Enhance institutional capacity through flexible, transparent, and evidence-based tools that reduce uncertainty and minimize unintended consequences.",
  },
  {
    title: "Stakeholder Engagement & Co-Creation",
    description:
      "Enable participatory planning for river rejuvenation and water resource management by presenting results in accessible, decision-ready formats.",
  },
];

const DSSVisionMission: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Hero / Vision */}
      <section className="relative bg-gradient-to-br from-teal-700 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <span className="inline-block text-sm uppercase tracking-wider text-teal-200 mb-4">
            Vision
          </span>
          <h1 className="text-3xl md:text-4xl font-bold max-w-4xl leading-tight">
            Building an intelligent and scalable decision-support ecosystem for
            sustainable, equitable, and climate-resilient water management across
            India’s small river basins.
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-blue-100 leading-relaxed">
            The Decision Support System (DSS) envisions rivers as integrated
            socio-ecological systems—where surface water, groundwater,
            infrastructure, governance, and community behavior are managed
            holistically to ensure long-term water security and ecological
            sustainability.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        {/* Vision Explanation */}
        <section className="bg-white rounded-xl shadow-sm p-8 md:p-10">
          <h2 className="text-2xl font-semibold mb-4 text-slate-900">
            Our Vision for Water Resource Management
          </h2>
          <p className="text-slate-600 leading-relaxed">
            The DSS aims to move beyond fragmented water management approaches by
            treating river basins as interconnected systems shaped by natural
            processes, infrastructure, governance frameworks, and human behavior.
            By embedding climate resilience, equity, and sustainability at its
            core, the system supports informed decision-making that balances
            environmental integrity with social and economic needs.
          </p>
        </section>

        {/* Mission */}
        <section>
          <div className="mb-8">
            <span className="inline-block text-sm uppercase tracking-wider text-blue-600 mb-2">
              Mission
            </span>
            <h2 className="text-2xl font-semibold">
              Translating Knowledge into Action
            </h2>
            <p className="mt-3 max-w-3xl text-slate-600 leading-relaxed">
              The mission of the DSS is to bridge science, policy, and practice by
              converting complex data and models into practical, transparent, and
              decision-ready tools that support adaptive water resource
              management.
            </p>
          </div>

          {/* Mission Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {missionPoints.map((item, index) => (
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

        {/* Governance & Participation */}
        <section className="bg-blue-50 border border-blue-100 rounded-xl p-8 md:p-10">
          <h3 className="text-xl font-semibold mb-4 text-blue-800">
            Inclusive & Participatory Water Governance
          </h3>
          <p className="text-slate-700 leading-relaxed max-w-4xl">
            A core mission of the DSS is to enable stakeholder engagement and
            co-creation by making analytical results accessible and
            understandable. Through participatory planning tools, the system
            supports collaborative decision-making for river rejuvenation,
            climate adaptation, and sustainable water resource management.
          </p>
        </section>
      </main>

      
    </div>
  );
};

export default DSSVisionMission;
