import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { FormState } from './SupervisorApp'
import { AGK, AGR, RUTAS, HOR, ALL_AREAS, getRid } from '../../utils/constants'
import { getProgramData, makeKey, upsertProg, isDiaCerrado } from '../../utils/storage'
import { getUsuarioAreas } from '../../lib/api'

interface Props {
  formState: FormState
  onBack: () => void
  onSaved: (msg: string) => void
}

export default function FormPanel({ formState, onBack, onSaved }: Props) {
  const { usuario } = useAuth()
  const today = new Date().toISOString().slice(0, 10)
  const bloq = isDiaCerrado(today)

  const { tipo, key: editKey, hor: initHor, area: initArea } = formState
  const horList = HOR[tipo]

  const [areas, setAreas] = useState<string[]>(ALL_AREAS)
  const [hor, setHor] = useState(initHor || horList[0].id)
  const [area, setArea] = useState(initArea || '')
  const [cagr, setCagr] = useState(AGK[0])
  const [fData, setFData] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!usuario) return
    getUsuarioAreas(usuario.id).then(result => {
      const list = result.length > 0 ? result : ALL_AREAS
      setAreas(list)
      if (!initArea) setArea(list[0])
    }).catch(() => {
      setAreas(ALL_AREAS)
      if (!initArea) setArea(ALL_AREAS[0])
    })
  }, [usuario, initArea])

  useEffect(() => {
    if (editKey) setFData(getProgramData(editKey))
    else setFData({})
  }, [editKey])

  useEffect(() => { setHor(initHor || horList[0].id) }, [initHor, horList])
  useEffect(() => { if (initArea) setArea(initArea) }, [initArea])

  const total = Object.values(fData).reduce((a, b) => a + (b || 0), 0)
  const getCellKey = (rid: string, p: string) => `${rid}||${p}`

  const updateCell = useCallback((rid: string, p: string, val: number) => {
    const ck = getCellKey(rid, p)
    setFData(prev => {
      const next = { ...prev }
      if (val > 0) next[ck] = val
      else delete next[ck]
      return next
    })
  }, [])

  const getAgrCount = (ag: string) => {
    let s = 0
    AGR[ag].forEach(p => {
      Object.keys(RUTAS).forEach(r => {
        RUTAS[r].forEach(f => { s += fData[getCellKey(getRid(r, f), p)] || 0 })
      })
    })
    return s
  }

  const rowTotal = (rid: string) =>
    AGR[cagr].reduce((a, p) => a + (fData[getCellKey(rid, p)] || 0), 0)

  const guardar = () => {
    if (bloq || !usuario) return
    const nk = makeKey(usuario.username, tipo, hor, area)
    const total2 = Object.values(fData).reduce((a, b) => a + (b || 0), 0)
    upsertProg(
      { key: nk, user: usuario.username, tipo, hor, area, total: total2, ts: Date.now() },
      fData, editKey || undefined
    )
    onSaved(`Guardado — ${total2} personas`)
    onBack()
  }

  if (!usuario) return null

  return (
    <div>
      <div className="flex items-center gap-2 py-2 mb-2">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 font-medium hover:text-gray-800">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          {tipo === 'SALIDA' ? 'Salida' : 'Recojo'}
        </button>
      </div>

      <div className="card mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Horario</label>
          <select value={hor} onChange={e => setHor(e.target.value)} disabled={bloq} className="input-base">
            {horList.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Área / labor</label>
          <select value={area} onChange={e => setArea(e.target.value)} disabled={bloq} className="input-base">
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="col-span-2 bg-green-50 rounded-lg px-3 py-2 flex justify-between items-center">
          <span className="text-xs font-semibold text-green-700">Total personas</span>
          <span className="text-xl font-bold text-green-700">{total}</span>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-3">
        {AGK.map(ag => {
          const cnt = getAgrCount(ag)
          return (
            <button key={ag} onClick={() => setCagr(ag)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                cagr === ag ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-primary-400'
              }`}
            >
              {ag}
              {cnt > 0 && (
                <span className={`ml-1 text-xs px-1 rounded-full ${cagr === ag ? 'bg-white/30' : 'bg-gray-100 text-gray-500'}`}>
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
              <th className="bg-primary-600 text-white px-2 py-2 text-left text-xs font-semibold sticky left-0 z-10">Ruta</th>
              <th className="bg-primary-600 text-white px-2 py-2 text-center text-xs font-semibold">Lote</th>
              <th className="bg-primary-600 text-white px-2 py-2 text-center text-xs font-semibold">Com</th>
              <th className="bg-primary-600 text-white px-2 py-2 text-center text-xs font-semibold text-green-200 border-r-2 border-primary-400">Total</th>
              {AGR[cagr].map((p, pi) => (
                <th key={p}
                    className={`text-white font-normal border-l border-primary-400 ${pi % 2 === 0 ? 'bg-primary-600' : 'bg-primary-700'}`}
                    style={{ minWidth: '30px', maxWidth: '30px', padding: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', padding: '4px 2px' }}>
                    <span style={{
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
                    }}>
                      {p}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(RUTAS).map(([ruta, filas]) =>
              filas.map((fila, fi) => {
                const rid = getRid(ruta, fila)
                const rt = rowTotal(rid)
                return (
                  <tr key={rid} className="hover:bg-blue-50">
                    {fi === 0 && (
                      <td rowSpan={filas.length} className="px-2 py-1 font-bold text-blue-600 text-xs align-top pt-2 sticky left-0 bg-white border-r-2 border-gray-300 z-10">
                        {ruta}
                      </td>
                    )}
                    {fila.lbl ? (
                      <td colSpan={2} className="px-2 py-1 text-xs text-gray-400 font-semibold text-left border-r border-gray-100">{fila.lbl}</td>
                    ) : (
                      <>
                        <td className="px-2 py-1 text-center border-r border-gray-100 text-gray-600">{fila.l}</td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 text-gray-600">{fila.c}</td>
                      </>
                    )}
                    <td className={`px-2 py-1 text-center font-bold border-r-2 border-gray-300 ${rt > 0 ? 'text-green-600' : 'text-gray-200'}`}>
                      {rt || 0}
                    </td>
                    {AGR[cagr].map((p, pi) => {
                      const ck = getCellKey(rid, p)
                      const val = fData[ck] || 0
                      const bg = pi % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      return (
                        <td key={p} className={`px-0.5 py-0.5 text-center border-l border-gray-200 ${bg}`}>
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={val || ''}
                            placeholder=""
                            disabled={bloq}
                            onChange={e => updateCell(rid, p, parseInt(e.target.value) || 0)}
                            className={`w-full text-center text-xs border border-gray-200 rounded py-0.5 focus:outline-none focus:border-primary-500 disabled:text-gray-300 ${bg}`}
                            style={{ minWidth: '28px' }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button onClick={guardar} disabled={bloq} className="w-full btn-primary py-3 text-sm">
          {bloq ? '🔒 Día cerrado' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}