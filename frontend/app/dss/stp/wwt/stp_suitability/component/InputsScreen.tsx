'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronDown, ChevronUp, Info, RotateCcw, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useSTPStore } from '@/store/useSTPStore'
import { cn } from '@/lib/utils'

export function InputsScreen() {
  const {
    systemType, Q, Ce, AL,
    setParams, setScreen,
    cTech, dTech, updateCTech, updateDTech, resetTech,
  } = useSTPStore()

  const isC = systemType === 'centralized'
  const [showAdvanced, setShowAdvanced] = useState(false)
  const localQ = String(Q)
  const [localCe, setLocalCe] = useState(String(Ce))
  const [localAL, setLocalAL] = useState(String(AL))

  const handleCalculate = () => {
    setParams({
      Q: parseFloat(localQ) || 5,
      Ce: parseFloat(localCe) || 8,
      AL: parseFloat(localAL) || 2,
    })
    setScreen('perf_table')
  }

  const techs = isC ? cTech : dTech
  const updater = isC ? updateCTech : updateDTech
  const fields = isC
    ? ['land', 'cap', 'om']
    : ['land', 'cap', 'om', 'energy']
  const fieldLabels: Record<string, string> = {
    land: 'Land (ha/MLD)',
    cap: 'Capital (₹Cr/MLD)',
    om: 'O&M (₹/m³)',
    energy: 'Energy (kWh/m³)',
  }

  const metrics = [
    { label: 'Capacity (Q)', value: localQ, unit: 'MLD' },
    { label: 'Electricity', value: localCe, unit: '₹/kWh' },
    { label: 'Land (AL)', value: localAL, unit: 'ha' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Project Parameters</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure inputs to compute technology rankings
          </p>
        </div>

        {/* System type pill */}
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium border shrink-0',
            isC
              ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800'
              : 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800'
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isC ? 'bg-blue-500' : 'bg-teal-500'
            )}
          />
          {isC ? 'Centralised STP' : 'Decentralised System'}
        </div>
      </div>

      {/* ── Live Metric Preview ── */}
      <div className="grid grid-cols-3 gap-3">
        {metrics.map(({ label, value, unit }) => {
          const num = parseFloat(value)
          return (
            <div
              key={label}
              className="rounded-lg bg-muted/50 px-3 py-2.5"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                {label}
              </p>
              <p className="text-xl font-semibold leading-none">
                {isNaN(num) ? '—' : num.toFixed(1)}
                <span className="text-xs font-normal text-muted-foreground ml-1">{unit}</span>
              </p>
            </div>
          )
        })}
      </div>

      {/* ── Main Inputs Card ── */}
      <Card>
        <CardContent className="pt-5 space-y-5">

          {/* Info strip */}
          <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Fill in your project details to compute technology scores and rankings.</span>
          </div>

          {/* Q + Ce side by side */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inputQ" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                STP Capacity (Q)
                <span className="ml-2 normal-case font-normal text-[10px] text-muted-foreground/60">Set in STP Area finder</span>
              </Label>
              <div className="relative">
                <Input
                  id="inputQ"
                  type="number"
                  value={localQ}
                  readOnly
                  className="pr-14 font-medium text-base bg-muted cursor-not-allowed"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  MLD
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inputCe" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Electricity Tariff (Ce)
              </Label>
              <div className="relative">
                <Input
                  id="inputCe"
                  type="number"
                  min="1"
                  step="0.5"
                  value={localCe}
                  onChange={e => setLocalCe(e.target.value)}
                  className="pr-16 font-medium text-base"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  ₹/kWh
                </span>
              </div>
            </div>
          </div>

          {/* AL alone, half-width */}
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="inputAL" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Available Land (AL)
            </Label>
            <div className="relative">
              <Input
                id="inputAL"
                type="number"
                min="0.01"
                step="0.1"
                value={localAL}
                onChange={e => setLocalAL(e.target.value)}
                className="pr-10 font-medium text-base"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                ha
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Advanced: Cost Factors ── */}
      <div className="rounded-lg border overflow-hidden">
        {/* Toggle header */}
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors text-left"
        >
          <span>Advanced: edit technology cost factors</span>
          {showAdvanced
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </button>

        {/* Collapsible table */}
        {showAdvanced && (
          <div className="border-t">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs uppercase tracking-wide font-medium w-40">
                      Technology
                    </TableHead>
                    {fields.map(f => (
                      <TableHead key={f} className="text-xs uppercase tracking-wide font-medium">
                        {fieldLabels[f]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(techs).map(([k, t]) => (
                    <TableRow key={k} className="hover:bg-muted/20">
                      <TableCell className="text-sm font-medium">{t.name}</TableCell>
                      {fields.map(f => (
                        <TableCell key={f}>
                          <Input
                            type="number"
                            className="h-8 w-24 text-right text-xs font-mono"
                            defaultValue={(t as Record<string, unknown>)[f] as number}
                            step="0.01"
                            min="0"
                            onBlur={e => updater(k, f, parseFloat(e.target.value))}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Table footer */}
            <div className="flex justify-end px-4 py-2.5 border-t bg-muted/20">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetTech}
                className="text-xs text-muted-foreground gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to defaults
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          onClick={handleCalculate}
          className={cn(
            'gap-2 font-medium',
            isC
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-teal-600 hover:bg-teal-700 text-white'
          )}
        >
          <Calculator className="h-4 w-4" />
          Calculate Rankings
        </Button>

        <Button
          variant="outline"
          onClick={() => setScreen('wizard')}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    </motion.div>
  )
}