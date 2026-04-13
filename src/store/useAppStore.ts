import { createContext, useContext } from 'react'
import type { User } from '../types'

export interface AppState {
  currentUser: User | null
  todayDate: string
}

export interface AppContextType {
  state: AppState
  setUser: (user: User | null) => void
}

export const AppContext = createContext<AppContextType>({
  state: { currentUser: null, todayDate: new Date().toISOString().slice(0, 10) },
  setUser: () => {},
})

export const useApp = () => useContext(AppContext)
