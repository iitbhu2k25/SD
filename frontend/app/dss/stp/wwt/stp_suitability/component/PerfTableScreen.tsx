'use client'

import { motion } from 'framer-motion'
import { ChevronLeft, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useSTPStore } from '@/store/useSTPStore'

export function PerfTableScreen() {
  const {
    systemType, cTech, dTech,
    updateCTech, updateDTech, resetTech,
    setScreen,
  } = useSTPStore()

  const isC = systemType === 'centralized'

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

          <div className="overflow-x-auto">
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
                          min={0}
                          max={10}
                          step={1}
                          onBlur={e => updateCTech(k, 'rel', parseFloat(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20 text-right text-xs"
                          defaultValue={t.ease}
                          min={0}
                          max={10}
                          step={1}
                          onBlur={e => updateCTech(k, 'ease', parseFloat(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20 text-right text-xs"
                          defaultValue={t.track}
                          min={0}
                          max={10}
                          step={1}
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
                          min={0}
                          max={10}
                          step={1}
                          onBlur={e => updateDTech(k, 'rel', parseFloat(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-20 text-right text-xs"
                          defaultValue={t.ease}
                          min={0}
                          max={10}
                          step={1}
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
            <Button variant="ghost" size="sm" onClick={resetTech}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
