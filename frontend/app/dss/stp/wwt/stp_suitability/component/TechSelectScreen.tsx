'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSTPStore } from '@/store/useSTPStore'
import { CENTRALIZED_TECH, DECENTRALIZED_TECH } from '@/interface/stp_suitability/data'
import { cn } from '@/lib/utils'

const C_TECH_LIST = Object.entries(CENTRALIZED_TECH).map(([key, t]) => ({ key, name: t.name }))
const D_TECH_LIST = Object.entries(DECENTRALIZED_TECH).map(([key, t]) => ({ key, name: t.name }))

export function TechSelectScreen() {
  const {
    systemType,
    selectedCTechs, selectedDTechs,
    setSelectedCTechs, setSelectedDTechs,
    setScreen,
  } = useSTPStore()

  const isC = systemType === 'centralized'
  const techList = isC ? C_TECH_LIST : D_TECH_LIST
  const selected = isC ? selectedCTechs : selectedDTechs
  const setSelected = isC ? setSelectedCTechs : setSelectedDTechs

  const [local, setLocal] = useState<string[]>(
    selected.length > 0 ? selected : techList.map(t => t.key)
  )

  const toggle = (key: string) => {
    setLocal(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleContinue = () => {
    const finalSelection = local.length > 0 ? local : techList.map(t => t.key)
    setSelected(finalSelection)
    setScreen('inputs')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
                Technology Selection
              </p>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  isC
                    ? 'border-blue-200 text-blue-700 bg-blue-50'
                    : 'border-teal-200 text-teal-700 bg-teal-50'
                )}
              >
                {isC ? 'Centralised STP' : 'Decentralised System'}
              </Badge>
            </div>
            <h2 className="text-lg font-semibold leading-snug">
              Select technologies to compare
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose one or more technologies to include in the ranking. All are selected by default.
            </p>
          </div>

          {/* Tech cards */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {techList.map(({ key, name }) => {
              const checked = local.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-4 py-3.5 text-left text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                    checked
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-border bg-muted/40 text-muted-foreground hover:border-emerald-400 hover:bg-emerald-50/50'
                  )}
                >
                  {/* Checkbox indicator */}
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs transition-colors',
                      checked
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-muted-foreground/40 bg-background'
                    )}
                  >
                    {checked && '✓'}
                  </span>

                  <span className="flex-1 leading-tight">{name}</span>

                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      checked
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {key}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Selection count */}
          <p className="text-xs text-muted-foreground">
            {local.length} of {techList.length} technologies selected
            {local.length === 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                — all will be included if none are selected
              </span>
            )}
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              onClick={handleContinue}
              className={cn(
                'gap-2 font-medium',
                isC
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
              )}
            >
              Continue to Parameters
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              onClick={() => setScreen('wizard')}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setLocal(techList.map(t => t.key))}
            >
              Select all
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
