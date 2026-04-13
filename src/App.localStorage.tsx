import { useState } from 'react'
import type { User } from './types'
import { AppContext } from './store/useAppStore'
import LoginPage from './pages/LoginPage'
import SupervisorApp from './pages/supervisor/SupervisorApp'
import AdminApp from './pages/admin/AdminApp'

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const todayDate = new Date().toISOString().slice(0, 10)

  const setUser = (user: User | null) => setCurrentUser(user)

  return (
    <AppContext.Provider value={{ state: { currentUser, todayDate }, setUser }}>
      {!currentUser && <LoginPage />}
      {currentUser?.role === 'sup' && <SupervisorApp />}
      {currentUser?.role === 'admin' && <AdminApp />}
    </AppContext.Provider>
  )
}
