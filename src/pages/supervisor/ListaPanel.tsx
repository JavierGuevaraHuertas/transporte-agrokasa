import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { TipoProgram } from '../../types'
import {
  getDia,
  getProgramacionesByUser,
  getProgramacionDetalle,
  deleteProgramacion,
} from '../../lib/api'
import { ALLP, AGR, AGK } from '../../utils/constants'
import type { Programacion } from '../../lib/database.types'

interface Props {
  tipo: TipoProgram
  refresh: number
  onBack: () => void
  onNew: () => void
  onEdit: (key: string, tipo: TipoProgram, hor: string, area: string) => void
}

export default function ListaPanel({ tipo, refresh, onBack, onNew, onEdit }: Props) {
  const { usuario } = useAuth()
  const today = new Date().toISOString().slice(0, 10)

  const [bloq, setBloq] = useState(false)
  const [items, setItems] = useState<Programacion[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmItem, setConfirmItem] = useState<Programacion | null>(null)

  useEffect(() => {
    let active = true

    async function cargar() {
      if (!usuario) return

      try {
        setLoading(true)

        const [dia, progs] = await Promise.all([
          getDia(today),
          getProgramacionesByUser(usuario.id, today),
        ])

        if (!active) return

        setBloq(dia?.estado === 'cerrado')
        setItems(progs.filter((x) => x.tipo === tipo))
      } catch (e) {
        console.error('Error cargando programaciones:', e)
        if (!active) return
        setBloq(false)
        setItems([])
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    void cargar()

    return () => { active = false }
  }, [usuario, today, tipo, refresh])

  if (!usuario) return null

  const confirmarEliminar = (m: Programacion) => setConfirmItem(m)

  const eliminar = async () => {
    if (!confirmItem) return
    const m = confirmItem
    setConfirmItem(null)
    try {
      setDeletingId(m.id)
      await deleteProgramacion(m.id)
      setItems((prev) => prev.filter((x) => x.id !== m.id))
    } catch (e) {
      console.error('Error eliminando:', e)
    } finally {
      setDeletingId(null)
    }
  }

  const verReporte = async (m: Programacion) => {
    try {
      const detalle = await getProgramacionDetalle(m.id)
      const detalleConDatos = detalle.filter((row) => (row.cantidad ?? 0) > 0)

      const fecha = new Date().toLocaleDateString('es-PE', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit',
      })

      const color = tipo === 'SALIDA' ? '#d97706' : '#2563eb'
      const colorLight = tipo === 'SALIDA' ? '#fef3c7' : '#dbeafe'

      const paraderosUsados = ALLP.map(({ p }) => p).filter((p) =>
        detalleConDatos.some((row) => row.paradero === p)
      )
      const agrupUsados = AGK.filter((ag) =>
        AGR[ag].some((p) => paraderosUsados.includes(p))
      )

      type FilaResumen = { orden: number; loteComedor: string; paraderos: Record<string, number>; total: number }
      const filasMap = new Map<string, FilaResumen>()

      detalleConDatos.forEach((row, index) => {
        const comedor = Number(row.comedor ?? 0)
        const loteComedor = row.fila_label
          ? row.fila_label
          : comedor > 0 ? `L${row.lote ?? ''} - C${comedor}` : `L${row.lote ?? ''}`

        if (!filasMap.has(loteComedor)) {
          filasMap.set(loteComedor, { orden: index, loteComedor, paraderos: {}, total: 0 })
        }
        const fila = filasMap.get(loteComedor)
        if (!fila) return
        fila.paraderos[row.paradero] = (fila.paraderos[row.paradero] || 0) + (row.cantidad ?? 0)
        fila.total += row.cantidad ?? 0
      })

      const filas = Array.from(filasMap.values()).sort((a, b) => a.orden - b.orden)
      const grandTotal = filas.reduce((sum, fila) => sum + fila.total, 0)

      const th = (extra = '') =>
        `background:#1a7a3c;color:white;padding:8px 10px;font-size:12px;text-align:center;border:1px solid #155e30;font-weight:800;${extra}`
      const td = (extra = '') =>
        `padding:7px 10px;font-size:12px;border:1px solid #e5e7eb;text-align:center;font-weight:700;${extra}`

      const agrupHeaderCells = agrupUsados.map((ag) => {
        const cols = AGR[ag].filter((p) => paraderosUsados.includes(p)).length
        return `<th colspan="${cols}" style="${th('border-bottom:1px solid #155e30;letter-spacing:0.5px;font-size:11px;background:#155e30;vertical-align:bottom;padding-bottom:6px;')}">${ag}</th>`
      }).join('')

      const dataRows = filas.map((fila, idx) => {
        const bg = idx % 2 === 0 ? 'background:#ffffff;' : 'background:#f9fafb;'
        const parCells = paraderosUsados.map((p) => {
          const v = fila.paraderos[p] || 0
          return `<td style="${td(bg + (v ? 'color:#111827;' : 'color:#d1d5db;'))}">${v || ''}</td>`
        }).join('')
        return `<tr>
          <td style="${td(bg + 'color:#374151;white-space:nowrap;')}">${fila.loteComedor}</td>
          ${parCells}
          <td style="${td(bg + 'font-weight:900;color:#059669;border-left:2px solid #d1fae5;')}">${fila.total}</td>
        </tr>`
      }).join('')

      const totalRow = `<tr>
        <td style="${td('font-weight:900;color:#14532d;background:#bbf7d0;text-align:center;')}">TOTAL</td>
        ${paraderosUsados.map((p) => {
          const v = filas.reduce((sum, fila) => sum + (fila.paraderos[p] || 0), 0)
          return `<td style="${td('font-weight:900;color:#14532d;background:#bbf7d0;')}">${v || ''}</td>`
        }).join('')}
        <td style="${td('font-weight:900;color:#14532d;background:#bbf7d0;border-left:2px solid #6ee7b7;')}">${grandTotal}</td>
      </tr>`

      const html = `<html><head><meta charset="utf-8">
      <style>
        body{font-family:Arial,sans-serif;margin:0;background:#f3f4f6;color:#111827;padding:24px}
        .image-card{background:#fff;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(15,23,42,.12);max-width:1200px;margin:0 auto}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:16px}
        .meta{text-align:right;font-size:12px;color:#555;line-height:1.45}
        table{border-collapse:collapse;width:100%;font-size:12px;border-radius:12px;overflow:hidden}
        @media print{body{background:#fff;padding:8px}.image-card{box-shadow:none;border-radius:0}@page{size:landscape;margin:10mm}}
      </style>
      </head><body>
        <div class="image-card">
          <div class="header">
            <div><h2 style="margin:0 0 6px;font-size:18px;font-weight:800">Programación de Transporte — ${tipo === 'SALIDA' ? 'SALIDA' : 'INGRESO'}</h2></div>
            <div class="meta">Fecha: ${fecha}<br>Supervisor: ${usuario.nombre}</div>
          </div>
          <div style="margin:10px 0 14px;padding:9px 14px;background:${colorLight};border-left:4px solid ${color};border-radius:8px;display:inline-block">
            <span style="font-size:15px;font-weight:900;color:${color}">${m.horario_label}</span>
            <span style="font-size:13px;font-weight:700;color:${color};margin-left:10px;opacity:0.8">${m.area}</span>
          </div>
          ${filas.length === 0 ? `
            <div style="padding:28px;text-align:center;background:#f9fafb;border-radius:12px;color:#6b7280;font-size:14px;font-weight:700">
              No hay personas programadas para mostrar.
            </div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th style="${th('min-width:150px')}" rowspan="2">Lote / Comedor</th>
                  ${agrupHeaderCells}
                  <th style="${th('min-width:70px;border-left:2px solid #6ee7b7')}" rowspan="2">Total</th>
                </tr>
                <tr>
                  ${paraderosUsados.map((p) => `<th style="${th('width:50px;min-width:50px;max-width:50px;padding:4px 2px;font-weight:600;font-size:10px;vertical-align:bottom;')}"><div style="text-align:center;line-height:1.4;font-size:10px;">${p.split(' ').join('<br>')}</div></th>`).join('')}
                </tr>
              </thead>
              <tbody>${dataRows}${totalRow}</tbody>
            </table>
          `}
        </div>
      </body></html>`

      const win = window.open('', '_blank', 'width=1200,height=800')
      if (win) { win.document.write(html); win.document.close(); win.focus() }
    } catch (e) {
      console.error('Error generando reporte:', e)
    }
  }

  const descargarReporte = async (m: Programacion) => {
    try {
      const detalle = await getProgramacionDetalle(m.id)
      const detalleConDatos = detalle.filter((row) => (row.cantidad ?? 0) > 0)

      const fecha = new Date().toLocaleDateString('es-PE', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit',
      })

      const color = tipo === 'SALIDA' ? '#d97706' : '#2563eb'
      const colorLight = tipo === 'SALIDA' ? '#fef3c7' : '#dbeafe'

      const paraderosUsados = ALLP.map(({ p }) => p).filter((p) =>
        detalleConDatos.some((row) => row.paradero === p)
      )
      const agrupUsados = AGK.filter((ag) =>
        AGR[ag].some((p) => paraderosUsados.includes(p))
      )

      type FilaResumen = { orden: number; loteComedor: string; paraderos: Record<string, number>; total: number }
      const filasMap = new Map<string, FilaResumen>()
      detalleConDatos.forEach((row, index) => {
        const comedor = Number(row.comedor ?? 0)
        const loteComedor = row.fila_label ? row.fila_label : comedor > 0 ? `L${row.lote ?? ''} - C${comedor}` : `L${row.lote ?? ''}`
        if (!filasMap.has(loteComedor)) filasMap.set(loteComedor, { orden: index, loteComedor, paraderos: {}, total: 0 })
        const fila = filasMap.get(loteComedor)!
        fila.paraderos[row.paradero] = (fila.paraderos[row.paradero] || 0) + (row.cantidad ?? 0)
        fila.total += row.cantidad ?? 0
      })
      const filas = Array.from(filasMap.values()).sort((a, b) => a.orden - b.orden)
      const grandTotal = filas.reduce((sum, fila) => sum + fila.total, 0)

      const th = (extra = '') => `background:#1a7a3c;color:white;padding:8px 10px;font-size:12px;text-align:center;border:1px solid #155e30;font-weight:800;${extra}`
      const td = (extra = '') => `padding:7px 10px;font-size:12px;border:1px solid #e5e7eb;text-align:center;font-weight:700;${extra}`

      const agrupHeaderCells = agrupUsados.map((ag) => {
        const cols = AGR[ag].filter((p) => paraderosUsados.includes(p)).length
        return `<th colspan="${cols}" style="${th('border-bottom:1px solid #155e30;font-size:11px;background:#155e30;vertical-align:bottom;padding-bottom:6px;')}">${ag}</th>`
      }).join('')

      const dataRows = filas.map((fila, idx) => {
        const bg = idx % 2 === 0 ? 'background:#ffffff;' : 'background:#f9fafb;'
        const parCells = paraderosUsados.map((p) => {
          const v = fila.paraderos[p] || 0
          return `<td style="${td(bg + (v ? 'color:#111827;' : 'color:#d1d5db;'))}">${v || ''}</td>`
        }).join('')
        return `<tr><td style="${td(bg + 'color:#374151;white-space:nowrap;')}">${fila.loteComedor}</td>${parCells}<td style="${td(bg + 'font-weight:900;color:#059669;border-left:2px solid #d1fae5;')}">${fila.total}</td></tr>`
      }).join('')

      const totalRow = `<tr><td style="${td('font-weight:900;color:#14532d;background:#bbf7d0;')}">TOTAL</td>${paraderosUsados.map((p) => {
        const v = filas.reduce((sum, fila) => sum + (fila.paraderos[p] || 0), 0)
        return `<td style="${td('font-weight:900;color:#14532d;background:#bbf7d0;')}">${v || ''}</td>`
      }).join('')}<td style="${td('font-weight:900;color:#14532d;background:#bbf7d0;')}">${grandTotal}</td></tr>`

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
      <style>
        body{font-family:Arial,sans-serif;margin:0;background:#ffffff;padding:24px}
        table{border-collapse:collapse;width:100%;font-size:12px}
      </style>
      </head><body>
        <div id="reporte" style="background:#fff;border-radius:16px;padding:18px;max-width:1200px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <h2 style="margin:0 0 6px;font-size:18px;font-weight:800">Programación de Transporte — ${tipo === 'SALIDA' ? 'SALIDA' : 'INGRESO'}</h2>
            <div style="text-align:right;font-size:12px;color:#555;line-height:1.45">Fecha: ${fecha}<br>Supervisor: ${usuario!.nombre}</div>
          </div>
          <div style="margin:10px 0 14px;padding:9px 14px;background:${colorLight};border-left:4px solid ${color};border-radius:8px;display:inline-block">
            <span style="font-size:15px;font-weight:900;color:${color}">${m.horario_label}</span>
            <span style="font-size:13px;font-weight:700;color:${color};margin-left:10px;opacity:0.8">${m.area}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="${th('min-width:150px')}" rowspan="2">Lote / Comedor</th>
                ${agrupHeaderCells}
                <th style="${th('min-width:70px;border-left:2px solid #6ee7b7')}" rowspan="2">Total</th>
              </tr>
              <tr>
                ${paraderosUsados.map((p) => `<th style="${th('width:50px;min-width:50px;max-width:50px;padding:4px 2px;font-weight:600;font-size:10px;vertical-align:bottom;')}"><div style="text-align:center;line-height:1.4;font-size:10px;">${p.split(' ').join('<br>')}</div></th>`).join('')}
              </tr>
            </thead>
            <tbody>${dataRows}${totalRow}</tbody>
          </table>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              var el = document.getElementById('reporte');
              html2canvas(el, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: el.scrollWidth + 48,
                width: el.scrollWidth,
              }).then(function(canvas) {
                const link = document.createElement('a')
                link.download = 'reporte_${m.horario_label.replace(/[^a-z0-9]/gi, '_')}_${m.area.replace(/[^a-z0-9]/gi, '_')}.jpg'
                link.href = canvas.toDataURL('image/jpeg', 0.95)
                link.click()
                window.close()
              })
            }, 1200)
          }
        <\/script>
      </body></html>`

      const win = window.open('', '_blank', 'width=1400,height=900')
      if (win) { win.document.write(html); win.document.close() }
    } catch (e) {
      console.error('Error descargando reporte:', e)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 py-2 mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-500 font-medium hover:text-gray-800"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Volver al inicio
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">
          {tipo === 'SALIDA' ? 'Salida' : 'Ingreso'}
        </h2>
        <button
          onClick={onNew}
          disabled={bloq}
          className="btn-primary text-xs py-1.5 px-3 disabled:bg-gray-300"
        >
          {bloq ? '🔒 Cerrado' : '+ Nueva'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          <p>Cargando programaciones...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          <p className="mb-3">Sin programaciones aún</p>
          {!bloq && (
            <button onClick={onNew} className="btn-primary text-xs">
              + Nueva programación
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((m) => (
            <div key={m.id} className="card border border-gray-100">
              <div className="flex items-center gap-2">
                <div
                  onClick={() => onEdit(m.id, m.tipo as TipoProgram, m.horario_id, m.area)}
                  className="flex items-center gap-2 flex-1 cursor-pointer"
                >
                  <span className={m.tipo === 'SALIDA' ? 'badge-salida' : 'badge-recojo'}>
                    {m.tipo === 'SALIDA' ? 'SALIDA' : 'INGRESO'}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-900">{m.horario_label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.area}</p>
                  </div>
                  <span className="text-sm font-bold text-green-600">{m.total}</span>
                  <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>

                {!bloq && (
                  <button
                    onClick={() => confirmarEliminar(m)}
                    disabled={deletingId === m.id}
                    className="ml-1 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                    title="Eliminar programación"
                  >
                    {deletingId === m.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-gray-50 flex gap-2">
                <button
                  onClick={() => void verReporte(m)}
                  className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all"
                >
                  📊 Ver reporte
                </button>
                <button
                  onClick={() => void descargarReporte(m)}
                  className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-green-300 text-green-600 hover:bg-green-50 transition-all"
                >
                  ⬇️ Descargar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Eliminar programación</p>
                <p className="text-xs text-gray-400 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 mb-4">
              <p className="text-xs font-semibold text-gray-700">{confirmItem.horario_label}</p>
              <p className="text-xs text-gray-400">{confirmItem.area} · {confirmItem.total} personas</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmItem(null)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => void eliminar()}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
