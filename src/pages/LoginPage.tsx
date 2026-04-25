import { useState, useEffect } from 'react'
import { signIn } from '../lib/api'
import { getRemember, setRemember, clearRemember } from '../utils/storage'

export default function LoginPageSupabase() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRememberState] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = getRemember()
    if (saved) {
      setUsername(saved)
      setRememberState(true)
    }
  }, [])

  const handleLogin = async () => {
    const u = username.trim().toLowerCase()

    if (!u || !password) {
      setError('Completa usuario y contraseña')
      return
    }

    setLoading(true)
    setError('')

    try {
      await signIn(`${u}@agrokasa.com.pe`, password)

      if (remember) setRemember(u)
      else clearRemember()

      localStorage.removeItem('trp_idx')
      sessionStorage.clear()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al ingresar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-primary-600 px-7 py-7 text-white">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center font-bold text-sm mb-3">
            PT
          </div>
          <h1 className="text-xl font-bold mb-1">Inicio de sesión</h1>
          <p className="text-xs opacity-80">Programación de Transporte</p>
        </div>

        <div className="bg-white px-7 py-6">
          <label className="block text-xs font-semibold text-gray-800 mb-1.5">
            Usuario
          </label>

          <div className="flex border border-gray-300 rounded-lg overflow-hidden mb-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jguevara"
              className="flex-1 px-3 py-2.5 text-sm outline-none bg-white text-gray-900"
              onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
            />
            <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-l border-gray-300 whitespace-nowrap">
              @agrokasa.com.pe
            </span>
          </div>

          <label className="block text-xs font-semibold text-gray-800 mb-1.5">
            Contraseña
          </label>

          <div className="flex border border-gray-300 rounded-lg overflow-hidden mb-3">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 px-3 py-2.5 text-sm outline-none bg-white text-gray-900"
              onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="px-3 py-2.5 bg-gray-50 text-gray-600 text-xs font-medium border-l border-gray-300"
            >
              {showPass ? 'Ocultar' : 'Ver'}
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-500 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRememberState(e.target.checked)}
              className="w-3.5 h-3.5 accent-primary-600"
            />
            Recordar usuario
          </label>

          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

          <button onClick={() => void handleLogin()} disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  )
}