import { signOut } from '../lib/api'

interface TopbarProps {
  title?: string
}

export default function Topbar({ title = 'Programación de Transporte' }: TopbarProps) {
  const handleLogout = async () => {
    try {
      await signOut()
      window.location.reload()
    } catch (e) {
      console.error('Error cerrando sesión:', e)
      alert('No se pudo cerrar sesión')
    }
  }

  return (
    <div className="bg-primary-600 h-12 flex items-center justify-between px-4 flex-shrink-0">
      <span className="text-white font-bold text-sm">{title}</span>

      <button
        type="button"
        onClick={() => void handleLogout()}
        className="border border-white/50 text-white text-xs px-3 py-1 rounded-md hover:bg-white/10 transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
