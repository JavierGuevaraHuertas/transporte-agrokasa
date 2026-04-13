/**
 * App.tsx con Supabase Auth.
 * Para activar: renombra este archivo a App.tsx (reemplaza el original).
 */
import { useAuth } from './hooks/useAuth'
import LoginPageSupabase from './pages/LoginPage'
import SupervisorApp from './pages/supervisor/SupervisorApp'
import AdminApp from './pages/admin/AdminApp'

export default function App() {
  const { usuario, loading } = useAuth()

if (loading) {
  return (
    <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

  if (!usuario) return <LoginPageSupabase />
  if (usuario.rol === 'supervisor') return <SupervisorApp />
  if (usuario.rol === 'admin')      return <AdminApp />
  return <LoginPageSupabase />
}
