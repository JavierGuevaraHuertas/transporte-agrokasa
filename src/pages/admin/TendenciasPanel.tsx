import { useState, useEffect, useRef } from 'react'
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
import { AREA_COLORS } from '../../utils/constants'
import { getAllProgramaciones } from '../../lib/api'

Chart.register(
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
  Filler
)

interface Props {
  refresh: number
}

interface ProgTrend {
  id: string
  tipo: 'SALIDA' | 'RECOJO'
  area: string
  total: number
  fecha: string
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
    const d = new Date()
    d.setDate(d.getDate() - 28)
    return d.toISOString().slice(0, 10)
  })
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [all, setAll] = useState<ProgTrend[]>([])

  const lineRef = useRef<HTMLCanvasElement>(null)
  const barRef = useRef<HTMLCanvasElement>(null)
  const lineChart = useRef<Chart | null>(null)
  const barChart = useRef<Chart | null>(null)

  const setSem = (n: number) => {
    const d = new Date()
    const from = new Date()
    from.setDate(d.getDate() - n * 7)
    setDesde(from.toISOString().slice(0, 10))
    setHasta(d.toISOString().slice(0, 10))
  }

  const toggleArea = (a: string) =>
    setVisible((prev) => ({ ...prev, [a]: prev[a] === false ? true : false }))

  useEffect(() => {
    let active = true

    async function cargar() {
      try {
        const from = new Date(desde)
        const to = new Date(hasta)

        const fechas: string[] = []
        const cur = new Date(from)
        while (cur <= to) {
          fechas.push(cur.toISOString().slice(0, 10))
          cur.setDate(cur.getDate() + 1)
        }

        const results = await Promise.all(fechas.map((f) => getAllProgramaciones(f)))
        const merged = results.flat()

        const mapped: ProgTrend[] = merged.map((p: any) => ({
          id: p.id,
          tipo: p.tipo,
          area: p.area,
          total: p.total || 0,
          fecha: p.fecha,
        }))

        if (!active) return
        setAll(mapped)
      } catch (e) {
        console.error('Error cargando tendencias:', e)
        if (!active) return
        setAll([])
      }
    }

    void cargar()

    return () => {
      active = false
    }
  }, [desde, hasta, refresh])

  // Inicializar visible para nuevas áreas sin causar loop
  useEffect(() => {
    const filtered = all.filter((m) => {
      if (tipo !== 'ALL' && m.tipo !== tipo) return false
      return m.fecha >= desde && m.fecha <= hasta
    })
    const areas = [...new Set(filtered.map((x) => x.area))].sort()
    setVisible((prev) => {
      const next = { ...prev }
      areas.forEach((a) => { if (next[a] === undefined) next[a] = true })
      return next
    })
  }, [all, tipo, desde, hasta])

  useEffect(() => {
    const filtered = all.filter((m) => {
      if (tipo !== 'ALL' && m.tipo !== tipo) return false
      return m.fecha >= desde && m.fecha <= hasta
    })

    const areas = [...new Set(filtered.map((x) => x.area))].sort()

    const weeks = [...new Set(filtered.map((m) => getWeekKey(m.fecha)))].sort()

    const byAW: Record<string, Record<string, number>> = {}
    areas.forEach((a) => {
      byAW[a] = {}
      weeks.forEach((w) => {
        byAW[a][w] = 0
      })
    })

    filtered.forEach((m) => {
      const wk = getWeekKey(m.fecha)
      if (byAW[m.area]) {
        byAW[m.area][wk] = (byAW[m.area][wk] || 0) + (m.total || 0)
      }
    })

    const labels = weeks.map(fmtWeek)
    const visAreas = areas.filter((a) => visible[a] !== false)

    const datasets = visAreas.map((a) => {
      const col = AREA_COLORS[areas.indexOf(a) % AREA_COLORS.length]
      return {
        label: a,
        data: weeks.map((w) => byAW[a][w] || 0),
        borderColor: col,
        backgroundColor: col + '22',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
        fill: false,
      }
    })

    if (lineRef.current) {
      if (lineChart.current) lineChart.current.destroy()
      lineChart.current = new Chart(lineRef.current, {
        type: 'line',
        data: { labels, datasets: datasets as never },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { mode: 'index', intersect: false },
          },
          scales: {
            x: {
              grid: { color: '#f3f4f6' },
              ticks: { font: { size: 10 }, color: '#9ca3af' },
            },
            y: {
              grid: { color: '#f3f4f6' },
              ticks: { font: { size: 10 }, color: '#9ca3af' },
              beginAtZero: true,
            },
          },
        },
      })
    }

    const totByArea = areas
      .filter((a) => visible[a] !== false)
      .map((a) => ({ a, t: Object.values(byAW[a]).reduce((x, y) => x + y, 0) }))
      .sort((x, y) => y.t - x.t)

    if (barRef.current) {
      if (barChart.current) barChart.current.destroy()
      barChart.current = new Chart(barRef.current, {
        type: 'bar',
        data: {
          labels: totByArea.map((x) => (x.a.length > 12 ? x.a.slice(0, 11) + '…' : x.a)),
          datasets: [
            {
              data: totByArea.map((x) => x.t),
              backgroundColor: totByArea.map(
                (x) => AREA_COLORS[areas.indexOf(x.a) % AREA_COLORS.length] + 'cc'
              ),
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 9 }, color: '#9ca3af' },
            },
            y: {
              grid: { color: '#f3f4f6' },
              ticks: { font: { size: 10 }, color: '#9ca3af' },
              beginAtZero: true,
            },
          },
        },
      })
    }
  }, [all, tipo, desde, hasta, visible])

  const filtered = all.filter((m) => {
    if (tipo !== 'ALL' && m.tipo !== tipo) return false
    return m.fecha >= desde && m.fecha <= hasta
  })

  const areas = [...new Set(filtered.map((x) => x.area))].sort()

  return (
    <div>
      <div className="card mb-3">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-900">Tendencias de Transporte</h2>
          <div className="flex gap-2">
            {[4, 8, 12].map((n) => (
              <button
                key={n}
                onClick={() => setSem(n)}
                className="px-3 py-1.5 text-xs font-semibold border rounded-lg border-gray-300 bg-white text-gray-600 hover:border-primary-500 hover:text-primary-600"
              >
                {n} sem
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="input-base text-xs w-auto"
            >
              <option value="ALL">Salida + Ingreso</option>
              <option value="SALIDA">Solo Salida</option>
              <option value="RECOJO">Solo Ingreso</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="input-base text-xs w-auto"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="input-base text-xs w-auto"
            />
          </div>
        </div>
      </div>

      {areas.length > 0 && (
        <div className="card mb-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Áreas visibles
          </p>
          <div className="flex gap-2 flex-wrap">
            {areas.map((a, i) => {
              const col = AREA_COLORS[i % AREA_COLORS.length]
              const off = visible[a] === false
              return (
                <button
                  key={a}
                  onClick={() => toggleArea(a)}
                  style={{ background: col + '18', borderColor: col, color: col }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border-2 transition-opacity ${
                    off ? 'opacity-30' : 'opacity-100'
                  }`}
                >
                  <div style={{ background: col }} className="w-2 h-2 rounded-full" />
                  {a}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="card mb-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          PERSONAS POR SEMANA
        </p>
        {areas.length === 0 ? (
          <p className="text-center py-10 text-gray-400 text-sm">
            Sin datos en el período seleccionado
          </p>
        ) : (
          <div style={{ height: 220 }}>
            <canvas ref={lineRef} />
          </div>
        )}
      </div>

      <div className="card">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          ACUMULADO POR ÁREA
        </p>
        {areas.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Sin datos</p>
        ) : (
          <div style={{ height: 180 }}>
            <canvas ref={barRef} />
          </div>
        )}
      </div>
    </div>
  )
}
