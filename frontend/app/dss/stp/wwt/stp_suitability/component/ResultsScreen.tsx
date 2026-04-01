'use client'

import { motion } from 'framer-motion'
import { ChevronLeft, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { useSTPStore } from '@/store/useSTPStore'
import { scoreCentralized, scoreDecentralized } from './Scoring'
import { ScoreChart } from './ScoreChart'
import type { CentralizedResult, DecentralizedResult } from '@/interface/stp_suitability/stp'

export function ResultsScreen() {
  const { systemType, Q, Ce, AL, cTech, dTech, setScreen, resetAll } = useSTPStore()
  const isC = systemType === 'centralized'

  const ranked = isC
    ? scoreCentralized(Q, cTech)
    : scoreDecentralized(Q, dTech)

  const best = ranked[0]
  const bestTech = isC ? cTech[best.key as keyof typeof cTech] : dTech[best.key as keyof typeof dTech]
  const maxScore = ranked[0].total

  const landHA   = (Q * bestTech.land).toFixed(2)
  const capCr    = (Q * bestTech.cap).toFixed(1)
  const omAnnual = (Q * 1000 * bestTech.om * 365 / 1e7).toFixed(2)
  const landFeasible = parseFloat(landHA) <= AL

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Recommendation banner */}
      <Card className="overflow-hidden">
        <div className="bg-emerald-700 px-6 py-5 text-white">
          <Badge className="mb-2 bg-white/20 text-white hover:bg-white/20">#1 Recommendation</Badge>
          <h2 className="text-xl font-semibold">{best.name}</h2>
          <p className="mt-1 text-sm text-emerald-100">
            {isC ? 'Centralised STP' : 'Decentralised System'} — Score: {best.total.toFixed(1)} / 100
          </p>
        </div>
        <CardContent className="pt-5 space-y-4">
          {/* Metric cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Land Required', val: `${landHA} ha` },
              { label: 'Capital Cost',  val: `₹${capCr} Cr` },
              { label: 'Annual O&M',    val: `₹${omAnnual} Cr/yr` },
            ].map(m => (
              <div key={m.label} className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
                <p className="mt-1 text-lg font-semibold">{m.val}</p>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Q = {Q} MLD</Badge>
            <Badge variant="outline">Tariff = ₹{Ce}/kWh</Badge>
            <Badge variant="outline">Available land = {AL} ha</Badge>
            {landFeasible ? (
              <Badge className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                <CheckCircle2 className="h-3 w-3" /> Land feasible
              </Badge>
            ) : (
              <Badge className="gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                <AlertTriangle className="h-3 w-3" /> Exceeds available land
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Ranking / Chart / Details */}
      <Card>
        <CardContent className="pt-5">
          <Tabs defaultValue="ranking">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="ranking" className="flex-1">Technology Ranking</TabsTrigger>
              <TabsTrigger value="chart"   className="flex-1">Score Chart</TabsTrigger>
              <TabsTrigger value="details" className="flex-1">Cost Details</TabsTrigger>
            </TabsList>

            {/* Ranking tab */}
            <TabsContent value="ranking">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Rank</TableHead>
                    <TableHead>Technology</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((r, i) => (
                    <TableRow key={r.key} className={i === 0 ? 'bg-emerald-50/60' : ''}>
                      <TableCell>
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                          i === 0 ? 'bg-amber-400 text-amber-900' : 'bg-muted text-muted-foreground'
                        }`}>
                          {i + 1}
                        </span>
                      </TableCell>
                      <TableCell className={i === 0 ? 'font-medium' : ''}>{r.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(r.total / maxScore) * 100}
                            className="h-1.5 w-24"
                          />
                          <span className="text-sm font-medium tabular-nums">{r.total.toFixed(1)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Chart tab */}
            <TabsContent value="chart">
              <ScoreChart ranked={ranked} />
            </TabsContent>

            {/* Details tab */}
            <TabsContent value="details">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technology</TableHead>
                      <TableHead className="text-right">Land (ha)</TableHead>
                      <TableHead className="text-right">Capital (₹ Cr)</TableHead>
                      <TableHead className="text-right">O&M (₹ Cr/yr)</TableHead>
                      {!isC && <TableHead className="text-right">Energy (kWh/d)</TableHead>}
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranked.map((r, i) => {
                      const dr = r as DecentralizedResult
                      return (
                        <TableRow key={r.key} className={i === 0 ? 'bg-emerald-50/60' : ''}>
                          <TableCell className={i === 0 ? 'font-medium' : ''}>{r.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.land.toFixed(2)}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.cap.toFixed(1)}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.om.toFixed(2)}</TableCell>
                          {!isC && (
                            <TableCell className="text-right tabular-nums">
                              {dr.energy?.toFixed(0)}
                            </TableCell>
                          )}
                          <TableCell className="text-right font-semibold tabular-nums">
                            {r.total.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between pt-1">
        <Button variant="outline" onClick={() => setScreen('inputs')}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Edit Parameters
        </Button>
        <Button onClick={resetAll}>
          <RefreshCw className="mr-1 h-4 w-4" /> New Analysis
        </Button>
      </div>
    </motion.div>
  )
}
