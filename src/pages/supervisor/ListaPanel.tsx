import { useAuth } from '../../hooks/useAuth'
import type { TipoProgram } from '../../types'
import { getIdx, getProgramData, isDiaCerrado } from '../../utils/storage'
import { AGK, AGR, ALLP, RUTAS, getRid } from '../../utils/constants'

interface Props {
  tipo: TipoProgram
  refresh: number
  onBack: () => void
  onNew: () => void
  onEdit: (key: string, tipo: TipoProgram, hor: string, area: string) => void
}

export default function ListaPanel({ tipo, refresh: _r, onBack, onNew, onEdit }: Props) {
  const { usuario } = useAuth()
  const today = new Date().toISOString().slice(0, 10)
  const bloq = isDiaCerrado(today)
  const idx = getIdx().filter(x => x.user === usuario?.username && x.tipo === tipo)

  if (!usuario) return null

  const verReporte = (m: typeof idx[0]) => {
  const fData = getProgramData(m.key)
  const getCellKey = (rid: string, p: string) => `${rid}||${p}`
  const fecha = new Date().toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
  const color = tipo === 'SALIDA' ? '#d97706' : '#2563eb'
  const colorLight = tipo === 'SALIDA' ? '#fef3c7' : '#dbeafe'
  const tipoLabel = tipo === 'SALIDA' ? 'SALIDA' : 'RECOJO'

  const totPar: Record<string, number> = {}
  ALLP.forEach(({ p }) => { totPar[p] = 0 })
  ALLP.forEach(({ p }) => {
    Object.keys(RUTAS).forEach(r => {
      RUTAS[r].forEach(f => {
        totPar[p] += fData[getCellKey(getRid(r, f), p)] || 0
      })
    })
  })
  const grandTotal = Object.values(totPar).reduce((a, b) => a + b, 0)

  const th = (extra = '') => `background:#1a7a3c;color:white;padding:4px 6px;font-size:9px;text-align:center;border:1px solid #155e30;${extra}`
  const td = (extra = '') => `padding:3px 5px;font-size:9px;border:1px solid #e5e7eb;text-align:center;${extra}`
  const tdL = (extra = '') => `padding:3px 5px;font-size:9px;border:1px solid #e5e7eb;text-align:left;white-space:nowrap;${extra}`

  const agHeaders = AGK.map(ag =>
    `<th colspan="${AGR[ag].length}" style="${th('min-width:40px')}">${ag}</th>`
  ).join('')

  const parHeaders = ALLP.map(({ ag, p }, i) => {
    const bl = i > 0 && ALLP[i-1].ag !== ag ? 'border-left:2px solid #0f4f28;' : ''
    return `<th style="${th(bl + 'width:26px;height:110px;padding:0;vertical-align:middle;text-align:center')}">
      <div style="display:table;width:26px;height:110px;">
        <div style="display:table-cell;vertical-align:middle;text-align:center;">
          <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;line-height:1.2;word-break:break-word;white-space:normal;width:14px;display:inline-block;text-align:center;">${p}</span>
        </div>
      </div>
    </th>`
  }).join('')

  // Pre-calcular filas visibles por ruta
  type FilaVis = { ruta: string; lote: string; com: string; lbl: string; rid: string; rs: number }
  const filasVis: FilaVis[] = []
  Object.entries(RUTAS).forEach(([ruta, filas]) => {
    filas.forEach(fila => {
      const rid = getRid(ruta, fila)
      const rs = ALLP.reduce((a, { p }) => a + (fData[getCellKey(rid, p)] || 0), 0)
      if (rs > 0) {
        filasVis.push({
          ruta,
          lote: fila.lbl ? '' : String(fila.l ?? ''),
          com: fila.lbl ? '' : String(fila.c ?? ''),
          lbl: fila.lbl ?? '',
          rid, rs
        })
      }
    })
  })

  // Calcular rowSpan por ruta
  const rutaSpan: Record<string, number> = {}
  filasVis.forEach(f => { rutaSpan[f.ruta] = (rutaSpan[f.ruta] || 0) + 1 })
  const rutaRendered = new Set<string>()

  const dataRows = filasVis.map(fila => {
    const isFirst = !rutaRendered.has(fila.ruta)
    if (isFirst) rutaRendered.add(fila.ruta)
    const rutaCell = isFirst
      ? `<td rowspan="${rutaSpan[fila.ruta]}" style="${td('font-weight:700;color:#2563eb;vertical-align:middle;background:#eff6ff')}">${fila.ruta}</td>`
      : ''
    const loteComCell = fila.lbl
      ? `<td colspan="2" style="${td('text-align:left;color:#6b7280;font-style:italic')}">${fila.lbl}</td>`
      : `<td style="${td()}">${fila.lote}</td><td style="${td()}">${fila.com}</td>`
    const totalCell = `<td style="${td('font-weight:700;' + (fila.rs > 0 ? 'color:#059669;' : 'color:#d1d5db;') + 'border-right:2px solid #e5e7eb;')}">${fila.rs || ''}</td>`
    const parCells = ALLP.map(({ ag, p }, i) => {
      const v = fData[getCellKey(fila.rid, p)] || 0
      const bl = i > 0 && ALLP[i-1].ag !== ag ? 'border-left:2px solid #d1fae5;' : ''
      const bg = i % 2 === 0 ? '' : 'background:#f9fafb;'
      return `<td style="${td(bl + bg + (v ? 'font-weight:600;' : 'color:#d1d5db;'))}">${v || ''}</td>`
    }).join('')
    return `<tr>${rutaCell}${loteComCell}${totalCell}${parCells}</tr>`
  }).join('')

  const totalRow = `<tr>
    <td colspan="3" style="${tdL('font-weight:800;color:#14532d;background:#bbf7d0')}">TOTAL</td>
    <td style="${td('font-weight:800;color:#14532d;background:#bbf7d0;border-right:2px solid #6ee7b7')}">${grandTotal}</td>
    ${ALLP.map(({ ag, p }, i) => {
      const v = totPar[p] || 0
      const bl = i > 0 && ALLP[i-1].ag !== ag ? 'border-left:2px solid #6ee7b7;' : ''
      return `<td style="${td('font-weight:700;color:#14532d;background:#bbf7d0;' + bl)}">${v || ''}</td>`
    }).join('')}
  </tr>`

  const html = `<html><head><meta charset="utf-8">
  <style>
    body{font-family:Arial,sans-serif;font-size:9px;margin:16px;background:white}
    @media print{body{margin:8px} @page{size:landscape;margin:10mm}}
  </style>
  </head><body>
    <div id="reporte">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <div>
      <h2 style="margin:0 0 4px;font-size:13px;font-weight:800">Distribución de personal en los paraderos</h2>
      <span style="font-size:11px;font-weight:700;color:${color};padding:2px 10px;background:${colorLight};border-radius:4px;border:1px solid ${color}">${tipoLabel}</span>
    </div>
    <div style="text-align:right">
      <span style="font-size:10px;color:#555">Fecha: ${fecha}</span><br>
      <span style="font-size:10px;color:#555">Supervisor: ${usuario.nombre} — ${m.area}</span>
    </div>
  </div>
  <div style="margin:8px 0 10px;padding:8px 14px;background:${colorLight};border-left:4px solid ${color};border-radius:4px;display:inline-block">
    <span style="font-size:15px;font-weight:800;color:${color}">${m.hor}</span>
  </div>
      </div>
      <table style="border-collapse:collapse;width:100%;font-size:9px">
        <thead>
          <tr>
            <th style="${th('min-width:35px')}" rowspan="2">RUTA</th>
            <th style="${th('min-width:25px')}" rowspan="2">LOTE</th>
            <th style="${th('min-width:25px')}" rowspan="2">COM</th>
            <th style="${th('min-width:35px;border-right:2px solid #6ee7b7')}" rowspan="2">TOTAL</th>
            ${agHeaders}
          </tr>
          <tr>${parHeaders}</tr>
        </thead>
        <tbody>${dataRows}${totalRow}</tbody>
      </table>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button onclick="window.print()" style="padding:8px 20px;background:#1a7a3c;color:white;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">🖨 Imprimir</button>
      <button onclick="descargarJpeg()" style="padding:8px 20px;background:#2563eb;color:white;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">📷 Descargar JPEG</button>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script>
      function descargarJpeg() {
        const el = document.getElementById('reporte')
        html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
          const link = document.createElement('a')
          link.download = 'reporte_${tipoLabel.toLowerCase()}_${fecha.replace(/\//g,'-')}.jpg'
          link.href = canvas.toDataURL('image/jpeg', 0.95)
          link.click()
        })
      }
    </script>
  </body></html>`

  const win = window.open('', '_blank', 'width=1400,height=900')
  if (win) { win.document.write(html); win.document.close(); win.focus() }
}

  return (
    <div>
      <div className="flex items-center gap-2 py-2 mb-2">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 font-medium hover:text-gray-800">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Inicio
        </button>
      </div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">
          {tipo === 'SALIDA' ? 'Salida — hacia el campo' : 'Recojo — desde el campo'}
        </h2>
        <button onClick={onNew} disabled={bloq} className="btn-primary text-xs py-1.5 px-3 disabled:bg-gray-300">
          {bloq ? '🔒 Cerrado' : '+ Nueva'}
        </button>
      </div>
      {idx.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          <p className="mb-3">Sin programaciones aún</p>
          {!bloq && <button onClick={onNew} className="btn-primary text-xs">+ Nueva programación</button>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {idx.map(m => (
            <div key={m.key} className="card border border-gray-100">
              <div
                onClick={() => onEdit(m.key, m.tipo as TipoProgram, m.hor, m.area)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className={m.tipo === 'SALIDA' ? 'badge-salida' : 'badge-recojo'}>{m.tipo}</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900">{m.area}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.hor}</p>
                </div>
                <span className="text-sm font-bold text-green-600">{m.total}</span>
                <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M9 18l6-6-6-6"/></svg>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-50">
                <button
                  onClick={() => verReporte(m)}
                  className="w-full text-xs font-semibold py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all"
                >
                  📊 Ver reporte
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}