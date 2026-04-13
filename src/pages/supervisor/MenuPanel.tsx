import type { TipoProgram } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { getIdx, isDiaCerrado } from '../../utils/storage'

interface Props {
  refresh: number
  onGoLista: (tipo: TipoProgram) => void
  onNewDirect: (tipo: TipoProgram) => void
}

export default function MenuPanel({ refresh: _r, onGoLista, onNewDirect }: Props) {
  const { usuario } = useAuth()
  const today = new Date().toISOString().slice(0, 10)
  const bloq = isDiaCerrado(today)
  const idx = getIdx().filter(x => x.user === usuario?.username)

  const stats = (tipo: TipoProgram) => {
    const mine = idx.filter(x => x.tipo === tipo)
    return { count: mine.length, total: mine.reduce((a, x) => a + (x.total || 0), 0) }
  }

  const dateLabel = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })

  if (!usuario) return null

  const TipoCard = ({ tipo }: { tipo: TipoProgram }) => {
    const isSal = tipo === 'SALIDA'
    const { count, total } = stats(tipo)

    return (
      <div
        onClick={() => !bloq && onGoLista(tipo)}
        className={`card border-2 ${
          bloq ? 'opacity-60 cursor-not-allowed' :
          isSal ? 'hover:border-amber-400 border-gray-100 cursor-pointer' :
                  'hover:border-blue-400 border-gray-100 cursor-pointer'
        } transition-all`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${isSal ? 'bg-amber-100' : 'bg-blue-100'}`}>
          {isSal
            ? <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            : <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          }
        </div>
        <p className="text-sm font-bold text-gray-900">{isSal ? 'Salida' : 'Recojo'}</p>
        <p className="text-xs text-gray-400 mb-3">{isSal ? 'Hacia el campo' : 'Desde el campo'}</p>
        <div className="border-t border-gray-100 pt-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-400">Programaciones</span>
            <span className={`text-sm font-bold ${isSal ? 'text-amber-600' : 'text-blue-600'}`}>{count}</span>
          </div>
          <p className="text-xs text-gray-400">Personas <span className="font-semibold text-green-600 ml-1">{total}</span></p>
        </div>
        {!bloq && (
          <div className="mt-2">
            {count > 0 ? (
              <button
                onClick={e => { e.stopPropagation(); onGoLista(tipo) }}
                className={`w-full py-1.5 text-xs font-semibold rounded-lg border ${
                  isSal ? 'border-amber-400 text-amber-700 bg-amber-50' : 'border-blue-400 text-blue-700 bg-blue-50'
                }`}
              >
                Editar programación
              </button>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onNewDirect(tipo) }}
                className={`w-full py-1.5 text-xs font-semibold rounded-lg text-white border-0 ${
                  isSal ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                + Nueva programación
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {bloq && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
          <span className="text-lg">🔒</span>
          <p className="text-sm text-red-700 font-medium">El día ha sido cerrado. No se pueden realizar más cambios.</p>
        </div>
      )}
      <div className="card mb-3">
        <p className="text-sm font-bold text-gray-900">Bienvenido, {usuario.nombre}</p>
        <p className="text-xs text-gray-400 mt-0.5 capitalize">{dateLabel}</p>
      </div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">TRANSPORTE</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <TipoCard tipo="SALIDA" />
        <TipoCard tipo="RECOJO" />
      </div>
      {idx.length > 0 && (
        <>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recientes</p>
          <div className="flex flex-col gap-1.5">
            {idx.slice(0, 4).map(m => (
              <div key={m.key} className="card flex items-center gap-2 cursor-pointer hover:border-gray-300" onClick={() => onGoLista(m.tipo as TipoProgram)}>
                <span className={m.tipo === 'SALIDA' ? 'badge-salida' : 'badge-recojo'}>{m.tipo}</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900">{m.area}</p>
                  <p className="text-xs text-gray-400">{m.hor}</p>
                </div>
                <span className="text-sm font-bold text-green-600">{m.total}</span>
                <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M9 18l6-6-6-6"/></svg>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}