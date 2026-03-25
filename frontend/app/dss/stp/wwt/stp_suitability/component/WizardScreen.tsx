'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSTPStore } from '@/store/useSTPStore'
import { WIZARD_STEPS } from '@/interface/stp_suitability/data'
import { resolveRoute, getStepSequence } from './Scoring'
import type { Answer, StepId } from '@/interface/stp_suitability/stp'

export function WizardScreen() {
  const { answers, pushAnswer, popAnswer, setSystemType, setScreen } = useSTPStore()

  const seq       = getStepSequence(answers)
  const nextStepId = seq[answers.length]
  const step       = WIZARD_STEPS.find(s => s.id === nextStepId)

  // All answers collected — check route
  if (!step) {
    const route = resolveRoute(answers)
    if (!route) return <p className="text-muted-foreground text-sm">Unable to determine route. Please restart.</p>

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
              Classification Complete
            </p>
            <h2 className="text-xl font-semibold">System type determined</h2>

            {route.type === 'community' ? (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Community / Onsite Solution Required</p>
                  <p className="mt-1 text-amber-700">{route.msg}</p>
                  <p className="mt-2">This scenario requires Community Toilet, Ecosan, or DEWATS + Twin Drains. Technology DSS scoring is not applicable here.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  <span className="font-medium text-emerald-800">
                    {route.type === 'centralized' ? 'Centralised STP' : 'Decentralised System'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{route.msg}</p>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => {
                      setSystemType(route.type)
                      setScreen('inputs')
                    }}
                  >
                    Continue to Parameters →
                  </Button>
                  <Button variant="outline" onClick={() => { useSTPStore.getState().resetAll() }}>
                    Restart
                  </Button>
                </div>
              </>
            )}

            {route.type === 'community' && (
              <Button variant="outline" onClick={() => useSTPStore.getState().resetAll()}>
                ← Start Over
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  const handleSelect = (opt: { label: string; icon: string; val: string }) => {
    pushAnswer({ id: step.id as StepId, val: opt.val, label: opt.label })
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
      >
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-1">
                {step.label}
              </p>
              <h2 className="text-lg font-semibold leading-snug">{step.question}</h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {step.opts.map(opt => (
                <button
                  key={opt.val}
                  onClick={() => handleSelect(opt)}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3.5 text-left text-sm font-medium transition-all hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-border text-sm transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                    {opt.icon}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>

            {answers.length > 0 && (
              <div className="pt-1">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={popAnswer}>
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
