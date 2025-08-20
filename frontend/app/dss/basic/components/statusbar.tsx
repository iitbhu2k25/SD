'use client'

import { useMemo } from 'react'
import { CheckCircle, CircleDot, Circle, ChevronRight, ArrowLeft } from 'lucide-react'

interface Step {
  id: string
  name: string
  status: 'completed' | 'current' | 'upcoming' | 'skipped'
}

interface StatusBarProps {
  currentStep: number
  onStepChange?: (stepIndex: number) => void
  skippedSteps?: number[]
  completedSteps?: number[]
  viewMode: 'admin' | 'drain'
}

export default function StatusBar({
  currentStep,
  onStepChange,
  skippedSteps = [],
  completedSteps = [],
  viewMode,
}: StatusBarProps) {
  const baseSteps = useMemo(
    () => [
      { id: 'population', name: 'Population Forecasting' },
      { id: 'demand', name: 'Water Demand' },
      { id: 'supply', name: 'Water Supply' },
      { id: 'quality', name: 'Sewage Generation' },
    ],
    []
  )

  const firstStep = useMemo(() => ({ id: 'area', name: 'Area Selection' }), [])

  const steps = useMemo(() => {
    const allSteps = [firstStep, ...baseSteps]
    return allSteps.map((step, i) => ({
      ...step,
      status: completedSteps.includes(i)
        ? 'completed'
        : skippedSteps.includes(i)
        ? 'skipped'
        : i === currentStep
        ? 'current'
        : 'upcoming',
    }))
  }, [currentStep, skippedSteps, completedSteps, baseSteps, firstStep])

  const handleStepClick = (index: number) => {
    if (index < currentStep && onStepChange) onStepChange(index)
  }

  return (
    <div className="w-full bg-white border-b border-gray-200 shadow-sm">
      <nav aria-label="Progress" className="py-2 w-full px-4">
        <ol className="flex flex-row justify-center space-x-6 relative">
          {steps.map((step, idx) => (
            <li
              key={step.id}
              className={`relative flex-shrink-0 ${
                idx < currentStep ? 'cursor-pointer group' : ''
              }`}
              onClick={() => handleStepClick(idx)}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center">
                  {/* Step Icon */}
                  <div className="relative">
                    {step.status === 'completed' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : step.status === 'skipped' ? (
                      <CheckCircle className="h-4 w-4 text-yellow-500" />
                    ) : step.status === 'current' ? (
                      <CircleDot className="h-4 w-4 text-blue-600 animate-pulse" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-300" />
                    )}
                    
                    {idx < currentStep && (
                      <ArrowLeft
                        className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-600 transition-opacity duration-200"
                        size={16}
                      />
                    )}
                  </div>

                  {/* Connector Line */}
                  {idx < steps.length - 1 && (
                    <div className="ml-4 flex items-center">
                      <div
                        className={`h-0.5 w-12 transition-colors duration-300 ${
                          step.status === 'completed'
                            ? 'bg-green-400'
                            : step.status === 'skipped'
                            ? 'bg-yellow-400'
                            : 'bg-gray-200'
                        }`}
                      />
                      {(step.status === 'completed' || step.status === 'skipped') && (
                        <ChevronRight
                          className={`ml-1 ${
                            step.status === 'completed' ? 'text-green-500' : 'text-yellow-500'
                          }`}
                          size={20}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Step Label */}
                <div className="text-center">
                  <div
                    className={`text-sm font-medium ${
                      step.status === 'completed'
                        ? 'text-green-600'
                        : step.status === 'skipped'
                        ? 'text-yellow-600'
                        : step.status === 'current'
                        ? 'text-blue-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.name}
                  </div>
                  
                  {idx < currentStep && (
                    <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      Click to return
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  )
}