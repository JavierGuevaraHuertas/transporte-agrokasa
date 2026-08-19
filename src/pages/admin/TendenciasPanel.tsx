import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { AREA_COLORS, ALLP, AGK } from '../../utils/constants'
import { getAllProgramaciones, getProgramacionDetalle } from '../../lib/api'

Chart.register(
  CategoryScale, LinearScale, PointElement, LineElement, LineController,
  BarElement, BarController, Title, Tooltip, Legend, Filler
)

interface Props { refresh: number }

interface ProgTrend {
  id: string
  tipo: 'SALIDA' | 'RECOJO'
  area: string
  total: number
  fecha: string
}

interface ProgDetail extends ProgTrend {
  parData: Record<string, number> // paradero → cantidad
}

function getWeekKey(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d)
  mon.setDate(diff)
  return mon.toISOString().slice(0, 10)
}
function fmtWeek(wk: string) {
  const d = new Date(wk + 'T00:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export default function TendenciasPanel({ refresh }: Props) {
  const [tipo, setTipo] = useState('ALL')
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 28); return d.toISOString().slice(0, 10)
  })
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [weekVisible, setWeekVisible] = useState<Record<string, boolean>>({})
  const [all, setAll] = useState<ProgTrend[]>([])
  const [details, setDetails] = useState<ProgDetail[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const lineRef = useRef<HTMLCanvasElement>(null)
  const barRef = useRef<HTMLCanvasElement>(null)
  const lineChart = useRef<Chart | null>(null)
  const barChart = useRef<Chart | null>(null)

  const setSem = (n: number) => {
    const d = new Date(), from = new Date()
    from.setDate(d.getDate() - n * 7)
    setDesde(from.toISOString().slice(0, 10))
    setHasta(d.toISOString().slice(0, 10))
  }

  const toggleArea = (a: string) =>
    setVisible((prev: Record<string, boolean>) => ({ ...prev, [a]: prev[a] === false ? true : false }))

  const toggleWeek = (w: string) =>
    setWeekVisible((prev: Record<string, boolean>) => ({ ...prev, [w]: prev[w] === false ? true : false }))

  // Load programaciones (totals only)
  useEffect(() => {
    let active = true
    async function cargar() {
      try {
        const from = new Date(desde), to = new Date(hasta)
        const fechas: string[] = []
        const cur = new Date(from)
        while (cur <= to) { fechas.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
        const results = await Promise.all(fechas.map((f) => getAllProgramaciones(f)))
        const mapped: ProgTrend[] = results.flat().map((p: any) => ({
          id: p.id, tipo: p.tipo, area: p.area, total: p.total || 0, fecha: p.fecha,
        }))
        if (!active) return
        setAll(mapped)
        setDetails([]) // reset details when range changes
      } catch (e) {
        console.error(e)
        if (!active) return
        setAll([])
      }
    }
    void cargar()
    return () => { active = false }
  }, [desde, hasta, refresh])

  // Load paradero details (lazy, only when needed)
  useEffect(() => {
    if (all.length === 0) return
    let active = true
    setLoadingDetail(true)
    async function cargarDetalles() {
      try {
        const enriched: ProgDetail[] = await Promise.all(
          all.map(async (p: ProgTrend) => {
            const detalle = await getProgramacionDetalle(p.id)
            const parData: Record<string, number> = {}
            detalle.forEach((row: any) => {
              parData[row.paradero] = (parData[row.paradero] || 0) + (row.cantidad || 0)
            })
            return { ...p, parData }
          })
        )
        if (!active) return
        setDetails(enriched)
      } catch (e) {
        console.error(e)
      } finally {
        if (!active) return
        setLoadingDetail(false)
      }
    }
    void cargarDetalles()
    return () => { active = false }
  }, [all])

  // Init visible
  useEffect(() => {
    const filtered = all.filter((m: ProgTrend) => (tipo === 'ALL' || m.tipo === tipo) && m.fecha >= desde && m.fecha <= hasta)
    const areas: string[] = Array.from<string>(new Set(filtered.map((x: ProgTrend) => x.area))).sort()
    setVisible((prev: Record<string, boolean>) => {
      const next = { ...prev }
      areas.forEach((a: string) => { if (next[a] === undefined) next[a] = true })
      return next
    })
  }, [all, tipo, desde, hasta])

  // Filtered data
  const filtered = useMemo(() =>
    all.filter((m: ProgTrend) => (tipo === 'ALL' || m.tipo === tipo) && m.fecha >= desde && m.fecha <= hasta),
    [all, tipo, desde, hasta]
  )
  const filteredDetails = useMemo(() =>
    details.filter((m: ProgDetail) => (tipo === 'ALL' || m.tipo === tipo) && m.fecha >= desde && m.fecha <= hasta),
    [details, tipo, desde, hasta]
  )
  const areas = useMemo(() => Array.from<string>(new Set(filtered.map((x: ProgTrend) => x.area))).sort(), [filtered])

  // Todas las semanas del rango (independiente del filtro de área), y numeración estable Sem 1, 2, 3...
  const allWeeks = useMemo(() => Array.from<string>(new Set(filtered.map((m: ProgTrend) => getWeekKey(m.fecha)))).sort(), [filtered])
  const weekNumberMap = useMemo(() => Object.fromEntries(allWeeks.map((w: string, i: number) => [w, i + 1])) as Record<string, number>, [allWeeks])

  // Init semanas visibles (por defecto todas activas al cambiar el rango)
  useEffect(() => {
    setWeekVisible((prev: Record<string, boolean>) => {
      const next: Record<string, boolean> = {}
      allWeeks.forEach((w: string) => { next[w] = prev[w] === undefined ? true : prev[w] })
      return next
    })
  }, [allWeeks])

  const visibleWeeks = useMemo(() => allWeeks.filter((w: string) => weekVisible[w] !== false), [allWeeks, weekVisible])

  // KPIs
  const totalPersonas = useMemo(() => filtered.reduce((a: number, x: ProgTrend) => a + x.total, 0), [filtered])
  const totalDias = useMemo(() => Array.from<string>(new Set(filtered.map((x: ProgTrend) => x.fecha))).length, [filtered])
  const topArea = useMemo(() => {
    const byArea: Record<string, number> = {}
    filtered.forEach((x: ProgTrend) => { byArea[x.area] = (byArea[x.area] || 0) + x.total })
    return Object.entries(byArea).sort((a: [string,number], b: [string,number]) => b[1] - a[1])[0] as [string, number] | undefined
  }, [filtered])

  // Details restricted to the areas currently toggled ON (chips arriba)
  const visibleFilteredDetails = useMemo(
    () => filteredDetails.filter((m: ProgDetail) => visible[m.area] !== false),
    [filteredDetails, visible]
  )

  // Top paraderos (respeta el filtro de área seleccionada)
  const topParaderos = useMemo((): [string, number][] => {
    const byPar: Record<string, number> = {}
    visibleFilteredDetails.forEach((m: ProgDetail) => {
      Object.entries(m.parData).forEach(([p, v]: [string, number]) => { byPar[p] = (byPar[p] || 0) + v })
    })
    return Object.entries(byPar).sort((a: [string,number], b: [string,number]) => b[1] - a[1]).slice(0, 10)
  }, [visibleFilteredDetails])

  // Top agrupadores (respeta el filtro de área seleccionada)
  const topAgrupadores = useMemo((): [string, number][] => {
    const byAg: Record<string, number> = {}
    AGK.forEach((ag: string) => { byAg[ag] = 0 })
    visibleFilteredDetails.forEach((m: ProgDetail) => {
      ALLP.forEach(({ ag, p }: { ag: string; p: string }) => { byAg[ag] = (byAg[ag] || 0) + (m.parData[p] || 0) })
    })
    return Object.entries(byAg).filter(([, v]: [string, number]) => v > 0).sort((a: [string,number], b: [string,number]) => b[1] - a[1])
  }, [visibleFilteredDetails])

  // Días con datos por semana (para calcular promedios diarios)
  const daysPerWeek = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    visibleFilteredDetails.forEach((m: ProgDetail) => {
      const wk = getWeekKey(m.fecha)
      if (weekVisible[wk] === false) return
      if (!map[wk]) map[wk] = new Set<string>()
      map[wk].add(m.fecha)
    })
    const result: Record<string, number> = {}
    Object.entries(map).forEach(([wk, s]: [string, Set<string>]) => { result[wk] = s.size })
    return result
  }, [visibleFilteredDetails, weekVisible])

  // Cuadro semanal por paradero — muestra PROMEDIO DIARIO de cada semana, no el total (respeta filtro de área y semanas)
  const weeklyParaderos = useMemo(() => {
    const byParWeek: Record<string, Record<string, number>> = {}
    visibleFilteredDetails.forEach((m: ProgDetail) => {
      const wk = getWeekKey(m.fecha)
      if (weekVisible[wk] === false) return
      Object.entries(m.parData).forEach(([p, v]: [string, number]) => {
        if (!byParWeek[p]) byParWeek[p] = {}
        byParWeek[p][wk] = (byParWeek[p][wk] || 0) + v
      })
    })
    const totalDays = visibleWeeks.reduce((a: number, w: string) => a + (daysPerWeek[w] || 0), 0)
    const rows = Object.entries(byParWeek)
      .map(([p, rawWm]: [string, Record<string, number>]) => {
        const weekMap: Record<string, number> = {}
        let rawTotal = 0
        Object.entries(rawWm).forEach(([wk, v]: [string, number]) => {
          rawTotal += v
          const days = daysPerWeek[wk] || 0
          weekMap[wk] = days > 0 ? Math.round(v / days) : 0
        })
        return { nombre: p, weekMap, total: totalDays > 0 ? Math.round(rawTotal / totalDays) : 0 }
      })
      .sort((a, b) => b.total - a.total)
    return { weeks: visibleWeeks, rows }
  }, [visibleFilteredDetails, weekVisible, visibleWeeks, daysPerWeek])

  // Cuadro semanal por zona/agrupador — muestra PROMEDIO DIARIO de cada semana, no el total (respeta filtro de área y semanas)
  const weeklyZonas = useMemo(() => {
    const byAgWeek: Record<string, Record<string, number>> = {}
    visibleFilteredDetails.forEach((m: ProgDetail) => {
      const wk = getWeekKey(m.fecha)
      if (weekVisible[wk] === false) return
      ALLP.forEach(({ ag, p }: { ag: string; p: string }) => {
        const v = m.parData[p] || 0
        if (v === 0) return
        if (!byAgWeek[ag]) byAgWeek[ag] = {}
        byAgWeek[ag][wk] = (byAgWeek[ag][wk] || 0) + v
      })
    })
    const totalDays = visibleWeeks.reduce((a: number, w: string) => a + (daysPerWeek[w] || 0), 0)
    const rows = Object.entries(byAgWeek)
      .map(([ag, rawWm]: [string, Record<string, number>]) => {
        const weekMap: Record<string, number> = {}
        let rawTotal = 0
        Object.entries(rawWm).forEach(([wk, v]: [string, number]) => {
          rawTotal += v
          const days = daysPerWeek[wk] || 0
          weekMap[wk] = days > 0 ? Math.round(v / days) : 0
        })
        return { nombre: ag, weekMap, total: totalDays > 0 ? Math.round(rawTotal / totalDays) : 0 }
      })
      .sort((a, b) => b.total - a.total)
    return { weeks: visibleWeeks, rows }
  }, [visibleFilteredDetails, weekVisible, visibleWeeks, daysPerWeek])

  const maxPar = topParaderos[0]?.[1] || 1
  const maxAg = topAgrupadores[0]?.[1] || 1

  // Charts
  useEffect(() => {
    const weeks: string[] = visibleWeeks
    const byAW: Record<string, Record<string, number>> = {}
    const daysAW: Record<string, Record<string, Set<string>>> = {}
    areas.forEach((a: string) => {
      byAW[a] = {}; daysAW[a] = {}
      weeks.forEach((w: string) => { byAW[a][w] = 0; daysAW[a][w] = new Set<string>() })
    })
    filtered.forEach((m: ProgTrend) => {
      const wk = getWeekKey(m.fecha)
      if (weekVisible[wk] === false) return
      if (byAW[m.area]) {
        byAW[m.area][wk] = (byAW[m.area][wk] || 0) + m.total
        daysAW[m.area][wk]?.add(m.fecha)
      }
    })
    const labels: string[] = weeks.map((w) => `Sem ${weekNumberMap[w]}`)
    const weekDates: string[] = weeks.map(fmtWeek)
    const visAreas = areas.filter((a: string) => visible[a] !== false)
    const datasets = visAreas.map((a: string) => {
      const col = AREA_COLORS[areas.indexOf(a) % AREA_COLORS.length]
      return {
        label: a,
        data: weeks.map((w) => {
          const days = daysAW[a][w]?.size || 0
          return days > 0 ? Math.round((byAW[a][w] || 0) / days) : 0
        }),
        borderColor: col, backgroundColor: col + '22', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false,
      }
    })
    if (lineRef.current) {
      if (lineChart.current) lineChart.current.destroy()
      lineChart.current = new Chart(lineRef.current, {
        type: 'line',
        data: { labels, datasets: datasets as never },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index', intersect: false,
              callbacks: { title: (items) => `Semana ${weekNumberMap[weeks[items[0].dataIndex]]} (${weekDates[items[0].dataIndex]}) — promedio diario` },
            },
          },
          scales: { x: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 }, color: '#9ca3af' } }, y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 }, color: '#9ca3af' }, beginAtZero: true } },
        },
      })
    }
    const totByArea = areas.filter((a: string) => visible[a] !== false)
      .map((a: string): { a: string; t: number } => ({ a, t: (Object.values(byAW[a]) as number[]).reduce((x: number, y: number) => x + y, 0) }))
      .sort((x: {a:string;t:number}, y: {a:string;t:number}) => y.t - x.t)
    if (barRef.current) {
      if (barChart.current) barChart.current.destroy()
      barChart.current = new Chart(barRef.current, {
        type: 'bar',
        data: {
          labels: totByArea.map((x: {a:string;t:number}) => x.a.length > 12 ? x.a.slice(0, 11) + '…' : x.a),
          datasets: [{ data: totByArea.map((x: {a:string;t:number}) => x.t), backgroundColor: totByArea.map((x: {a:string;t:number}) => AREA_COLORS[areas.indexOf(x.a) % AREA_COLORS.length] + 'cc'), borderRadius: 6 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#9ca3af' } }, y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 }, color: '#9ca3af' }, beginAtZero: true } } },
      })
    }
  }, [all, tipo, desde, hasta, visible, filtered, areas, visibleWeeks, weekVisible, weekNumberMap])

  const tipoLabel = tipo === 'SALIDA' ? 'Salida' : tipo === 'RECOJO' ? 'Ingreso' : 'Salida + Ingreso'
  const tipoColor = tipo === 'SALIDA' ? 'text-amber-600' : tipo === 'RECOJO' ? 'text-blue-600' : 'text-green-600'

  return (
    <div>
      {/* Filtros */}
      <div className="card mb-3">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-900">Tendencias de Transporte</h2>
          <div className="flex gap-2">
            {[4, 8, 12].map((n) => (
              <button key={n} onClick={() => setSem(n)} className="px-3 py-1.5 text-xs font-semibold border rounded-lg border-gray-300 bg-white text-gray-600 hover:border-primary-500 hover:text-primary-600">
                {n} sem
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
            <select value={tipo} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTipo(e.target.value)} className="input-base text-xs w-auto">
              <option value="ALL">Salida + Ingreso</option>
              <option value="SALIDA">Solo Salida</option>
              <option value="RECOJO">Solo Ingreso</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
            <input type="date" value={desde} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDesde(e.target.value)} className="input-base text-xs w-auto" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHasta(e.target.value)} className="input-base text-xs w-auto" />
          </div>
        </div>
      </div>

      {/* KPIs resumen */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Total personas', value: totalPersonas.toLocaleString(), cls: tipoColor },
            { label: 'Días con datos', value: totalDias, cls: 'text-gray-700' },
            { label: 'Área líder', value: topArea?.[0]?.split(' ').slice(0, 2).join(' ') || '—', cls: 'text-purple-600', sub: topArea ? `${topArea[1].toLocaleString()} pers.` : '' },
            { label: tipoLabel, value: Array.from<string>(new Set(filtered.map((x: ProgTrend) => x.area))).length + ' áreas', cls: 'text-green-600', sub: `${filtered.length} prog.` },
          ].map((m) => (
            <div key={m.label} className="card py-2 px-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{m.label}</p>
              <p className={`text-base font-bold ${m.cls} leading-tight`}>{m.value}</p>
              {m.sub && <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Áreas visibles */}
      {areas.length > 0 && (
        <div className="card mb-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Áreas visibles</p>
          <div className="flex gap-2 flex-wrap">
            {areas.map((a: string, i: number) => {
              const col = AREA_COLORS[i % AREA_COLORS.length]
              const off = visible[a] === false
              return (
                <button key={a} onClick={() => toggleArea(a)}
                  style={{ background: col + '18', borderColor: col, color: col }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border-2 transition-opacity ${off ? 'opacity-30' : 'opacity-100'}`}
                >
                  <div style={{ background: col }} className="w-2 h-2 rounded-full" />
                  {a}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Semanas visibles */}
      {allWeeks.length > 0 && (
        <div className="card mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Semanas visibles</p>
            <div className="flex gap-2">
              <button
                onClick={() => setWeekVisible(Object.fromEntries(allWeeks.map((w: string) => [w, true])))}
                className="text-xs font-semibold text-primary-600 hover:underline"
              >
                Todas
              </button>
              <button
                onClick={() => setWeekVisible(Object.fromEntries(allWeeks.map((w: string) => [w, false])))}
                className="text-xs font-semibold text-gray-400 hover:underline"
              >
                Ninguna
              </button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {allWeeks.map((w: string) => {
              const off = weekVisible[w] === false
              return (
                <button key={w} onClick={() => toggleWeek(w)} title={fmtWeek(w)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border-2 transition-opacity ${off ? 'opacity-30 border-gray-300 text-gray-400 bg-white' : 'opacity-100 border-primary-500 text-primary-600 bg-primary-50'}`}
                >
                  Sem {weekNumberMap[w]}
                  <span className="text-gray-400 font-normal">({fmtWeek(w)})</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Gráfico línea */}
      <div className="card mb-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Personas por semana (promedio diario)</p>

        {areas.length === 0 ? (
          <p className="text-center py-10 text-gray-400 text-sm">Sin datos en el período seleccionado</p>
        ) : (
          <div style={{ height: 220 }}><canvas ref={lineRef} /></div>
        )}
      </div>

      {/* Gráfico barras acumulado */}
      <div className="card mb-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Acumulado por área</p>
        {areas.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Sin datos</p>
        ) : (
          <div style={{ height: 180 }}><canvas ref={barRef} /></div>
        )}
      </div>

      {/* Rankings side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">

        {/* Top paraderos */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">📍 Paraderos con mayor afluencia</p>
            {loadingDetail && <span className="text-xs text-gray-300">cargando…</span>}
          </div>
          {topParaderos.length === 0 ? (
            <p className="text-center py-6 text-gray-300 text-xs">{loadingDetail ? 'Calculando…' : 'Sin datos'}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {topParaderos.map(([par, val]: [string, number], i: number) => {
                const pct = Math.round((val / maxPar) * 100)
                const ag = ALLP.find((x: {ag: string; p: string}) => x.p === par)?.ag || ''
                return (
                  <div key={par} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-300 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-semibold text-gray-700 truncate max-w-[140px]">{par}</span>
                        <span className="text-xs font-bold text-gray-600 ml-1">{val.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: i === 0 ? '#1a7a3c' : i < 3 ? '#4ade80' : '#86efac' }}
                          />
                        </div>
                        <span className="text-xs text-gray-300 w-6 text-right">{pct}%</span>
                      </div>
                      {ag && <span className="text-xs text-gray-400">{ag}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top agrupadores (zonas) */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">🏘 Zonas con más personas</p>
            {loadingDetail && <span className="text-xs text-gray-300">cargando…</span>}
          </div>
          {topAgrupadores.length === 0 ? (
            <p className="text-center py-6 text-gray-300 text-xs">{loadingDetail ? 'Calculando…' : 'Sin datos'}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topAgrupadores.map(([ag, val]: [string, number], i: number) => {
                const pct = Math.round((val / maxAg) * 100)
                const ZONE_COLORS = ['#1a7a3c','#2563eb','#dc2626','#d97706','#7c3aed','#0891b2','#db2777','#65a30d','#ea580c','#0284c7']
                const col = ZONE_COLORS[i % ZONE_COLORS.length]
                // Count paraderos in this zone
                const parCount = ALLP.filter((x: {ag: string; p: string}) => x.ag === ag && topParaderos.some(([p]: [string, number]) => p === x.p)).length
                return (
                  <div key={ag} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: col }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-gray-700">{ag}</span>
                        <span className="text-xs font-bold" style={{ color: col }}>{val.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                        </div>
                        <span className="text-xs text-gray-300 w-6 text-right">{pct}%</span>
                      </div>
                      {parCount > 0 && (
                        <span className="text-xs text-gray-400">{parCount} paradero{parCount > 1 ? 's' : ''} activo{parCount > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Cuadro semanal: Paraderos */}
      {weeklyParaderos.weeks.length > 0 && (
        <div className="card mb-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">📍 Paraderos por semana (promedio diario)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-1.5 pr-3 text-gray-400 font-semibold sticky left-0 bg-white whitespace-nowrap">Paradero</th>
                  {weeklyParaderos.weeks.map((w: string) => (
                    <th key={w} className="text-right py-1.5 px-2 text-gray-400 font-semibold whitespace-nowrap" title={fmtWeek(w)}>Sem {weekNumberMap[w]}</th>
                  ))}
                  <th className="text-right py-1.5 pl-3 text-gray-700 font-bold whitespace-nowrap">Prom. diario</th>
                </tr>
              </thead>
              <tbody>
                {weeklyParaderos.rows.map((row) => (
                  <tr key={row.nombre} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3 font-semibold text-gray-700 sticky left-0 bg-white whitespace-nowrap">{row.nombre}</td>
                    {weeklyParaderos.weeks.map((w: string) => (
                      <td key={w} className="text-right py-1.5 px-2 text-gray-600">{(row.weekMap[w] || 0).toLocaleString()}</td>
                    ))}
                    <td className="text-right py-1.5 pl-3 font-bold text-gray-800">{row.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cuadro semanal: Zonas */}
      {weeklyZonas.weeks.length > 0 && (
        <div className="card mb-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">🏘 Zonas por semana (promedio diario)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-1.5 pr-3 text-gray-400 font-semibold sticky left-0 bg-white whitespace-nowrap">Zona</th>
                  {weeklyZonas.weeks.map((w: string) => (
                    <th key={w} className="text-right py-1.5 px-2 text-gray-400 font-semibold whitespace-nowrap" title={fmtWeek(w)}>Sem {weekNumberMap[w]}</th>
                  ))}
                  <th className="text-right py-1.5 pl-3 text-gray-700 font-bold whitespace-nowrap">Prom. diario</th>
                </tr>
              </thead>
              <tbody>
                {weeklyZonas.rows.map((row) => (
                  <tr key={row.nombre} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3 font-semibold text-gray-700 sticky left-0 bg-white whitespace-nowrap">{row.nombre}</td>
                    {weeklyZonas.weeks.map((w: string) => (
                      <td key={w} className="text-right py-1.5 px-2 text-gray-600">{(row.weekMap[w] || 0).toLocaleString()}</td>
                    ))}
                    <td className="text-right py-1.5 pl-3 font-bold text-gray-800">{row.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
