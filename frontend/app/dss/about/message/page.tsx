import React from "react";

const PIsMessage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-800 to-teal-700 text-slate-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-800 to-teal-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <span className="inline-block text-sm uppercase tracking-wider text-blue-200 mb-3">
            Leadership Message
          </span>
          <h1 className="text-3xl md:text-4xl font-bold">
            Principal Investigators’ Message
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-blue-100">
            Leadership perspectives guiding the Decision Support System for Water
            Resource Management (DSS)
          </p>
        </div>
      </header>

      {/* Content */}
      <main className=" mx-auto px-6 py-16 space-y-20  ">
        {/* Prof. Anurag Ohri */}
        <section className="bg-white rounded-xl shadow-sm p-8 md:p-10 ">
          <div className="grid md:grid-cols-4 gap-8 ">
            {/* Image */}
            <div className="md:col-span-1 flex justify-center">
              <img
                src="/Images/about/Ohri_Sir_Message.jpg"
                alt="Prof. Anurag Ohri"
                className="w-100 h-100 object-cover rounded-xl shadow-md"
              />
            </div>

            {/* Message */}
            <div className="md:col-span-3">
              <h2 className="text-2xl font-semibold text-slate-900">
                Prof. Anurag Ohri
              </h2>
              <p className="text-slate-600 mb-6">
                Professor, Department of Civil Engineering <br />
                Indian Institute of Technology (BHU), Varanasi
              </p>

              <div className="space-y-4 text-slate-700 leading-relaxed">
                <p>
                  I warmly welcome you to the Decision Support System for Water
                  Resource Management (DSS) initiative, envisioned as a
                  comprehensive Small Rivers Management Tool (SRMT) for
                  strengthening holistic and sustainable water governance in
                  India.
                </p>

                <p>
                  As the Principal Investigator of this initiative, it is both an
                  honor and a responsibility to lead a multidisciplinary effort
                  aimed at addressing the growing complexities of water resource
                  planning, river basin management, and climate-driven
                  uncertainties. The DSS has been conceptualized as an
                  integrated, science-driven platform that brings together
                  hydrological and hydrogeological modeling, geospatial
                  technologies, remote sensing, system dynamics, optimization
                  techniques, and decision analytics.
                </p>

                <p>
                  This initiative places strong emphasis on integrating surface
                  water, groundwater, and socio-hydrological processes within a
                  unified framework, ensuring that water management decisions are
                  not only technically robust but also socially relevant and
                  environmentally sustainable. Special focus has been given to
                  small river basins, where data scarcity and governance
                  challenges demand innovative and scalable solutions.
                </p>

                <p>
                  A key objective of the DSS is to translate complex scientific
                  analyses into intuitive, user-friendly tools for policymakers,
                  planners, and implementing agencies. Through rigorous modeling
                  combined with interactive visualization and scenario-based
                  analysis, the system aims to reduce uncertainty and unintended
                  consequences.
                </p>

                <p>
                  I sincerely acknowledge the support of the National Mission for
                  Clean Ganga (NMCG), the India–Denmark partnership, and our
                  esteemed partner institutions and collaborators. I deeply
                  appreciate the dedication of the entire project team and look
                  forward to meaningful stakeholder engagement through the
                  successful implementation of the DSS.
                </p>

                <p className="mt-6 font-semibold text-slate-900">
                  Prof. Anurag Ohri
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Dr. Pramod Soni */}
        <section className="bg-white rounded-xl shadow-sm p-8 md:p-10">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Image */}
           <div className="md:col-span-1 flex justify-center">
              <img
                src="/Images/about/Soni_Sir_message.jpg"
                alt="Prof. Pramod Soni"
                className="w-100 h-100 object-cover rounded-xl shadow-md"
              />
            </div>

            {/* Message */}
            <div className="md:col-span-3">
              <h2 className="text-2xl font-semibold text-slate-900">
                Dr. Pramod Soni
              </h2>
              <p className="text-slate-600 mb-6">
                Assistant Professor, Department of Civil Engineering <br />
                Indian Institute of Technology (BHU), Varanasi
              </p>

              <div className="space-y-4 text-slate-700 leading-relaxed">
                <p>
                  I am pleased to welcome you to the Decision Support System for
                  Water Resource Management initiative, aimed at developing a
                  Small Rivers Management Tool (SRMT) for holistic and
                  sustainable water governance in India. It is a privilege to
                  serve as a Principal Investigator of this initiative.
                </p>

                <p>
                  The project integrates state-of-the-art hydrological modeling,
                  remote sensing, GIS, machine learning, and data-driven
                  analytics into a comprehensive decision-support framework.
                  Strong emphasis is placed on scientifically sound surface and
                  groundwater modeling, climate impact assessment, and
                  multi-source data integration.
                </p>

                <p>
                  Equal importance is given to translating complex scientific
                  outputs into intuitive and operationally relevant tools for
                  policymakers, planners, and implementing agencies, supporting
                  informed and adaptive decision-making.
                </p>

                <p>
                  I sincerely thank the National Mission for Clean Ganga (NMCG)
                  and the Royal Danish Embassy for their support and facilitation
                  of international cooperation. I also acknowledge our partner
                  institutions— IIT Delhi, IIT Madras, IIT Bombay, and Hokkaido
                  University — for their valuable contributions.
                </p>

                <p>
                  I extend my appreciation to all team members and collaborators
                  whose dedication continues to drive this project forward. We
                  look forward to meaningful stakeholder engagement and to
                  contributing toward resilient, science-based, and inclusive
                  water governance.
                </p>

                <p className="mt-6 font-semibold text-slate-900">
                  Dr. Pramod Soni
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-6 py-6 text-sm">
          © {new Date().getFullYear()} Decision Support System – PI’s Message
        </div>
      </footer>
    </div>
  );
};

export default PIsMessage;
