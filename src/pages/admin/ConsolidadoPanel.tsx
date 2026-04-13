import { useState } from 'react'
import { AGK, AGR, ALLP, RUTAS, getRid } from '../../utils/constants'
import { getAllProgs } from '../../utils/storage'
import type { ProgramacionWithData } from '../../types'

interface Props { refresh: number }

type SubTab = 'paraderos' | 'comedores'

function sumPar(progs: ProgramacionWithData[], p: string) {
  let s = 0
  progs.forEach(m => Object.keys(m.data).forEach(ck => { if (ck.endsWith('||' + p)) s += (m.data[ck] || 0) }))
  return s
}

function fp(all: ProgramacionWithData[], hor: string, area: string) {
  return all.filter(m =>
    (hor === 'ALL' || m.hor === hor) &&
    (area === 'ALL' || m.area === area)
  )
}

const thVertical = (key: string, text: string, pi: number, borderLeft = false) => (
  <th key={key}
      className={`text-white font-normal ${borderLeft ? 'border-l border-primary-500' : ''} ${pi % 2 === 0 ? 'bg-primary-700' : 'bg-primary-800'}`}
      style={{ minWidth: '30px', maxWidth: '30px', padding: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '110px', padding: '4px 2px' }}>
      <span style={{
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        fontSize: '10px',
        lineHeight: '1.3',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        maxHeight: '102px',
        textAlign: 'center',
      }}>
        {text}
      </span>
    </div>
  </th>
)

