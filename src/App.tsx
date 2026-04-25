import { useAuth } from './hooks/useAuth'
import LoginPageSupabase from './pages/LoginPage'
import SupervisorApp from './pages/supervisor/SupervisorApp'
import AdminApp from './pages/admin/AdminApp'

export default function App() {
  const { usuario, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!usuario) return <LoginPageSupabase />

  if (usuario.rol === 'supervisor') return <SupervisorApp />
  if (usuario.rol === 'admin') return <AdminApp />

  return (
    <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow p-4 text-sm">
        <p className="font-bold text-gray-900 mb-2">Rol no reconocido</p>
        <p className="text-gray-600">Usuario: {usuario.nombre}</p>
        <p className="text-gray-600">Rol: {String(usuario.rol)}</p>
      </div>
    </div>
  )
}