'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useSTPStore } from '@/store/useSTPStore'
import {
  BOD_SCORES, COD_SCORES, COLIFORM_SCORES,
  getBODIndex, getCODIndex, getColiformIndex,
} from '@/interface/stp_suitability/data'

export function PerfTableScreen() {
  const {
    systemType, cTech, dTech,
    BOD, COD, Coliform,
    updateCTech, updateDTech, resetTech,
    setScreen,
  } = useSTPStore()

  const isC = systemType === 'centralized'

  // Incrementing this key forces the editable tables to remount, resetting
  // uncontrolled <Input defaultValue> fields back to their current store values.
  const [resetKey, setResetKey] = useState(0)
  const [showCompatibility, setShowCompatibility] = useState(false)

  const handleReset = () => {
    resetTech()
    setResetKey(k => k + 1)
  }

  // Pre-compute sewage characteristic scores for centralized techs
  const bodIdx      = getBODIndex(BOD)
  const codIdx      = getCODIndex(COD)
  const coliformIdx = getColiformIndex(Coliform)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* ── Editable Performance Scores ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Performance Scores</CardTitle>
            <Badge variant="secondary">
              {isC ? 'Centralised STP' : 'Decentralised System'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Review and adjust the fixed performance scores (0–10) before calculating rankings.
              These values reflect reliability, operational ease
              {isC ? ', and track record' : ''} for each technology.
            </span>
          </div>

          <div key={resetKey} className="overflow-x-auto">
            {isC ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technology</TableHead>
                    <TableHead>Reliability (0–10)</TableHead>
                    <TableHead>O&M Ease (0–10)</TableHead>
                    <TableHead>Track Record (0–10)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(cTech).map(([k, t]) => (
                    <TableRow key={k}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20 text-right text-xs"
                          defaultValue={t.rel}
                          min={0} max={10} step={1}
                          onBlur={e => updateCTech(k, 'rel', parseFloat(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20 text-right text-xs"
                          defaultValue={t.ease}
                          min={0} max={10} step={1}
                          onBlur={e => updateCTech(k, 'ease', parseFloat(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20 text-right text-xs"
                          defaultValue={t.track}
                          min={0} max={10} step={1}
                          onBlur={e => updateCTech(k, 'track', parseFloat(e.target.value))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technology</TableHead>
                    <TableHead>Reliability (0–10)</TableHead>
                    <TableHead>Ease of Operation (0–10)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(dTech).map(([k, t]) => (
                    <TableRow key={k}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20 text-right text-xs"
                          defaultValue={t.rel}
                          min={0} max={10} step={1}
                          onBlur={e => updateDTech(k, 'rel', parseFloat(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20 text-right text-xs"
                          defaultValue={t.ease}
                          min={0} max={10} step={1}
                          onBlur={e => updateDTech(k, 'ease', parseFloat(e.target.value))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => setScreen('results')}>
              Calculate Rankings →
            </Button>
            <Button variant="outline" onClick={() => setScreen('inputs')}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Sewage Characteristics Scores ── */}
      <Card>
        <CardHeader className="pb-0 pt-4 px-6">
          <button
            type="button"
            onClick={() => setShowCompatibility(v => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <CardTitle className="text-base">Sewage Characteristics Compatibility</CardTitle>
            {showCompatibility
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </button>
        </CardHeader>

        {showCompatibility && (
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Scores computed from your inputs — BOD: <strong>{BOD} mg/L</strong>,
                COD: <strong>{COD} mg/L</strong>,
                Coliform: <strong>{Coliform.toLocaleString()} MPN/100mL</strong>.
                Compatibility = average of the three scores.
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Technology</TableHead>
                    <TableHead className="text-center">BOD Score</TableHead>
                    <TableHead className="text-center">COD Score</TableHead>
                    <TableHead className="text-center">Coliform Score</TableHead>
                    <TableHead className="text-center font-semibold">Compatibility</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(isC ? cTech : dTech).map(([k, t]) => {
                    const bodScore      = (BOD_SCORES[k]      ?? [5, 5, 5, 5])[bodIdx]
                    const codScore      = (COD_SCORES[k]      ?? [5, 5, 5, 5])[codIdx]
                    const colScore      = (COLIFORM_SCORES[k] ?? [5, 5, 5, 5])[coliformIdx]
                    const compatibility = ((bodScore + codScore + colScore) / 3).toFixed(1)
                    return (
                      <TableRow key={k}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-center tabular-nums">{bodScore}</TableCell>
                        <TableCell className="text-center tabular-nums">{codScore}</TableCell>
                        <TableCell className="text-center tabular-nums">{colScore}</TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-800 tabular-nums">
                            {compatibility}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  )
}
