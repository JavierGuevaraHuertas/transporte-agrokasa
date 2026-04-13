import { useAuth } from '../../hooks/useAuth'
import type { TipoProgram } from '../../types'
import { getIdx, isDiaCerrado } from '../../utils/storage'

interface Props {
  tipo: TipoProgram
  refresh: number
  onBack: () => void
  onNew: () => void
  onEdit: (key: string, tipo: TipoProgram, hor: string, area: string) => void
}

export default function ListaPanel({ tipo, refresh: _r, onBack, onNew, onEdit }: Props) {
  const { usuario } = useAuth()
  const today = new Date().toISOString().slice(0, 10)
  const bloq = isDiaCerrado(today)
  const idx = getIdx().filter(x => x.user === usuario?.username && x.tipo === tipo)

  if (!usuario) return null

  return (
    <div>
      <div className="flex items-center gap-2 py-2 mb-2">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 font-medium hover:text-gray-800">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Inicio
        </button>
      </div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">
          {tipo === 'SALIDA' ? 'Salida — hacia el campo' : 'Recojo — desde el campo'}
        </h2>
        <button onClick={onNew} disabled={bloq} className="btn-primary text-xs py-1.5 px-3 disabled:bg-gray-300">
          {bloq ? '🔒 Cerrado' : '+ Nueva'}
        </button>
      </div>
      {idx.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          <p className="mb-3">Sin programaciones aún</p>
          {!bloq && <button onClick={onNew} className="btn-primary text-xs">+ Nueva programación</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {idx.map(m => (
            <div
              key={m.key}
              onClick={() => onEdit(m.key, m.tipo as TipoProgram, m.hor, m.area)}
              className="card flex items-center gap-2 cursor-pointer hover:border-gray-300"
            >
              <span className={m.tipo === 'SALIDA' ? 'badge-salida' : 'badge-recojo'}>{m.tipo}</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-900">{m.area}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.hor}</p>
              </div>
              <span className="text-sm font-bold text-green-600">{m.total}</span>
              <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M9 18l6-6-6-6"/></svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}