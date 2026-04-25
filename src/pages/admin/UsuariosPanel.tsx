import { useState, useEffect } from 'react'
import { ALL_AREAS } from '../../utils/constants'
import { getAllUsuarios, getUsuarioAreas, setUsuarioAreas } from '../../lib/api'

interface Supervisor {
  id: string
  username: string
  nombre: string
  rol: string
  usuario_areas?: { area: string }[]
}

interface Props {
  showToast: (msg: string, type: 'ok' | 'warn' | 'err') => void
}

export default function UsuariosPanel({ showToast }: Props) {
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [areas, setAreas] = useState<Record<string, string[]>>({})
  const [editing, setEditing] = useState<{ id: string; username: string; nombre: string } | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await getAllUsuarios()
      const sups = data.filter((u: Supervisor) => u.rol === 'supervisor')
      setSupervisores(sups)

      const aMap: Record<string, string[]> = {}
      await Promise.all(
        sups.map(async (s: Supervisor) => {
          aMap[s.id] = await getUsuarioAreas(s.id)
        })
      )
      setAreas(aMap)
    } catch {
      showToast('Error cargando usuarios', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  const openEdit = (s: Supervisor) => {
    setEditing({ id: s.id, username: s.username, nombre: s.nombre })
    setSelected(areas[s.id] || [])
  }

  const toggle = (area: string) => {
    setSelected((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await setUsuarioAreas(editing.id, selected)
      await cargar()
      setEditing(null)
      showToast('Áreas actualizadas para ' + editing.nombre, 'ok')
    } catch {
      showToast('Error guardando áreas', 'err')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-2" />
        <span className="text-sm text-gray-400">Cargando usuarios...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-900">Gestión de Usuarios</h2>
      </div>

      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
        SUPERVISORES ({supervisores.length})
      </p>

      <div className="flex flex-col gap-2">
        {supervisores.map((s) => {
          const ini = s.nombre
            .split(' ')
            .map((w: string) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()

          const sAreas = areas[s.id] || []

          return (
            <div key={s.id} className="card flex items-start gap-3 hover:border-gray-300">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center font-bold text-sm text-green-700 flex-shrink-0">
                {ini}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-gray-900">{s.nombre}</p>
                  <span className="badge-sup">Supervisor</span>
                </div>

                <p className="text-xs text-gray-400 mb-2">{s.username}@agrokasa.com.pe</p>

                <div className="flex gap-1.5 flex-wrap">
                  {sAreas.length > 0 ? (
                    sAreas.map((a) => (
                      <span
                        key={a}
                        className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200"
                      >
                        {a}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-amber-500 italic">
                      Sin áreas asignadas — verá todas
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => openEdit(s)}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 flex-shrink-0"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar áreas
              </button>
            </div>
          )
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-start justify-center pt-16 px-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-1">
              Editar áreas — {editing.nombre}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Selecciona las áreas que puede programar este supervisor
            </p>

            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto mb-4">
              {ALL_AREAS.map((a) => {
                const checked = selected.includes(a)

                return (
                  <label
                    key={a}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      checked ? 'bg-green-50 border-green-200' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(a)}
                      className="w-4 h-4 accent-primary-600"
                    />
                    <span className="text-xs text-gray-700">{a}</span>
                  </label>
                )
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="flex-1 btn-secondary text-xs py-2"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 btn-primary text-xs py-2"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}