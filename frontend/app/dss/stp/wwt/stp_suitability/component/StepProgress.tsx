'use client'

import { useSTPStore } from '@/store/useSTPStore'
import type { Screen } from '@/interface/stp_suitability/stp'

const STEPS: { id: Screen; label: string }[] = [
  { id: 'wizard',  label: 'System Classification' },
  { id: 'inputs',  label: 'Project Parameters' },
  { id: 'results', label: 'Technology Ranking' },
]

const PROGRESS: Record<Screen, number> = {
  wizard:  33,
  inputs:  66,
  results: 100,
}

export function StepProgress() {
  const screen = useSTPStore(s => s.screen)

  return (
    <div className="mb-6">
      {/* Step breadcrumb */}
      <div className="flex flex-wrap gap-2 mb-3">
        {STEPS.map(step => (
          <span
            key={step.id}
            className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
              step.id === screen
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-border bg-background text-muted-foreground'
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-emerald-600 transition-all duration-500"
          style={{ width: `${PROGRESS[screen]}%` }}
        />
      </div>
    </div>
  )
}