export default function ConsolidadoPanel({ refresh: _r }: Props) {
  const [sub, setSub] = useState<SubTab>('paraderos')
  const [hor, setHor] = useState('ALL')
  const [area, setArea] = useState('ALL')
  const all = getAllProgs()
  const hors = [...new Set(all.map(x => x.hor))]
  const areas = [...new Set(all.map(x => x.area))]
  const progs = fp(all, hor, area)

  const Filtros = () => (
    <div className="card mb-3 flex gap-3 flex-wrap items-end">
      {[
        { label: 'Horario', val: hor, set: setHor, opts: [['ALL','Todos'],...hors.map(h=>[h,h])] },
        { label: 'Área',    val: area, set: setArea, opts: [['ALL','Todas'],...areas.map(a=>[a,a])] },
      ].map(f => (
        <div key={f.label}>
          <label className="block text-xs font-semibold text-gray-500 mb-1">{f.label}</label>
          <select value={f.val} onChange={e => f.set(e.target.value)} className="input-base text-xs w-auto">
            {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      ))}
    </div>
  )

  const ParaderosBlock = ({ tipo }: { tipo: 'SALIDA' | 'RECOJO' }) => {
    const filtered = progs.filter(m => m.tipo === tipo)
    if (!filtered.length) return (
      <div className="mb-1 text-center py-4 text-gray-300 text-xs">Sin datos</div>
    )

    const grps: Record<string, { hor: string; progs: ProgramacionWithData[] }> = {}
    filtered.forEach(m => {
      if (!grps[m.hor]) grps[m.hor] = { hor: m.hor, progs: [] }
      grps[m.hor].progs.push(m)
    })
    const tot: Record<string, number> = {}
    ALLP.forEach(({ p }) => { tot[p] = 0 })
    const grandTotal = { v: 0 }

    return (
      <div className="mb-6">
        <div className={`flex items-center gap-2 mb-2 px-1`}>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tipo === 'SALIDA' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {tipo === 'SALIDA' ? '↑ SALIDA' : '↓ RECOJO'}
          </span>
        </div>
        <div className="overflow-auto max-h-[50vh] rounded-xl border border-gray-100">
          <table className="text-xs w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-primary-600 text-white px-2 py-2 text-left sticky left-0 z-20 min-w-[120px]">Horario</th>
                <th className="bg-primary-600 text-white px-2 py-2 text-center min-w-[50px] border-r-2 border-primary-400">Total</th>
                {AGK.map(ag => (
                  <th key={ag} colSpan={AGR[ag].length} className="bg-primary-600 text-white px-2 py-2 text-center border-l border-primary-500 text-xs">
                    {ag}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="bg-primary-700 sticky left-0 z-20" />
                <th className="bg-primary-700 border-r-2 border-primary-600" />
                {ALLP.map(({ ag, p }, i) => {
                  const bl = i === 0 || ALLP[i-1].ag !== ag
                  return thVertical(`${ag}-${p}`, p, i, bl)
                })}
              </tr>
            </thead>
            <tbody>
              {Object.values(grps).map(g => {
                const rp: Record<string, number> = {}
                ALLP.forEach(({ p }) => { rp[p] = sumPar(g.progs, p); tot[p] += (rp[p] || 0) })
                const rs = Object.values(rp).reduce((a, b) => a + b, 0)
                grandTotal.v += rs
                return (
                  <tr key={g.hor} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 sticky left-0 bg-white font-medium border-r border-gray-100">{g.hor}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-green-600 border-r-2 border-gray-200">{rs}</td>
                    {ALLP.map(({ ag, p }, i) => {
                      const bl = i === 0 || ALLP[i-1].ag !== ag
                      const v = rp[p] || 0
                      const bg = i % 2 === 0 ? '' : 'bg-gray-50'
                      return <td key={`${ag}-${p}`} className={`px-1 py-1.5 text-center ${bl ? 'border-l border-gray-200' : ''} ${bg} ${v ? 'font-semibold text-gray-800' : 'text-gray-200'}`}>{v || ''}</td>
                    })}
                  </tr>
                )
              })}
              <tr className="bg-green-50 font-bold">
                <td className="px-2 py-1.5 sticky left-0 bg-green-50 text-green-700 border-r border-green-100">TOTAL</td>
                <td className="px-2 py-1.5 text-center text-green-700 border-r-2 border-green-200">{grandTotal.v}</td>
                {ALLP.map(({ ag, p }, i) => {
                  const bl = i === 0 || ALLP[i-1].ag !== ag
                  const v = tot[p] || 0
                  return <td key={`tot-${ag}-${p}`} className={`px-1 py-1.5 text-center text-green-700 ${bl ? 'border-l border-green-200' : ''} ${v ? 'font-bold' : 'text-gray-300'}`}>{v || ''}</td>
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const ComedoresBlock = ({ tipo }: { tipo: 'SALIDA' | 'RECOJO' }) => {
    const filtered = progs.filter(m => m.tipo === tipo)
    if (!filtered.length) return (
      <div className="mb-1 text-center py-4 text-gray-300 text-xs">Sin datos</div>
    )

    const areasList = [...new Set(filtered.map(x => x.area))]
    const gt: Record<string, number> = {}; areasList.forEach(a => { gt[a] = 0 })
    let gs = 0

    // Pre-calcular filas visibles por ruta para rowSpan correcto
    const rutaRows: Record<string, { fila: typeof RUTAS[string][0]; rid: string; rba: Record<string, number>; rs: number }[]> = {}
    Object.entries(RUTAS).forEach(([ruta, filas]) => {
      rutaRows[ruta] = []
      filas.forEach(fila => {
        const rid = getRid(ruta, fila)
        const rba: Record<string, number> = {}
        areasList.forEach(a => {
          let s = 0
          filtered.filter(m => m.area === a).forEach(m => {
            Object.keys(m.data).forEach(ck => { if (ck.startsWith(rid + '||')) s += (m.data[ck] || 0) })
          })
          rba[a] = s
        })
        const rs = Object.values(rba).reduce((a, b) => a + b, 0)
        if (rs > 0 || fila.lbl) {
          rutaRows[ruta].push({ fila, rid, rba, rs })
          areasList.forEach(a => { gt[a] += (rba[a] || 0) })
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
              <td rowSpan={filas.length}
                  className="px-2 py-1 font-bold text-blue-600 text-xs align-middle sticky left-0 bg-white border-r-2 border-gray-300 z-10"
                  style={{ minWidth: '40px' }}>
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
            {tipo === 'SALIDA' ? '↑ SALIDA' : '↓ RECOJO'}
          </span>
        </div>
        <div className="overflow-auto max-h-[50vh] rounded-xl border border-gray-100">
          <table className="text-xs w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-primary-600 text-white px-2 py-2 text-left sticky left-0 z-20 min-w-[40px]">Ruta</th>
                <th className="bg-primary-600 text-white px-2 py-2 text-center min-w-[36px]">Lote</th>
                <th className="bg-primary-600 text-white px-2 py-2 text-center min-w-[36px]">Com</th>
                <th className="bg-primary-600 text-white px-2 py-2 text-center min-w-[44px] border-r-2 border-primary-400 text-green-200">Total</th>
                {areasList.map((a, ai) => (
                  <th key={a}
                      className={`text-white font-normal border-l border-primary-500 ${ai % 2 === 0 ? 'bg-primary-600' : 'bg-primary-700'}`}
                      style={{ minWidth: '30px', maxWidth: '30px', padding: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '110px', padding: '4px 2px' }}>
                      <span style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        fontSize: '10px',
                        lineHeight: '1.3',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        maxHeight: '102px',
                        textAlign: 'center',
                      }}>
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
                  return <td key={a} className={`px-1 py-1.5 text-center text-green-700 border-l border-green-200 ${bg} ${v ? 'font-bold' : 'text-gray-300'}`}>{v || ''}</td>
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
        {(['paraderos','comedores'] as SubTab[]).map(s => (
          <button key={s} onClick={() => setSub(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${sub===s?'bg-primary-600 border-primary-600 text-white':'bg-white border-gray-300 text-gray-600 hover:border-primary-400'}`}>
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