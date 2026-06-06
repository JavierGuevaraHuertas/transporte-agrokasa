import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { FormState } from './SupervisorApp'
import { AGK, AGR, RUTAS, HOR, ALL_AREAS, getRid } from '../../utils/constants'
import {
  getUsuarioAreas,
  getDia,
  getProgramacionDetalle,
  saveProgramacion,
} from '../../lib/api'

interface Props {
  formState: FormState
  onBack: () => void
  onSaved: (msg: string) => void
}

/** Calcula la fecha de programación según tipo y día de la semana.
 *  Para RECOJO programado en sábado (day=6): se sugiere el lunes siguiente (+2 días)
 *  porque el domingo normalmente no se labora. El supervisor puede cambiar la fecha
 *  manualmente en caso de que esa semana sí se trabaje el domingo u otro día. */
function calcFechaDefault(tipo: string): string {
  const now = new Date()
  const day = now.getDay() // 0=dom, 6=sab

  if (tipo === 'RECOJO' && day === 6) {
    // Sábado → proponer lunes por defecto
    const lunes = new Date(now)
    lunes.setDate(now.getDate() + 2)
    return lunes.toISOString().slice(0, 10)
  }

  return now.toISOString().slice(0, 10)
}

export default function FormPanel({ formState, onBack, onSaved }: Props) {
  const { usuario } = useAuth()
  const today = new Date().toISOString().slice(0, 10)

  const { tipo, key: editKey, hor: initHor, area: initArea } = formState
  const horList = HOR[tipo]

  // fecha de programación: ajustada automáticamente para RECOJO en sábado
  const [fechaProgram, setFechaProgram] = useState<string>(() => calcFechaDefault(tipo))

  const [areas, setAreas] = useState<string[]>(ALL_AREAS)
  const [hor, setHor] = useState(initHor || horList[0].id)
  const [area, setArea] = useState(initArea || '')
  const [cagr, setCagr] = useState(AGK[0])
  const [fData, setFData] = useState<Record<string, number>>({})
  const [bloq, setBloq] = useState(false)
  const [saving, setSaving] = useState(false)

  // Recalcular fecha por defecto si cambia el tipo
  useEffect(() => {
    if (!editKey) {
      setFechaProgram(calcFechaDefault(tipo))
    }
  }, [tipo, editKey])

  useEffect(() => {
    let active = true

    if (!usuario) return

    getUsuarioAreas(usuario.id)
      .then((result) => {
        if (!active) return
        const list = result.length > 0 ? result : ALL_AREAS
        setAreas(list)
        if (!initArea) setArea(list[0])
      })
      .catch(() => {
        if (!active) return
        setAreas(ALL_AREAS)
        if (!initArea) setArea(ALL_AREAS[0])
      })

    return () => {
      active = false
    }
  }, [usuario, initArea])

  // Verificar si la fecha de programación está bloqueada
  useEffect(() => {
    let active = true

    getDia(fechaProgram)
      .then((dia) => {
        if (!active) return
        // Check type-specific estado first, fall back to global estado
        const estadoTipo = tipo === 'SALIDA' ? dia?.estado_salida : dia?.estado_recojo
        setBloq(estadoTipo === 'cerrado' || dia?.estado === 'cerrado')
      })
      .catch(() => {
        if (!active) return
        setBloq(false)
      })

    return () => {
      active = false
    }
  }, [fechaProgram])

  useEffect(() => {
    let active = true

    async function cargarDetalle() {
      if (!editKey) {
        setFData({})
        return
      }

      try {
        const detalle = await getProgramacionDetalle(editKey)
        if (!active) return

        const next: Record<string, number> = {}

        for (const row of detalle) {
          const comedor = Number(row.comedor ?? 0)

          let rutaBase = row.ruta || ''
          if (!RUTAS[rutaBase]) {
            const partes = rutaBase.split('-')
            if (partes.length > 2) {
              rutaBase = partes.slice(0, 2).join('-')
            }
          }

          const filasRuta = RUTAS[rutaBase]
          if (!filasRuta) continue

          let rid = ''

          if (row.fila_label) {
            const filaMatch = filasRuta.find((f) => f.lbl === row.fila_label)
            if (filaMatch) {
              rid = getRid(rutaBase, filaMatch)
            }
          } else {
            const filaMatch = filasRuta.find(
              (f) => f.l === row.lote && f.c === comedor
            )
            if (filaMatch) {
              rid = getRid(rutaBase, filaMatch)
            } else {
              rid = getRid(rutaBase, { l: row.lote ?? 0, c: comedor })
            }
          }

          if (!rid) continue

          const ck = `${rid}||${row.paradero}`
          next[ck] = row.cantidad ?? 0
        }

        setFData(next)
      } catch (e) {
        console.error('Error cargando detalle:', e)
        if (!active) return
        setFData({})
      }
    }

    void cargarDetalle()

    return () => {
      active = active
    }
  }, [editKey])

  useEffect(() => {
    setHor(initHor || horList[0].id)
  }, [initHor, horList])

  useEffect(() => {
    if (initArea) setArea(initArea)
  }, [initArea])

  const total = Object.values(fData).reduce((a, b) => a + (b || 0), 0)
  const getCellKey = (rid: string, p: string) => `${rid}||${p}`

  const updateCell = useCallback((rid: string, p: string, val: number) => {
    const ck = getCellKey(rid, p)
    setFData((prev) => {
      const next = { ...prev }
      if (val > 0) next[ck] = val
      else delete next[ck]
      return next
    })
  }, [])

  const getAgrCount = (ag: string) => {
    let s = 0
    AGR[ag].forEach((p) => {
      Object.keys(RUTAS).forEach((r) => {
        RUTAS[r].forEach((f) => {
          s += fData[getCellKey(getRid(r, f), p)] || 0
        })
      })
    })
    return s
  }

  const rowTotal = (rid: string) =>
    AGR[cagr].reduce((a, p) => a + (fData[getCellKey(rid, p)] || 0), 0)

  const guardar = async () => {
    if (bloq || !usuario || saving) return

    try {
      setSaving(true)

      const horarioSel = horList.find((h) => h.id === hor)

      await saveProgramacion(
        usuario.id,
        fechaProgram,   // ← usa la fecha de programación (puede ser lunes si es sábado)
        tipo,
        hor,
        horarioSel?.label || hor,
        area,
        fData,
        editKey
      )

      onSaved(`Guardado — ${total} personas`)
      onBack()
    } catch (e: any) {
      console.error('Error guardando programación:', e)
      const msg = e?.message?.includes('Ya existe') ? e.message : 'Error al guardar la programación'
      onSaved(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!usuario) return null

  // Etiqueta para mostrar la fecha de programación al usuario
  const fechaLabel = new Date(fechaProgram + 'T12:00:00').toLocaleDateString('es-PE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })

  const esAjusteFecha = fechaProgram !== today

  return (
    <div>
      <div className="flex items-center gap-2 py-2 mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-500 font-medium hover:text-gray-800"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          {tipo === 'SALIDA' ? 'Salida' : 'Recojo'}
        </button>
      </div>

      <div className="card mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Horario</label>
          <select
            value={hor}
            onChange={(e) => setHor(e.target.value)}
            disabled={bloq || saving}
            className="input-base"
          >
            {horList.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Área / labor</label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            disabled={bloq || saving}
            className="input-base"
          >
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Fecha de programación — solo visible si difiere de hoy */}
        {tipo === 'RECOJO' && !editKey && (
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Fecha de programación
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fechaProgram}
                min={today}
                onChange={(e) => setFechaProgram(e.target.value || today)}
                disabled={bloq || saving}
                className="input-base flex-1"
              />
              <span className="text-xs text-blue-600 font-medium capitalize whitespace-nowrap">
                {fechaLabel}
              </span>
            </div>
            <p className="text-xs text-amber-600 mt-1">
              📅 Programando recojo para el <span className="font-semibold capitalize">{fechaLabel}</span>. Ajusta si es necesario.
            </p>
          </div>
        )}

        <div className="col-span-2 bg-green-50 rounded-lg px-3 py-2 flex justify-between items-center">
          <span className="text-xs font-semibold text-green-700">Total personas</span>
          <span className="text-xl font-bold text-green-700">{total}</span>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-3">
        {AGK.map((ag) => {
          const cnt = getAgrCount(ag)
          return (
            <button
              key={ag}
              onClick={() => setCagr(ag)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                cagr === ag
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-primary-400'
              }`}
            >
              {ag}
              {cnt > 0 && (
                <span
                  className={`ml-1 text-xs px-1 rounded-full ${
                    cagr === ag ? 'bg-white/30' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {cnt}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl overflow-auto mb-3 border border-gray-100">
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr>
              <th className="bg-primary-600 text-white px-2 py-2 text-center text-xs font-semibold sticky left-0 z-10">
                Lote / Comedor
              </th>
              {AGR[cagr].map((p, pi) => (
                <th
                  key={p}
                  className={`text-white font-normal border-l border-primary-400 ${
                    pi % 2 === 0 ? 'bg-primary-600' : 'bg-primary-700'
                  }`}
                  style={{ minWidth: '30px', maxWidth: '30px', padding: 0 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '120px',
                      padding: '4px 2px',
                    }}
                  >
                    <span
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        fontSize: '10px',
                        lineHeight: '1.3',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        maxHeight: '112px',
                        textAlign: 'center',
                      }}
                    >
                      {p}
                    </span>
                  </div>
                </th>
              ))}
              <th className="bg-primary-600 text-white px-2 py-2 text-center text-xs font-semibold text-green-200 border-l-2 border-primary-400">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {Object.entries(RUTAS).map(([ruta, filas]) =>
              filas.map((fila, idx) => {
                const rid = getRid(ruta, fila)
                const rt = rowTotal(rid)
                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'

                return (
                  <tr key={rid} className={`hover:bg-blue-50 ${rowBg}`}>
                    {fila.lbl ? (
                      <td className={`px-2 py-1 text-xs text-gray-400 font-semibold text-center sticky left-0 border-r-2 border-gray-300 z-10 ${rowBg}`}>
                        {fila.lbl}
                      </td>
                    ) : (
                      <td className={`px-2 py-1 text-center font-semibold text-gray-700 sticky left-0 border-r-2 border-gray-300 z-10 ${rowBg}`}>
                        L{fila.l} - C{fila.c}
                      </td>
                    )}

                    {AGR[cagr].map((p) => {
                      const ck = getCellKey(rid, p)
                      const val = fData[ck] || 0

                      return (
                        <td
                          key={p}
                          className={`px-0.5 py-0.5 text-center border-l border-gray-200 ${rowBg}`}
                        >
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={val || ''}
                            placeholder=""
                            disabled={bloq || saving}
                            onChange={(e) =>
                              updateCell(rid, p, parseInt(e.target.value, 10) || 0)
                            }
                            className={`w-full text-center text-xs border border-gray-200 rounded py-0.5 focus:outline-none focus:border-primary-500 disabled:text-gray-300 ${rowBg}`}
                            style={{ minWidth: '28px' }}
                          />
                        </td>
                      )
                    })}
                    <td
                      className={`px-2 py-1 text-center font-bold border-l-2 border-gray-300 ${rowBg} ${
                        rt > 0 ? 'text-green-600' : 'text-gray-200'
                      }`}
                    >
                      {rt || 0}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          onClick={guardar}
          disabled={bloq || saving}
          className="w-full btn-primary py-3 text-sm"
        >
          {bloq ? '🔒 Día cerrado' : saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
