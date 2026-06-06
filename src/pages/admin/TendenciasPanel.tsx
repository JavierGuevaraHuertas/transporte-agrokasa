import { useState, useEffect, useRef, useMemo } from 'react'
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
    setVisible((prev) => ({ ...prev, [a]: prev[a] === false ? true : false }))

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
          all.map(async (p) => {
            const detalle = await getProgramacionDetalle(p.id)
            const parData: Record<string, number> = {}
            detalle.forEach((row) => {
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
    const filtered = all.filter((m) => (tipo === 'ALL' || m.tipo === tipo) && m.fecha >= desde && m.fecha <= hasta)
    const areas = [...new Set(filtered.map((x) => x.area))].sort()
    setVisible((prev) => {
      const next = { ...prev }
      areas.forEach((a) => { if (next[a] === undefined) next[a] = true })
      return next
    })
  }, [all, tipo, desde, hasta])

  // Filtered data
  const filtered = useMemo(() =>
    all.filter((m) => (tipo === 'ALL' || m.tipo === tipo) && m.fecha >= desde && m.fecha <= hasta),
    [all, tipo, desde, hasta]
  )
  const filteredDetails = useMemo(() =>
    details.filter((m) => (tipo === 'ALL' || m.tipo === tipo) && m.fecha >= desde && m.fecha <= hasta),
    [details, tipo, desde, hasta]
  )
  const areas = useMemo(() => [...new Set(filtered.map((x) => x.area))].sort(), [filtered])

  // KPIs
  const totalPersonas = useMemo(() => filtered.reduce((a, x) => a + x.total, 0), [filtered])
  const totalDias = useMemo(() => new Set(filtered.map((x) => x.fecha)).size, [filtered])
  const topArea = useMemo(() => {
    const byArea: Record<string, number> = {}
    filtered.forEach((x) => { byArea[x.area] = (byArea[x.area] || 0) + x.total })
    return Object.entries(byArea).sort((a, b) => b[1] - a[1])[0]
  }, [filtered])

  // Top paraderos
  const topParaderos = useMemo(() => {
    const byPar: Record<string, number> = {}
    filteredDetails.forEach((m) => {
      Object.entries(m.parData).forEach(([p, v]) => { byPar[p] = (byPar[p] || 0) + v })
    })
    return Object.entries(byPar).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [filteredDetails])

  // Top agrupadores
  const topAgrupadores = useMemo(() => {
    const byAg: Record<string, number> = {}
    AGK.forEach((ag) => { byAg[ag] = 0 })
    filteredDetails.forEach((m) => {
      ALLP.forEach(({ ag, p }) => { byAg[ag] = (byAg[ag] || 0) + (m.parData[p] || 0) })
    })
    return Object.entries(byAg).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  }, [filteredDetails])

  const maxPar = topParaderos[0]?.[1] || 1
  const maxAg = topAgrupadores[0]?.[1] || 1

  // Charts
  useEffect(() => {
    const weeks = [...new Set(filtered.map((m) => getWeekKey(m.fecha)))].sort()
    const byAW: Record<string, Record<string, number>> = {}
    areas.forEach((a) => { byAW[a] = {}; weeks.forEach((w) => { byAW[a][w] = 0 }) })
    filtered.forEach((m) => {
      const wk = getWeekKey(m.fecha)
      if (byAW[m.area]) byAW[m.area][wk] = (byAW[m.area][wk] || 0) + m.total
    })
    const labels = weeks.map(fmtWeek)
    const visAreas = areas.filter((a) => visible[a] !== false)
    const datasets = visAreas.map((a) => {
      const col = AREA_COLORS[areas.indexOf(a) % AREA_COLORS.length]
      return { label: a, data: weeks.map((w) => byAW[a][w] || 0), borderColor: col, backgroundColor: col + '22', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false }
    })
    if (lineRef.current) {
      if (lineChart.current) lineChart.current.destroy()
      lineChart.current = new Chart(lineRef.current, {
        type: 'line',
        data: { labels, datasets: datasets as never },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 }, color: '#9ca3af' } }, y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 }, color: '#9ca3af' }, beginAtZero: true } } },
      })
    }
    const totByArea = areas.filter((a) => visible[a] !== false)
      .map((a) => ({ a, t: Object.values(byAW[a]).reduce((x, y) => x + y, 0) }))
      .sort((x, y) => y.t - x.t)
    if (barRef.current) {
      if (barChart.current) barChart.current.destroy()
      barChart.current = new Chart(barRef.current, {
        type: 'bar',
        data: {
          labels: totByArea.map((x) => x.a.length > 12 ? x.a.slice(0, 11) + '…' : x.a),
          datasets: [{ data: totByArea.map((x) => x.t), backgroundColor: totByArea.map((x) => AREA_COLORS[areas.indexOf(x.a) % AREA_COLORS.length] + 'cc'), borderRadius: 6 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#9ca3af' } }, y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 }, color: '#9ca3af' }, beginAtZero: true } } },
      })
    }
  }, [all, tipo, desde, hasta, visible, filtered, areas])

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
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-base text-xs w-auto">
              <option value="ALL">Salida + Ingreso</option>
              <option value="SALIDA">Solo Salida</option>
              <option value="RECOJO">Solo Ingreso</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input-base text-xs w-auto" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input-base text-xs w-auto" />
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
            { label: tipoLabel, value: [...new Set(filtered.map(x => x.area))].length + ' áreas', cls: 'text-green-600', sub: `${filtered.length} prog.` },
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
            {areas.map((a, i) => {
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

      {/* Gráfico línea */}
      <div className="card mb-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Personas por semana</p>
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
              {topParaderos.map(([par, val], i) => {
                const pct = Math.round((val / maxPar) * 100)
                const ag = ALLP.find((x) => x.p === par)?.ag || ''
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
              {topAgrupadores.map(([ag, val], i) => {
                const pct = Math.round((val / maxAg) * 100)
                const ZONE_COLORS = ['#1a7a3c','#2563eb','#dc2626','#d97706','#7c3aed','#0891b2','#db2777','#65a30d','#ea580c','#0284c7']
                const col = ZONE_COLORS[i % ZONE_COLORS.length]
                // Count paraderos in this zone
                const parCount = ALLP.filter((x) => x.ag === ag && topParaderos.some(([p]) => p === x.p)).length
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
    </div>
  )
}
