import { useApp } from '../store/useAppStore'
import { supabase } from '../lib/supabase'

interface TopbarProps {
  title?: string
}

export default function Topbar({ title = 'Programación de Transporte' }: TopbarProps) {
  const { state } = useApp()

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="bg-primary-600 h-12 flex items-center justify-between px-4 flex-shrink-0">
      <span className="text-white font-bold text-sm">{title}</span>
      <div className="flex items-center gap-2">
        <span className="text-white/70 text-xs hidden sm:block">{state.currentUser?.name}</span>
        <button
          onClick={handleLogout}
          className="border border-white/50 text-white text-xs px-3 py-1 rounded-md hover:bg-white/10 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}