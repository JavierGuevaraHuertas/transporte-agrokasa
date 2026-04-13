import { useState, useEffect } from 'react'
import Modal from '../../components/Modal'
import { ALLP, AGK, AGR } from '../../utils/constants'
import { getAllProgs, isDiaCerrado, setDiaEstado } from '../../utils/storage'
import { exportToCSV } from '../../utils/export'
import { getAllUsuarios } from '../../lib/api'

interface Supervisor { id: string; username: string; nombre: string; rol: string }

interface Props {
  refresh: number
  onDiaChange: () => void
  showToast: (msg: string, type: 'ok' | 'warn' | 'err') => void
}

export default function DashboardPanel({ refresh: _r, onDiaChange, showToast }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [modal, setModal] = useState(false)
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const cerrado = isDiaCerrado(date)
  const all = getAllProgs()

  useEffect(() => {
    getAllUsuarios()
      .then(data => setSupervisores(data.filter((u: Supervisor) => u.rol === 'supervisor')))
      .catch(() => {})
  }, [])

  const sal = all.filter(x => x.tipo === 'SALIDA').reduce((a, x) => a + (x.total || 0), 0)
  const rec = all.filter(x => x.tipo === 'RECOJO').reduce((a, x) => a + (x.total || 0), 0)
  const areas = new Set(all.map(x => x.area)).size
  const conDatos = new Set(all.map(x => x.user)).size
  const sinDatos = supervisores.length - conDatos

  const handleToggleDia = () => setModal(true)
  const confirmToggle = () => {
    setDiaEstado(date, cerrado ? 'abierto' : 'cerrado')
    onDiaChange()
    showToast(cerrado ? 'Día reabierto' : 'Día cerrado — supervisores bloqueados', cerrado ? 'ok' : 'warn')
    setModal(false)
  }

  const buildReporteData = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const supMap: Record<string, string> = {}
    supervisores.forEach(s => { supMap[s.username] = s.nombre })
    const allFiltrado = all.filter(m => m.tipo === filtroTipo)
    type Fila = { sup: string; area: string; hor: string; data: Record<string, number>; total: number }
    const grupos: Record<string, Fila[]> = {}
    allFiltrado.forEach(m => {
      const hor = m.hor
      if (!grupos[hor]) grupos[hor] = []
      const data: Record<string, number> = {}
      ALLP.forEach(({ p }) => {
        let s = 0
        Object.keys(m.data).forEach(ck => { if (ck.endsWith('||' + p)) s += (m.data[ck] || 0) })
        if (s > 0) data[p] = s
      })
      const total = Object.values(data).reduce((a, b) => a + b, 0)
      grupos[hor].push({ sup: supMap[m.user] || m.user, area: m.area, hor, data, total })
    })
    const totPar: Record<string, number> = {}
    ALLP.forEach(({ p }) => { totPar[p] = 0 })
    allFiltrado.forEach(m => ALLP.forEach(({ p }) => {
      Object.keys(m.data).forEach(ck => { if (ck.endsWith('||' + p)) totPar[p] += (m.data[ck] || 0) })
    }))
    const grandTotal = Object.values(totPar).reduce((a, b) => a + b, 0)
    return { grupos, totPar, grandTotal }
  }

  const buildTablaHtml = (
    filtroTipo: 'SALIDA' | 'RECOJO',
    fontSize: string,
    thFn: (e?: string) => string,
    tdFn: (e?: string) => string,
    tdLFn: (e?: string) => string,
    parHeadersFn: (thFn: (e?: string) => string) => string
  ) => {
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'RECOJO'
    const { grupos, totPar, grandTotal } = buildReporteData(filtroTipo)

    const agHeaders = AGK.map(ag =>
      `<th colspan="${AGR[ag].length}" style="${thFn('min-width:40px')}">${ag}</th>`
    ).join('')
    const parHeaders = parHeadersFn(thFn)

    // Tabla principal — solo datos sin subtotales
    const bodyRows = Object.entries(grupos).map(([_hor, filas]) =>
      filas.map((f, fi) =>
        `<tr>
          ${fi === 0 ? `<td rowspan="${filas.length}" style="${tdLFn('font-weight:600;vertical-align:middle;background:#f9fafb')}">${f.hor}</td>` : ''}
          <td style="${tdLFn()}">${f.sup}</td>
          <td style="${tdLFn()}">${f.area}</td>
          ${ALLP.map(({ ag, p }, i) => {
            const v = f.data[p] || 0
            const bl = i > 0 && ALLP[i-1].ag !== ag ? 'border-left:2px solid #d1fae5;' : ''
            return `<td style="${tdFn(bl + (v ? '' : 'color:#d1d5db;'))}">${v || ''}</td>`
          }).join('')}
          <td style="${tdFn('font-weight:700;color:#059669;border-left:2px solid #d1d5db;background:#f0fdf4')}">${f.total || ''}</td>
        </tr>`
      ).join('')
    ).join('')

    const totalRow = `<tr>
      <td colspan="3" style="${tdLFn('font-weight:800;color:#14532d;background:#bbf7d0')}">TOTAL</td>
      ${ALLP.map(({ ag, p }, i) => {
        const v = totPar[p] || 0
        const bl = i > 0 && ALLP[i-1].ag !== ag ? 'border-left:2px solid #6ee7b7;' : ''
        return `<td style="${tdFn('font-weight:700;color:#14532d;background:#bbf7d0;' + bl)}">${v || ''}</td>`
      }).join('')}
      <td style="${tdFn('font-weight:800;color:#14532d;background:#86efac;border-left:2px solid #aaa')}">${grandTotal}</td>
    </tr>`

    // Tabla de subtotales por horario
    const subParHeaders = ALLP.map(({ ag, p }, i) => {
      const bl = i > 0 && ALLP[i-1].ag !== ag ? 'border-left:2px solid #0f4f28;' : ''
      return `<th style="${thFn(bl + 'width:26px;height:70px;padding:0;vertical-align:middle;text-align:center')}">
        <div style="display:table;width:26px;height:70px;">
          <div style="display:table-cell;vertical-align:middle;text-align:center;">
            <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:${fontSize};line-height:1.2;word-break:break-word;white-space:normal;width:14px;display:inline-block;text-align:center;">${p}</span>
          </div>
        </div>
      </th>`
    }).join('')

    const subRows = Object.entries(grupos).map(([_hor, filas]) => {
      const horTotal = filas.reduce((a, f) => a + f.total, 0)
      const horPar: Record<string, number> = {}
      ALLP.forEach(({ p }) => { horPar[p] = 0 })
      filas.forEach(f => ALLP.forEach(({ p }) => { horPar[p] += (f.data[p] || 0) }))
      return `<tr style="background:#f0fdf4">
        <td style="${tdLFn('font-weight:700;color:#065f46')}">${filas[0].hor}</td>
        <td style="${tdFn('font-weight:700;color:#065f46')}">${horTotal}</td>
        ${ALLP.map(({ ag, p }, i) => {
          const v = horPar[p] || 0
          const bl = i > 0 && ALLP[i-1].ag !== ag ? 'border-left:2px solid #6ee7b7;' : ''
          return `<td style="${tdFn(bl + (v ? 'font-weight:600;color:#065f46;' : 'color:#d1d5db;'))}">${v || ''}</td>`
        }).join('')}
      </tr>`
    }).join('')

    const subTotalRow = `<tr style="background:#bbf7d0">
      <td style="${tdLFn('font-weight:800;color:#14532d')}">TOTAL</td>
      <td style="${tdFn('font-weight:800;color:#14532d')}">${grandTotal}</td>
      ${ALLP.map(({ ag, p }, i) => {
        const v = totPar[p] || 0
        const bl = i > 0 && ALLP[i-1].ag !== ag ? 'border-left:2px solid #6ee7b7;' : ''
        return `<td style="${tdFn('font-weight:700;color:#14532d;' + bl)}">${v || ''}</td>`
      }).join('')}
    </tr>`

    return `
      <table style="border-collapse:collapse;width:100%;font-size:${fontSize}">
        <thead>
          <tr>
            <th style="${thFn('min-width:80px')}" rowspan="2">HORARIO</th>
            <th style="${thFn('min-width:90px')}" rowspan="2">RESPONSABLE</th>
            <th style="${thFn('min-width:110px')}" rowspan="2">ÁREA</th>
            ${agHeaders}
            <th style="${thFn()}" rowspan="2">TOTAL</th>
          </tr>
          <tr>${parHeaders}</tr>
        </thead>
        <tbody>${bodyRows}${totalRow}</tbody>
      </table>

      <div style="margin-top:20px">
        <p style="font-size:${fontSize};font-weight:700;color:#14532d;margin-bottom:6px">
          RESUMEN POR HORARIO — ${tipoLabel}: ${grandTotal} personas
        </p>
        <table style="border-collapse:collapse;font-size:${fontSize}">
          <thead>
            <tr>
              <th style="${thFn('min-width:80px')}">HORARIO</th>
              <th style="${thFn('min-width:50px')}">TOTAL</th>
              ${AGK.map(ag => `<th colspan="${AGR[ag].length}" style="${thFn()}">${ag}</th>`).join('')}
            </tr>
            <tr>
              <th style="${thFn()}"></th>
              <th style="${thFn()}"></th>
              ${subParHeaders}
            </tr>
          </thead>
          <tbody>${subRows}${subTotalRow}</tbody>
        </table>
      </div>`
  }

  const exportarReporte = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const fecha = new Date().toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    const color = filtroTipo === 'SALIDA' ? '#d97706' : '#2563eb'
    const colorLight = filtroTipo === 'SALIDA' ? '#fef3c7' : '#dbeafe'
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'RECOJO'

    const th = (extra = '') => `background:#1a7a3c;color:white;padding:4px 6px;font-size:9px;text-align:center;border:1px solid #155e30;${extra}`
    const td = (extra = '') => `padding:3px 5px;font-size:9px;border:1px solid #e5e7eb;text-align:center;${extra}`
    const tdL = (extra = '') => `padding:3px 5px;font-size:9px;border:1px solid #e5e7eb;text-align:left;white-space:nowrap;${extra}`

    const parHeaders = (thFn: (e?: string) => string) => ALLP.map(({ ag, p }, i) => {
      const bl = i > 0 && ALLP[i-1].ag !== ag ? 'border-left:2px solid #0f4f28;' : ''
      return `<th style="${thFn(bl + 'width:26px;height:110px;padding:0;vertical-align:middle;text-align:center')}">
        <div style="display:table;width:26px;height:110px;">
          <div style="display:table-cell;vertical-align:middle;text-align:center;">
            <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;line-height:1.2;word-break:break-word;white-space:normal;width:14px;display:inline-block;text-align:center;">${p}</span>
          </div>
        </div>
      </th>`
    }).join('')

    const tabla = buildTablaHtml(filtroTipo, '9px', th, td, tdL, parHeaders)

    const html = `<html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;font-size:9px;margin:16px}
      @media print{body{margin:8px} @page{size:landscape;margin:10mm}}
    </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <h2 style="margin:0 0 4px;font-size:13px;font-weight:800">Distribución de personal en los paraderos</h2>
          <span style="font-size:11px;font-weight:700;color:${color};padding:2px 10px;background:${colorLight};border-radius:4px;border:1px solid ${color}">${tipoLabel}</span>
        </div>
        <span style="font-size:10px;color:#555">Fecha: ${fecha}</span>
      </div>
      ${tabla}
    </body></html>`

    const win = window.open('', '_blank', 'width=1400,height=900')
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 800) }
  }

  const exportarExcel = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const fecha = new Date().toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    const color = filtroTipo === 'SALIDA' ? '#d97706' : '#2563eb'
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'RECOJO'

    const thS = (extra = '') => `background:#1a7a3c;color:white;padding:4px 6px;font-size:9pt;text-align:center;border:1px solid #155e30;font-weight:bold;${extra}`
    const tdS = (extra = '') => `padding:3px 5px;font-size:9pt;border:1px solid #e5e7eb;text-align:center;${extra}`
    const tdL = (extra = '') => `padding:3px 5px;font-size:9pt;border:1px solid #e5e7eb;text-align:left;white-space:nowrap;${extra}`

    const parHeaders = (thFn: (e?: string) => string) => ALLP.map(({ ag, p }, i) => {
      const bl = i > 0 && ALLP[i-1].ag !== ag ? 'border-left:2px solid #0f4f28;' : ''
      return `<th style="${thFn(bl + 'width:30pt;height:80pt;vertical-align:bottom;text-align:center')}">
        <div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:8pt;white-space:normal;word-break:break-word;width:18pt;display:inline-block;text-align:center;">${p}</div>
      </th>`
    }).join('')

    const tabla = buildTablaHtml(filtroTipo, '9pt', thS, tdS, tdL, parHeaders)

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]><xml>
          <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
            <x:Name>Distribución ${tipoLabel}</x:Name>
            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
          </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
        </xml><![endif]-->
        <style>body{font-family:Arial,sans-serif;font-size:9pt;}table{border-collapse:collapse;}td,th{font-size:9pt;}</style>
      </head>
      <body>
        <h3 style="font-size:13pt;font-weight:800;margin-bottom:4px">
          Distribución de personal en los paraderos —
          <span style="color:${color}">${tipoLabel}</span>
        </h3>
        <p style="font-size:9pt;color:#555;margin-bottom:8px">Fecha: ${fecha}</p>
        ${tabla}
      </body></html>`

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_${tipoLabel.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xls`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const ResumenCard = ({ tipo }: { tipo: 'SALIDA' | 'RECOJO' }) => {
    const isSal = tipo === 'SALIDA'
    const mine = all.filter(x => x.tipo === tipo)
    const { grupos } = buildReporteData(tipo)

    return (
      <div className={`card border-2 ${isSal ? 'border-amber-100' : 'border-blue-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${isSal ? 'text-amber-600' : 'text-blue-600'}`}>
              {isSal ? '↑ SALIDA' : '↓ RECOJO'}
            </span>
          </div>
          <span className={`text-lg font-bold ${isSal ? 'text-amber-600' : 'text-blue-600'}`}>
            {mine.reduce((a, x) => a + (x.total || 0), 0)} pers.
          </span>
        </div>
        {Object.entries(grupos).map(([hor, filas]) => {
          const horTotal = filas.reduce((a, f) => a + f.total, 0)
          return (
            <div key={hor} className="mb-2">
              <div className={`text-xs font-semibold px-2 py-0.5 rounded mb-1 ${isSal ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                {hor} — {horTotal} pers.
              </div>
              {filas.map((f, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5 pl-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-600 flex-1">{f.sup}</span>
                  <span className="text-xs text-gray-400">{f.area}</span>
                  <span className={`text-xs font-bold ${isSal ? 'text-amber-600' : 'text-blue-600'}`}>{f.total}</span>
                </div>
              ))}
            </div>
          )
        })}
        <div className={`flex gap-2 mt-3 pt-2 border-t ${isSal ? 'border-amber-100' : 'border-blue-100'}`}>
          <button
            onClick={() => exportarReporte(tipo)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg text-white ${isSal ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            📊 Ver reporte
          </button>
          <button
            onClick={() => exportarExcel(tipo)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg text-white ${isSal ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-700 hover:bg-blue-800'}`}
          >
            📥 Descargar XLS
          </button>
        </div>
      </div>
    )
  }

  const CobCard = ({ tipo }: { tipo: 'SALIDA' | 'RECOJO' }) => {
    const mine = all.filter(x => x.tipo === tipo)
    const con = new Set(mine.map(x => x.user))
    const ok = supervisores.filter(s => con.has(s.username))
    const pend = supervisores.filter(s => !con.has(s.username))
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-600">{tipo === 'SALIDA' ? 'Salida' : 'Recojo'}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pend.length === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {pend.length === 0 ? '✓ Completo' : `${pend.length} pendientes`}
          </span>
        </div>
        {ok.map(s => {
          const tot = mine.filter(x => x.user === s.username).reduce((a, x) => a + (x.total || 0), 0)
          return (
            <div key={s.id} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-xs text-gray-700 flex-1">{s.nombre}</span>
              <span className="text-xs font-semibold text-green-600">{tot} pers.</span>
            </div>
          )
        })}
        {pend.map(s => (
          <div key={s.id} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
            <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
            <span className="text-xs text-gray-500 flex-1">{s.nombre}</span>
            <span className="text-xs text-gray-400">Sin registro</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="card mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900">Panel Administrador</h2>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cerrado ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {cerrado ? '🔒 Día cerrado' : '🔓 Día abierto'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-base w-auto text-xs" />
          <button onClick={() => exportToCSV(all)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
            ⬇ CSV
          </button>
          <button
            onClick={handleToggleDia}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-white ${cerrado ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {cerrado ? '🔓 Reabrir día' : '🔒 Cerrar día'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Total Salida',     value: sal,        cls: 'text-amber-600' },
          { label: 'Total Recojo',     value: rec,        cls: 'text-blue-600'  },
          { label: 'Programaciones',   value: all.length, cls: 'text-green-600', sub: `${areas} área(s)` },
          { label: 'Faltan registrar', value: sinDatos,   cls: sinDatos > 0 ? 'text-red-600' : 'text-green-600', sub: sinDatos === 0 ? '✓ Todos registraron' : 'supervisores' },
        ].map(m => (
          <div key={m.label} className="card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{m.label}</p>
            <p className={`text-xl font-bold ${m.cls}`}>{m.value}</p>
            {m.sub && <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <ResumenCard tipo="SALIDA" />
        <ResumenCard tipo="RECOJO" />
      </div>

      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cobertura por supervisor</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CobCard tipo="SALIDA" />
        <CobCard tipo="RECOJO" />
      </div>

      <Modal
        open={modal}
        title={cerrado ? 'Reabrir día' : 'Cerrar día'}
        message={cerrado ? 'Se permitirá editar programaciones nuevamente. ¿Confirmas?' : 'Los supervisores no podrán editar sus programaciones. ¿Confirmas?'}
        confirmLabel={cerrado ? 'Reabrir' : 'Cerrar día'}
        confirmVariant={cerrado ? 'success' : 'danger'}
        onConfirm={confirmToggle}
        onCancel={() => setModal(false)}
      />
    </div>
  )
}