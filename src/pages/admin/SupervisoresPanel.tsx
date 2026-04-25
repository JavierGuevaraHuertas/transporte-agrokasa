import { useState, useEffect } from 'react'
import { getAllUsuarios, getAllProgramaciones } from '../../lib/api'
import type { ProgramacionWithData } from '../../types'

interface Supervisor {
  id: string
  username: string
  nombre: string
  rol: string
}

interface Props {
  refresh: number
}

export default function SupervisoresPanel({ refresh }: Props) {
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [programaciones, setProgramaciones] = useState<ProgramacionWithData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function cargar() {
      try {
        setLoading(true)

        const fecha = new Date().toISOString().slice(0, 10)

        const [usuariosData, progsData] = await Promise.all([
          getAllUsuarios(),
          getAllProgramaciones(fecha),
        ])

        if (!active) return

        const supervisoresFiltrados = (usuariosData || []).filter(
          (u: Supervisor) => u.rol === 'supervisor'
        )

        const progsMapeados: ProgramacionWithData[] = (progsData || []).map((p: any) => ({
          key: p.id,
          user: p.usuarios?.username || '',
          tipo: p.tipo,
          hor: p.horario_label,
          area: p.area,
          total: p.total || 0,
          data: {},
        }))

        setSupervisores(supervisoresFiltrados)
        setProgramaciones(progsMapeados)
      } catch (e) {
        console.error('Error cargando supervisores:', e)
        if (!active) return
        setSupervisores([])
        setProgramaciones([])
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    void cargar()

    return () => {
      active = false
    }
  }, [refresh])

  const byU: Record<string, ProgramacionWithData[]> = {}
  programaciones.forEach((m) => {
    if (!byU[m.user]) byU[m.user] = []
    byU[m.user].push(m)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mr-2" />
        <span className="text-sm text-gray-400">Cargando...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {supervisores.map((s) => {
        const ini = s.nombre
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()

        const progs = byU[s.username] || []
        const tot = progs.reduce((a, x) => a + (x.total || 0), 0)
        const hasDatos = progs.length > 0

        return (
          <div
            key={s.id}
            className={`card border-2 ${hasDatos ? 'border-green-100' : 'border-amber-100'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center font-bold text-xs text-green-700 flex-shrink-0">
                {ini}
              </div>

              <div className="flex-1">
                <p className="text-xs font-bold text-gray-900">{s.nombre}</p>
                <p className="text-xs text-gray-400">{progs.length} programaciones</p>
              </div>

              {hasDatos ? (
                <span className="text-base font-bold text-green-600">{tot}</span>
              ) : (
                <span className="text-xs font-semibold text-amber-500">⚠ Sin registro</span>
              )}
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {hasDatos ? (
                progs.map((m) => (
                  <div
                    key={m.key}
                    className="bg-gray-50 rounded-md px-2 py-1 text-xs border border-gray-100"
                  >
                    <span className={m.tipo === 'SALIDA' ? 'badge-salida' : 'badge-recojo'}>
                      {m.tipo === 'SALIDA' ? 'SALIDA' : 'INGRESO'}
                    </span>
                    <span className="ml-1 text-gray-600">{m.area}</span>
                    <span className="ml-1 font-bold text-green-600">{m.total}</span>
                    <span className="ml-1 text-gray-400">{m.hor}</span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-gray-400">Sin programaciones registradas</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
