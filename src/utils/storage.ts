import type { Programacion, ProgramacionWithData } from '../types'

const IDX_KEY = 'trp_idx'
const DAY_PREFIX = 'trp_day_'
const AREAS_PREFIX = 'trp_areas_'
const DATA_PREFIX = 'trp_data_'
const REMEMBER_KEY = 'trp_remember'

// ── Programaciones ──────────────────────────────────────────────
export const getIdx = (): Programacion[] => {
  try { return JSON.parse(localStorage.getItem(IDX_KEY) || '[]') }
  catch { return [] }
}

export const saveIdx = (idx: Programacion[]) =>
  localStorage.setItem(IDX_KEY, JSON.stringify(idx))

export const getProgramData = (key: string): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(`${DATA_PREFIX}${key}`) || '{}') }
  catch { return {} }
}

export const saveProgramData = (key: string, data: Record<string, number>) =>
  localStorage.setItem(`${DATA_PREFIX}${key}`, JSON.stringify(data))

export const deleteProgramData = (key: string) =>
  localStorage.removeItem(`${DATA_PREFIX}${key}`)

export const getAllProgs = (): ProgramacionWithData[] =>
  getIdx().map(m => ({ ...m, data: getProgramData(m.key) }))

export const makeKey = (user: string, tipo: string, hor: string, area: string) =>
  `${user}_${tipo}_${encodeURIComponent(hor)}_${encodeURIComponent(area)}`

export const upsertProg = (meta: Programacion, data: Record<string, number>, oldKey?: string) => {
  saveProgramData(meta.key, data)
  let idx = getIdx()
  if (oldKey && oldKey !== meta.key) {
    idx = idx.filter(x => x.key !== oldKey)
    deleteProgramData(oldKey)
  }
  const ei = idx.findIndex(x => x.key === meta.key)
  if (ei >= 0) idx[ei] = meta
  else idx.unshift(meta)
  saveIdx(idx)
}

// ── Día ─────────────────────────────────────────────────────────
export const getDayKey = (date: string) => `${DAY_PREFIX}${date}`
export const isDiaCerrado = (date: string) => localStorage.getItem(getDayKey(date)) === 'cerrado'
export const setDiaEstado = (date: string, estado: 'cerrado' | 'abierto') =>
  localStorage.setItem(getDayKey(date), estado)

// ── Áreas por usuario ────────────────────────────────────────────
export const getUserAreas = (user: string): string[] | null => {
  try {
    const r = localStorage.getItem(`${AREAS_PREFIX}${user}`)
    return r ? JSON.parse(r) : null
  } catch { return null }
}

export const saveUserAreas = (user: string, areas: string[]) =>
  localStorage.setItem(`${AREAS_PREFIX}${user}`, JSON.stringify(areas))

// ── Remember ──────────────────────────────────────────────────────
export const getRemember = () => localStorage.getItem(REMEMBER_KEY)
export const setRemember = (user: string) => localStorage.setItem(REMEMBER_KEY, user)
export const clearRemember = () => localStorage.removeItem(REMEMBER_KEY)
