'use client';

import { banner, primaryButton, sectionCard, sectionTitle } from '../shared/ui/styles';

export default function IntroductionTab({ onGetStarted }: { onGetStarted?: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className={`${sectionCard} p-6 sm:p-8`}>
        <h2 className="mb-6 text-lg font-semibold text-slate-900 sm:text-xl">
          Decision trade-offs of Sewage Management Strategies for Small River Rejuvenation
        </h2>

        <div className="flex flex-col gap-6">
          <div className={`${banner.info} !p-4 !text-sm leading-relaxed sm:!text-base`}>
            This simulation tool helps policymakers and planners explore <strong>sewage management
            strategies</strong> for small urban rivers. Using a <strong>System Dynamics</strong> model, it
            captures how infrastructure decisions, maintenance quality, and population growth interact to
            determine river health over time.
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-stone-50/65 p-5">
              <h4 className={`${sectionTitle} mb-4`}>How to use this tool</h4>
              <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-600 sm:text-base">
                <li><strong className="text-slate-800">Scenario Inputs</strong> - Set contextual parameters for your river system</li>
                <li><strong className="text-slate-800">Decisions</strong> - Choose sewage management strategies</li>
                <li><strong className="text-slate-800">Implementation Costs</strong> - Enter capital and O&amp;M costs</li>
                <li><strong className="text-slate-800">Run simulation</strong> - View results from 2025-2050</li>
                <li><strong className="text-slate-800">Compare</strong> - Analyse trade-offs across multiple scenarios</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50/65 p-5">
              <h4 className={`${sectionTitle} mb-4`}>Key concepts</h4>
              <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-slate-600 sm:text-base">
                <li><strong className="text-slate-800">STP</strong> - Sewage Treatment Plant (measured in MLD)</li>
                <li><strong className="text-slate-800">MLD</strong> - Million Litres per Day</li>
                <li><strong className="text-slate-800">O&amp;M</strong> - Operation &amp; Maintenance cost (INR Crores)</li>
                <li><strong className="text-slate-800">Tapped drain</strong> - Drain connected to treatment network</li>
                <li><strong className="text-slate-800">Untapped drain</strong> - Drain discharging directly to river</li>
                <li><strong className="text-slate-800">Capacity deficit</strong> - Gap between sewage load and STP capacity</li>
              </ul>
            </div>
          </div>

          <p className="text-sm italic leading-relaxed text-slate-500 sm:text-base">
            Default values are calibrated for Varuna catchment, Varanasi city (reference year 2025), based on
            field visits and literature review by the modelling team.
          </p>

          <div className="flex justify-center pt-4">
            <button type="button" className={`${primaryButton} !px-12 !py-4 !text-base sm:!text-lg`} onClick={onGetStarted}>
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
