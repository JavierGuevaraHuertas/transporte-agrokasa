import { useEffect, useState } from 'react'
import { AGK, AGR, ALLP, RUTAS, getRid } from '../../utils/constants'
import { getAllProgramaciones, getProgramacionDetalle } from '../../lib/api'
import type { ProgramacionWithData } from '../../types'

interface Props {
  refresh: number
}

type SubTab = 'paraderos' | 'comedores'

function fp(all: ProgramacionWithData[], hor: string, area: string) {
  return all.filter(
    (m) => (hor === 'ALL' || m.hor === hor) && (area === 'ALL' || m.area === area)
  )
}

export default function ConsolidadoPanel({ refresh }: Props) {
  const [sub, setSub] = useState<SubTab>('paraderos')
  const [hor, setHor] = useState('ALL')
  const [area, setArea] = useState('ALL')
  const [all, setAll] = useState<ProgramacionWithData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true

    async function cargar() {
      try {
        setLoading(true)
        const fecha = new Date().toISOString().slice(0, 10)
        const progs = await getAllProgramaciones(fecha)

        const enriched = await Promise.all(
          (progs || []).map(async (p: any) => {
            const detalle = await getProgramacionDetalle(p.id)
            const data: Record<string, number> = {}

            detalle.forEach((row) => {
              const rutaTxt = row.ruta.replace('-', '_')
              const rid = row.fila_label
                ? `${rutaTxt}_${row.fila_label}`
                : `${rutaTxt}_${row.lote ?? 0}_${row.comedor ?? 0}`
              const ck = `${rid}||${row.paradero}`
              data[ck] = row.cantidad ?? 0
            })

            return {
              key: p.id,
              user: p.usuarios?.nombre || p.usuarios?.username || '',
              tipo: p.tipo,
              hor: p.horario_label,
              area: p.area,
              total: p.total || 0,
              data,
            } as ProgramacionWithData
          })
        )

        if (!active) return
        setAll(enriched)
      } catch (e) {
        console.error('Error cargando consolidado:', e)
        if (!active) return
        setAll([])
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    void cargar()
    return () => { active = false }
  }, [refresh])

  const hors = [...new Set(all.map((x) => x.hor))]
  const areas = [...new Set(all.map((x) => x.area))]
  const progs = fp(all, hor, area)

  const Filtros = () => (
    <div className="card mb-3 flex gap-3 flex-wrap items-end">
      {[
        { label: 'Horario', val: hor, set: setHor, opts: [['ALL', 'Todos'], ...hors.map((h) => [h, h])] },
        { label: 'Área', val: area, set: setArea, opts: [['ALL', 'Todas'], ...areas.map((a) => [a, a])] },
      ].map((f) => (
        <div key={f.label}>
          <label className="block text-xs font-semibold text-gray-500 mb-1">{f.label}</label>
          <select value={f.val} onChange={(e) => f.set(e.target.value)} className="input-base text-xs w-auto">
            {f.opts.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      ))}
      {loading && <span className="text-xs text-gray-400">Cargando…</span>}
    </div>
  )

  const ParaderosBlock = ({ tipo }: { tipo: 'SALIDA' | 'RECOJO' }) => {
    const filtered = progs.filter((m) => m.tipo === tipo)
    if (!filtered.length) return <div className="mb-1 text-center py-4 text-gray-300 text-xs">Sin datos</div>

    const hors = [...new Set(filtered.map((m) => m.hor))]

    // Totales globales por paradero
    const tot: Record<string, number> = {}
    ALLP.forEach(({ p }) => { tot[p] = 0 })
    let grandTotal = 0

    // Construir filas: por cada horario > ruta > lote/comedor
    type FilaVis = {
      hor: string
      isFirstHor: boolean
      horSpan: number
      ruta: string
      isFirstRuta: boolean
      rutaSpan: number
      lote: string
      com: string
      lbl: string
      pars: Record<string, number>
      rowTotal: number
    }

    const allFilas: FilaVis[] = []

    hors.forEach((h) => {
      const progsHor = filtered.filter((m) => m.hor === h)
      const filasHor: Omit<FilaVis, 'isFirstHor' | 'horSpan'>[] = []

      Object.entries(RUTAS).forEach(([ruta, rutaFilas]) => {
        const filasRuta: Omit<FilaVis, 'isFirstHor' | 'horSpan' | 'isFirstRuta' | 'rutaSpan'>[] = []

        rutaFilas.forEach((fila) => {
          const rutaTxt = ruta.replace('-', '_')
          const ridData = fila.lbl ? `${rutaTxt}_${fila.lbl}` : `${rutaTxt}_${fila.l ?? 0}_${fila.c ?? 0}`
          const pars: Record<string, number> = {}
          let rowTotal = 0

          ALLP.forEach(({ p }) => {
            let s = 0
            progsHor.forEach((m) => {
              Object.keys(m.data).forEach((ck) => {
                if (ck.startsWith(ridData + '||') && ck.endsWith('||' + p)) s += m.data[ck] || 0
              })
            })
            pars[p] = s
            rowTotal += s
          })

          if (rowTotal > 0) {
            filasRuta.push({
              hor: h,
              ruta,
              lote: fila.lbl ? '' : String(fila.l ?? ''),
              com: fila.lbl ? '' : String(fila.c ?? ''),
              lbl: fila.lbl ?? '',
              pars,
              rowTotal,
            })
          }
        })

        filasRuta.forEach((f, ri) => {
          filasHor.push({ ...f, isFirstRuta: ri === 0, rutaSpan: filasRuta.length })
        })
      })

      filasHor.forEach((f, hi) => {
        allFilas.push({ ...f, isFirstHor: hi === 0, horSpan: filasHor.length })
        ALLP.forEach(({ p }) => { tot[p] += f.pars[p] || 0 })
        grandTotal += f.rowTotal
      })
    })

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tipo === 'SALIDA' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {tipo === 'SALIDA' ? '↑ SALIDA' : '↓ INGRESO'}
          </span>
        </div>

        <div className="overflow-auto max-h-[60vh] rounded-xl border border-gray-100">
          <table className="text-xs w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr className="sticky top-0 z-30">
                <th className="bg-primary-600 text-white px-2 py-1 text-left sticky left-0 z-40 min-w-[110px] align-middle" rowSpan={2} style={{ height: '142px' }}>Horario</th>
                <th className="bg-primary-600 text-white px-2 py-1 text-center min-w-[36px] align-middle" rowSpan={2} style={{ height: '142px' }}>Ruta</th>
                <th className="bg-primary-600 text-white px-2 py-1 text-center min-w-[30px] align-middle" rowSpan={2} style={{ height: '142px' }}>L</th>
                <th className="bg-primary-600 text-white px-2 py-1 text-center min-w-[30px] border-r-2 border-primary-400 align-middle" rowSpan={2} style={{ height: '142px' }}>C</th>
                <th className="bg-primary-600 text-white px-2 py-1 text-center min-w-[40px] border-r-2 border-primary-400 align-middle" rowSpan={2} style={{ height: '142px' }}>Total</th>
                {AGK.map((ag) => (
                  <th key={ag} colSpan={AGR[ag].length} className="text-white px-1 py-1 text-center text-xs font-bold" style={{ background: '#155e30', borderLeft: '2px solid #4ade80', borderBottom: 'none' }}>
                    {ag}
                  </th>
                ))}
              </tr>
              <tr className="sticky z-30" style={{ top: '28px', backgroundColor: '#1a7a3c' }}>
                {ALLP.map(({ ag, p }, i) => {
                  const bl = i === 0 || ALLP[i - 1].ag !== ag
                  return (
                    <th
                      key={`${ag}-${p}`}
                      className={`text-white font-normal ${bl ? 'border-l-2 border-primary-400' : ''} ${i % 2 === 0 ? 'bg-primary-700' : 'bg-primary-800'}`}
                      style={{ minWidth: '30px', maxWidth: '30px', padding: 0, borderTop: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '110px', padding: '4px 2px' }}>
                        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '10px', lineHeight: '1.3', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', maxHeight: '102px', textAlign: 'center' }}>
                          {p}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {allFilas.map((f, idx) => {
                const bg = idx % 2 === 0 ? '' : 'bg-gray-50'
                return (
                  <tr key={`${f.hor}-${f.ruta}-${f.lote}-${f.com}-${idx}`} className={`hover:bg-blue-50 ${bg}`}>
                    {f.isFirstHor && (
                      <td rowSpan={f.horSpan} className="px-2 py-1.5 sticky left-0 bg-white font-semibold border-r border-gray-100 border-t-2 border-t-green-200 z-20 align-middle text-gray-700">
                        {f.hor}
                      </td>
                    )}
                    {f.isFirstRuta && (
                      <td rowSpan={f.rutaSpan} className="px-1 py-1.5 text-center font-bold text-blue-600 border-r border-gray-100 align-middle">
                        {f.ruta}
                      </td>
                    )}
                    {f.lbl ? (
                      <td colSpan={2} className="px-2 py-1.5 text-gray-500 font-semibold italic border-r-2 border-gray-200 text-left">
                        {f.lbl}
                      </td>
                    ) : (
                      <>
                        <td className="px-1 py-1.5 text-center border-r border-gray-100 text-gray-600">{f.lote}</td>
                        <td className="px-1 py-1.5 text-center border-r-2 border-gray-200 text-gray-600">{f.com}</td>
                      </>
                    )}
                    <td className={`px-2 py-1.5 text-center font-bold border-r-2 border-gray-200 ${f.rowTotal > 0 ? 'text-green-600' : 'text-gray-200'}`}>
                      {f.rowTotal || ''}
                    </td>
                    {ALLP.map(({ ag, p }, i) => {
                      const bl = i === 0 || ALLP[i - 1].ag !== ag
                      const v = f.pars[p] || 0
                      return (
                        <td key={`${ag}-${p}`} className={`px-1 py-1.5 text-center ${bl ? 'border-l border-gray-200' : ''} ${v ? 'font-semibold text-gray-800' : 'text-gray-200'}`}>
                          {v || ''}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              <tr className="bg-green-50 font-bold">
                <td className="px-2 py-1.5 sticky left-0 bg-green-50 text-green-700 border-r border-green-100" colSpan={4}>TOTAL</td>
                <td className="px-2 py-1.5 text-center text-green-700 border-r-2 border-green-200">{grandTotal}</td>
                {ALLP.map(({ ag, p }, i) => {
                  const bl = i === 0 || ALLP[i - 1].ag !== ag
                  const v = tot[p] || 0
                  return (
                    <td key={`tot-${ag}-${p}`} className={`px-1 py-1.5 text-center text-green-700 ${bl ? 'border-l border-green-200' : ''} ${v ? 'font-bold' : 'text-gray-300'}`}>
                      {v || ''}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const ComedoresBlock = ({ tipo }: { tipo: 'SALIDA' | 'RECOJO' }) => {
    const filtered = progs.filter((m) => m.tipo === tipo)
    if (!filtered.length) return <div className="mb-1 text-center py-4 text-gray-300 text-xs">Sin datos</div>

    const areasList = [...new Set(filtered.map((x) => x.area))]
    const gt: Record<string, number> = {}
    areasList.forEach((a) => { gt[a] = 0 })
    let gs = 0

    const rutaRows: Record<string, { fila: (typeof RUTAS)[string][0]; rid: string; rba: Record<string, number>; rs: number }[]> = {}

    Object.entries(RUTAS).forEach(([ruta, filas]) => {
      rutaRows[ruta] = []
      filas.forEach((fila) => {
        const rid = getRid(ruta, fila)
        const rutaTxt = ruta.replace('-', '_')
        const ridData = fila.lbl ? `${rutaTxt}_${fila.lbl}` : `${rutaTxt}_${fila.l ?? 0}_${fila.c ?? 0}`
        const rba: Record<string, number> = {}

        areasList.forEach((a) => {
          let s = 0
          filtered.filter((m) => m.area === a).forEach((m) => {
            Object.keys(m.data).forEach((ck) => { if (ck.startsWith(ridData + '||')) s += m.data[ck] || 0 })
          })
          rba[a] = s
        })

        const rs = Object.values(rba).reduce((a, b) => a + b, 0)
        if (rs > 0 || fila.lbl) {
          rutaRows[ruta].push({ fila, rid, rba, rs })
          areasList.forEach((a) => { gt[a] += rba[a] || 0 })
          gs += rs
        }
      })
    })

    const rows: React.ReactNode[] = []
    Object.entries(rutaRows).forEach(([ruta, filas]) => {
      if (filas.length === 0) return
      filas.forEach(({ fila, rid, rba, rs }, fi) => {
        rows.push(
          <tr key={rid} className="hover:bg-gray-50">
            {fi === 0 && (
              <td rowSpan={filas.length} className="px-2 py-1 font-bold text-blue-600 text-xs align-middle sticky left-0 bg-white border-r-2 border-gray-300 z-10" style={{ minWidth: '40px' }}>
                {ruta}
              </td>
            )}
            {fila.lbl ? (
              <td colSpan={2} className="px-2 py-1.5 text-xs text-gray-500 font-semibold text-left border-r border-gray-100 bg-gray-50">{fila.lbl}</td>
            ) : (
              <>
                <td className="px-2 py-1.5 text-center border-r border-gray-100 text-gray-700 font-medium">{fila.l}</td>
                <td className="px-2 py-1.5 text-center border-r border-gray-100 text-gray-700 font-medium">{fila.c}</td>
              </>
            )}
            <td className={`px-2 py-1.5 text-center font-bold border-r-2 border-gray-300 ${rs > 0 ? 'text-green-600' : 'text-gray-300'}`}>
              {rs > 0 ? rs : ''}
            </td>
            {areasList.map((a, i) => {
              const v = rba[a] || 0
              const bg = i % 2 === 0 ? '' : 'bg-gray-50'
              return (
                <td key={a} className={`px-1 py-1.5 text-center border-l border-gray-200 ${bg} ${v ? 'font-semibold text-gray-800' : 'text-gray-200'}`}>
                  {v || ''}
                </td>
              )
            })}
          </tr>
        )
      })
    })

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tipo === 'SALIDA' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {tipo === 'SALIDA' ? '↑ SALIDA' : '↓ INGRESO'}
          </span>
        </div>

        <div className="overflow-auto max-h-[50vh] rounded-xl border border-gray-100">
          <table className="text-xs w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-primary-600 text-white px-2 py-2 text-left sticky left-0 z-20 min-w-[40px]">Ruta</th>
                <th className="bg-primary-600 text-white px-2 py-2 text-center min-w-[36px]">Lote</th>
                <th className="bg-primary-600 text-white px-2 py-2 text-center min-w-[36px]">Com</th>
                <th className="bg-primary-600 text-green-200 px-2 py-2 text-center min-w-[44px] border-r-2 border-primary-400">Total</th>
                {areasList.map((a, ai) => (
                  <th key={a} className={`text-white font-normal border-l border-primary-500 ${ai % 2 === 0 ? 'bg-primary-600' : 'bg-primary-700'}`} style={{ minWidth: '30px', maxWidth: '30px', padding: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '110px', padding: '4px 2px' }}>
                      <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '10px', lineHeight: '1.3', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', maxHeight: '102px', textAlign: 'center' }}>
                        {a}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows}
              <tr className="bg-green-50 font-bold">
                <td className="px-2 py-1.5 sticky left-0 bg-green-50 text-green-700 border-r border-green-100 text-xs" colSpan={3}>TOTAL</td>
                <td className="px-2 py-1.5 text-center text-green-700 border-r-2 border-green-200">{gs}</td>
                {areasList.map((a, i) => {
                  const v = gt[a] || 0
                  const bg = i % 2 === 0 ? 'bg-green-50' : 'bg-green-100'
                  return (
                    <td key={a} className={`px-1 py-1.5 text-center text-green-700 border-l border-green-200 ${bg} ${v ? 'font-bold' : 'text-gray-300'}`}>
                      {v || ''}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {(['paraderos', 'comedores'] as SubTab[]).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              sub === s ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-primary-400'
            }`}
          >
            {s === 'paraderos' ? 'Por paraderos' : 'Por ruta / comedor'}
          </button>
        ))}
      </div>

      <Filtros />

      {sub === 'paraderos' ? (
        <>
          <ParaderosBlock tipo="SALIDA" />
          <ParaderosBlock tipo="RECOJO" />
        </>
      ) : (
        <>
          <ComedoresBlock tipo="SALIDA" />
          <ComedoresBlock tipo="RECOJO" />
        </>
      )}
    </div>
  )
}
