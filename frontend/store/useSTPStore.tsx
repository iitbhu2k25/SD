'use client'

import { create } from 'zustand'
import type {
  Answer,
  Screen,
  SystemType,
  ProjectParams,
  CentralizedTechMap,
  DecentralizedTechMap,
} from '@/interface/stp_suitability/stp'
import { CENTRALIZED_TECH, DECENTRALIZED_TECH } from '@/interface/stp_suitability/data'

interface STPStore extends ProjectParams {
  // Navigation
  screen: Screen
  setScreen: (s: Screen) => void

  // Wizard
  answers: Answer[]
  pushAnswer: (a: Answer) => void
  popAnswer: () => void
  resetAnswers: () => void

  // System type resolved from wizard
  systemType: SystemType | null
  setSystemType: (t: SystemType) => void

  // Project params
  setParams: (p: Partial<ProjectParams>) => void

  // Editable tech tables (deep copies so user can tweak)
  cTech: CentralizedTechMap
  dTech: DecentralizedTechMap
  updateCTech: (key: string, field: string, value: number) => void
  updateDTech: (key: string, field: string, value: number) => void
  resetTech: () => void

  // Full reset
  resetAll: () => void
}

const DEFAULT_PARAMS: ProjectParams = { Q: 5, Ce: 8, AL: 2 }

export const useSTPStore = create<STPStore>((set) => ({
  screen: 'wizard',
  setScreen: (screen) => set({ screen }),

  answers: [],
  pushAnswer: (a) => set(s => ({ answers: [...s.answers, a] })),
  popAnswer:  ()  => set(s => ({ answers: s.answers.slice(0, -1) })),
  resetAnswers: () => set({ answers: [] }),

  systemType: null,
  setSystemType: (systemType) => set({ systemType }),

  ...DEFAULT_PARAMS,
  setParams: (p) => set(p),

  cTech: structuredClone(CENTRALIZED_TECH),
  dTech: structuredClone(DECENTRALIZED_TECH),

  updateCTech: (key, field, value) =>
    set(s => ({
      cTech: {
        ...s.cTech,
        [key]: { ...s.cTech[key as keyof typeof s.cTech], [field]: value },
      },
    })),

  updateDTech: (key, field, value) =>
    set(s => ({
      dTech: {
        ...s.dTech,
        [key]: { ...s.dTech[key as keyof typeof s.dTech], [field]: value },
      },
    })),

  resetTech: () =>
    set({
      cTech: structuredClone(CENTRALIZED_TECH),
      dTech: structuredClone(DECENTRALIZED_TECH),
    }),

  resetAll: () =>
    set({
      screen: 'wizard',
      answers: [],
      systemType: null,
      ...DEFAULT_PARAMS,
      cTech: structuredClone(CENTRALIZED_TECH),
      dTech: structuredClone(DECENTRALIZED_TECH),
    }),
}))