import { useState, useEffect } from 'react'
import { USERS } from '../utils/constants'
import { getRemember, setRemember } from '../utils/storage'
import { useApp } from '../store/useAppStore'

export default function LoginPage() {
  const { setUser } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRememberState] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const saved = getRemember()
    if (saved && USERS[saved]) {
      setUsername(saved)
      setRememberState(true)
    }
  }, [])

  const handleLogin = () => {
    const u = username.trim().toLowerCase()
    const usr = USERS[u]
    if (usr && usr.pass === password.trim()) {
      setError(false)
      if (remember) setRemember(u)
      setUser({ user: u, name: usr.name, role: usr.role })
    } else {
      setError(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-primary-600 px-7 py-7 text-white">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center font-bold text-sm mb-3">
            PT
          </div>
          <h1 className="text-xl font-bold mb-1">Inicio de sesión</h1>
          <p className="text-xs opacity-80">Programación de Transporte</p>
        </div>

        {/* Body */}
        <div className="bg-white px-7 py-6">
          {/* Usuario */}
          <label className="block text-xs font-semibold text-gray-800 mb-1.5">Usuario</label>
          <div className="flex border border-gray-300 rounded-lg overflow-hidden mb-3">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="jguevara"
              className="flex-1 px-3 py-2.5 text-sm outline-none bg-white text-gray-900"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-l border-gray-300 whitespace-nowrap">
              @agrokasa.com.pe
            </span>
          </div>

          {/* Contraseña */}
          <label className="block text-xs font-semibold text-gray-800 mb-1.5">Contraseña</label>
          <div className="flex border border-gray-300 rounded-lg overflow-hidden mb-3">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 px-3 py-2.5 text-sm outline-none bg-white text-gray-900"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button
              onClick={() => setShowPass(!showPass)}
              className="px-3 py-2.5 bg-gray-50 text-gray-600 text-xs font-medium border-l border-gray-300"
            >
              {showPass ? 'Ocultar' : 'Ver'}
            </button>
          </div>

          {/* Recordar */}
          <label className="flex items-center gap-2 text-xs text-gray-500 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRememberState(e.target.checked)}
              className="w-3.5 h-3.5 accent-primary-600"
            />
            Recordar usuario
          </label>

          {error && (
            <p className="text-xs text-red-600 mb-3">Usuario o contraseña incorrectos</p>
          )}

          <button onClick={handleLogin} className="btn-primary w-full py-3">
            Ingresar
          </button>
        </div>
      </div>
    </div>
  )
}
