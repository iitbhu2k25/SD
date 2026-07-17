'use client';

import { useEffect, useState } from 'react';
import IntroductionTab from './IntroductionTab';
import ScenarioInputsTab from './ScenarioInputsTab';
import ScenarioResultsTab from './ScenarioResultsTab';
import ScenarioComparisonTab from './ScenarioComparisonTab';
import ResultManagerTab from './ResultManagerTab';
import InputInstructionsModal from './InputInstructionsModal';
// import AIAssistant from './AIAssistant'; // chatbot disabled for now
import { useVarunaSimStore } from '../shared/store/varunaSim.store';
import { listScenarios } from '../shared/services/varunaSim.service';
import { pillTabsWrapper } from '../shared/ui/styles';

const TABS = [
  { value: 'introduction', label: 'Introduction' },
  { value: 'inputs', label: '2. Scenario Inputs' },
  { value: 'results', label: '3. Scenario Results' },
  { value: 'compare', label: '4. Scenario Comparison' },
  { value: 'manager', label: '5. Result Manager' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

export default function VarunaSimDashboard() {
  const setScenarios = useVarunaSimStore((s) => s.setScenarios);
  const [active, setActive] = useState<TabValue>('introduction');
  const [showInstructions, setShowInstructions] = useState(false);

  const handleGetStarted = () => {
    setActive('inputs');
    setShowInstructions(true);
  };

  useEffect(() => {
    listScenarios()
      .then((res) => setScenarios(res.scenarios))
      .catch(() => {});
  }, [setScenarios]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#f7f9fb_0%,#f3f6f5_100%)]">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-[96rem]">
          <div className="mb-4 px-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Decision Trade-offs of Sewage Management Strategies</h1>
            <p className="mt-1 text-sm text-slate-500">
              Small River Rejuvenation - Varuna River, Varanasi | IIT BHU - IIT Bombay - IIT Delhi - IIT Madras 
            </p>
          </div>

          <div className={`${pillTabsWrapper} mx-auto mb-6 w-fit max-w-full flex-wrap justify-center gap-2 p-1.5`}>
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActive(tab.value)}
                className={
                  active === tab.value
                    ? 'rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-md transition-all duration-200 sm:px-6 sm:text-base'
                    : 'rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:scale-[1.03] hover:bg-white/70 hover:text-slate-800 sm:px-6 sm:text-base'
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {active === 'introduction' && <IntroductionTab onGetStarted={handleGetStarted} />}
          {active === 'inputs' && <ScenarioInputsTab />}
          {active === 'results' && <ScenarioResultsTab />}
          {active === 'compare' && <ScenarioComparisonTab />}
          {active === 'manager' && <ResultManagerTab />}
        </div>
      </div>

      {showInstructions && <InputInstructionsModal onClose={() => setShowInstructions(false)} />}

      {/* <AIAssistant /> chatbot disabled for now */}
    </div>
  );
}
