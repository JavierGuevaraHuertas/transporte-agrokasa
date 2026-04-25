// src/utils/storage.ts
// Storage mínimo: SOLO para recordar usuario en login
// Ya NO se usa para programaciones ni días ni áreas.
// Todo eso ahora se maneja desde Supabase.

const REMEMBER_KEY = 'trp_remember'

export const getRemember = (): string | null => {
  try {
    return localStorage.getItem(REMEMBER_KEY)
  } catch {
    return null
  }
}

export const setRemember = (user: string): void => {
  try {
    localStorage.setItem(REMEMBER_KEY, user)
  } catch {
    // evitar crash si storage falla
  }
}

export const clearRemember = (): void => {
  try {
    localStorage.removeItem(REMEMBER_KEY)
  } catch {
    // evitar crash
  }
}