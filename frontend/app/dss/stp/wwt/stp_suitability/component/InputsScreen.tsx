'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useSTPStore } from '@/store/useSTPStore'

export function InputsScreen() {
  const {
    systemType, Q, Ce, AL,
    setParams, setScreen,
    cTech, dTech, updateCTech, updateDTech, resetTech,
  } = useSTPStore()

  const isC = systemType === 'centralized'
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [localQ,  setLocalQ]  = useState(String(Q))
  const [localCe, setLocalCe] = useState(String(Ce))
  const [localAL, setLocalAL] = useState(String(AL))

  const handleCalculate = () => {
    setParams({
      Q:  parseFloat(localQ)  || 5,
      Ce: parseFloat(localCe) || 8,
      AL: parseFloat(localAL) || 2,
    })
    setScreen('results')
  }

  const techs    = isC ? cTech  : dTech
  const updater  = isC ? updateCTech : updateDTech
  const fields   = isC
    ? ['land', 'cap', 'om']
    : ['land', 'cap', 'om', 'energy']
  const fieldLabels: Record<string, string> = {
    land:   'Land (ha/MLD)',
    cap:    'Capital (₹Cr/MLD)',
    om:     'O&M (₹/m³)',
    energy: 'Energy (kWh/m³)',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Project Parameters</CardTitle>
            <Badge variant="secondary">
              {isC ? 'Centralised STP' : 'Decentralised System'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Info banner */}
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Fill in your project details to compute technology scores and rankings.</span>
          </div>

          {/* Main inputs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inputQ">STP Capacity (Q) — MLD</Label>
              <Input
                id="inputQ"
                type="number"
                min="0.1"
                step="0.5"
                value={localQ}
                onChange={e => setLocalQ(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inputCe">Electricity Tariff (Ce) — ₹/kWh</Label>
              <Input
                id="inputCe"
                type="number"
                min="1"
                step="0.5"
                value={localCe}
                onChange={e => setLocalCe(e.target.value)}
              />
            </div>
          </div>

          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="inputAL">Available Land (AL) — ha</Label>
            <Input
              id="inputAL"
              type="number"
              min="0.01"
              step="0.1"
              value={localAL}
              onChange={e => setLocalAL(e.target.value)}
            />
          </div>

          {/* Advanced: editable factor table */}
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-blue-700 hover:bg-muted/40 transition-colors"
              onClick={() => setShowAdvanced(v => !v)}
            >
              <span>Advanced: Edit technology cost factors</span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="border-t px-4 py-4 space-y-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Technology</TableHead>
                        {fields.map(f => (
                          <TableHead key={f}>{fieldLabels[f]}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(techs).map(([k, t]) => (
                        <TableRow key={k}>
                          <TableCell className="text-sm font-medium">{t.name}</TableCell>
                          {fields.map(f => (
                            <TableCell key={f}>
                              <Input
                                type="number"
                                className="h-8 w-24 text-right text-xs"
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
                <Button variant="outline" size="sm" onClick={resetTech}>
                  Reset to Defaults
                </Button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={handleCalculate}>Calculate Rankings →</Button>
            <Button variant="outline" onClick={() => setScreen('wizard')}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
