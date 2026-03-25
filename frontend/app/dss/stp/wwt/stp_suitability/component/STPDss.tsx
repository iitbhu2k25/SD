'use client'

import { useSTPStore } from '@/store/useSTPStore'
import { StepProgress } from './StepProgress'
import { WizardScreen }  from './WizardScreen'
import { InputsScreen }  from './InputsScreen'
import { ResultsScreen } from './ResultsScreen'

interface STPDssProps {
  /**
   * embedded={true}  — strip the outer padding/max-w wrapper and header.
   * Use this when dropping into an existing panel (e.g. your SuitabilityAdmin left panel).
   * embedded={false} (default) — standalone page with header.
   */
  embedded?: boolean
}

export function STPDss({ embedded = false }: STPDssProps) {
  const screen = useSTPStore(s => s.screen)

  const content = (
    <>
      {!embedded && (
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white font-bold text-base">
            STP
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">STP Technology DSS</h1>
            <p className="text-sm text-muted-foreground">
              Decision Support System for Sewage Treatment Plant Technology Selection
            </p>
          </div>
        </div>
      )}

      <StepProgress />

      {screen === 'wizard'  && <WizardScreen />}
      {screen === 'inputs'  && <InputsScreen />}
      {screen === 'results' && <ResultsScreen />}
    </>
  )

  if (embedded) {
    // No outer wrapper — caller owns the container
    return content
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {content}
    </div>
  )
}