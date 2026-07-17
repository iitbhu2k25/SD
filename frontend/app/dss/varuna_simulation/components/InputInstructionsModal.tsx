'use client';

import { primaryButton, sectionTitle } from '../shared/ui/styles';

export default function InputInstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.25)] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Input Instructions</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-stone-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          To explore different strategies, define your inputs across three steps:
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <h4 className={`${sectionTitle} mb-1.5`}>2.1 Contextual Parameters</h4>
            <p className="text-sm leading-relaxed text-slate-600">
              Variables that initialise the model for the Varuna river system in the reference year -
              population, sewage generation, current conveyance distribution, and existing treatment /
              pumping infrastructure. These describe the present state of sewage management.
            </p>
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Tip: Keep the default values if unsure, and focus on testing different decisions to see how
              outcomes change. Defaults are pre-filled, but review them before running a scenario.
            </div>
          </div>

          <div>
            <h4 className={`${sectionTitle} mb-1.5`}>2.2 Decisions</h4>
            <p className="text-sm leading-relaxed text-slate-600">
              Choose the interventions you want to test - increasing treatment capacity, augmenting the
              conveyance network, or improving maintenance quality. These represent the strategies you are
              evaluating.
            </p>
          </div>

          <div>
            <h4 className={`${sectionTitle} mb-1.5`}>2.3 Implementation Costs</h4>
            <p className="text-sm leading-relaxed text-slate-600">
              Specify the costs associated with your decisions, including infrastructure investment and
              operational expenses, then save the scenario to run the simulation and compare trade-offs.
            </p>
          </div>

          <p className="text-xs italic text-slate-500">
            More details about each input are provided within their respective sections.
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" className={primaryButton} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
