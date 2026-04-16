import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx-js-style'
import Modal from '../../components/Modal'
import { ALLP, AGK, AGR, RUTAS, getRid } from '../../utils/constants'
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
              <th rowspan="2" style="${thFn('min-width:80px;vertical-align:middle;')}">HORARIO</th>
              <th rowspan="2" style="${thFn('min-width:50px;vertical-align:middle;')}">TOTAL</th>
              ${AGK.map(ag => `<th colspan="${AGR[ag].length}" style="${thFn()}">${ag}</th>`).join('')}
            </tr>
            <tr>
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
      <div id="reporte">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div>
            <h2 style="margin:0 0 4px;font-size:13px;font-weight:800">Distribución de personal en los paraderos</h2>
            <span style="font-size:11px;font-weight:700;color:${color};padding:2px 10px;background:${colorLight};border-radius:4px;border:1px solid ${color}">${tipoLabel}</span>
          </div>
          <span style="font-size:10px;color:#555">Fecha: ${fecha}</span>
        </div>
        ${tabla}
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="descargarJpeg()" style="padding:8px 20px;background:#2563eb;color:white;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">📷 Descargar JPEG</button>
        <button onclick="window.print()" style="padding:8px 20px;background:#1a7a3c;color:white;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">🖨 Imprimir</button>
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
      <script>
        const FILENAME = 'reporte_${tipoLabel.toLowerCase()}_${fecha.replace(/\//g,'-')}'
        const OPT = { scale: 2, backgroundColor: '#ffffff', useCORS: true }
        function capturar(cb) { html2canvas(document.getElementById('reporte'), OPT).then(cb) }
        function descargarJpeg() {
          capturar(canvas => {
            const a = document.createElement('a')
            a.download = FILENAME + '.jpg'
            a.href = canvas.toDataURL('image/jpeg', 0.95)
            a.click()
          })
        }
      </script>
    </body></html>`

    const win = window.open('', '_blank', 'width=1400,height=900')
    if (win) { win.document.write(html); win.document.close(); win.focus() }
  }

  const exportarExcel = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const fecha = new Date().toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'RECOJO'
    const { grupos, totPar, grandTotal } = buildReporteData(filtroTipo)

    const allFiltrado = all.filter(m => m.tipo === filtroTipo)
    const hors = [...new Set(allFiltrado.map(m => m.hor))]
    const areasList = [...new Set(allFiltrado.map(m => m.area))]

    type FilaVis = { ruta: string; lote: string; com: string; lbl: string; rid: string; vals: Record<string, number>; rowTotal: number }
    const horFilas: Record<string, FilaVis[]> = {}
    hors.forEach(hor => {
      const progsHor = allFiltrado.filter(m => m.hor === hor)
      horFilas[hor] = []
      Object.entries(RUTAS).forEach(([ruta, filas]) => {
        filas.forEach(fila => {
          const rid = getRid(ruta, fila)
          const vals: Record<string, number> = {}
          let rowTotal = 0
          areasList.forEach(a => {
            let s = 0
            progsHor.filter(m => m.area === a).forEach(m => {
              Object.keys(m.data).forEach(ck => { if (ck.startsWith(rid + '||')) s += (m.data[ck] || 0) })
            })
            vals[a] = s; rowTotal += s
          })
          if (rowTotal > 0) horFilas[hor].push({
            ruta, lote: fila.lbl ? '' : String(fila.l ?? ''), com: fila.lbl ? '' : String(fila.c ?? ''),
            lbl: fila.lbl ?? '', rid, vals, rowTotal
          })
        })
      })
    })

    const totArea: Record<string, number> = {}
    areasList.forEach(a => { totArea[a] = 0 })
    let grandTotalRuta = 0
    Object.values(horFilas).forEach(filas => filas.forEach(f => {
      areasList.forEach(a => { totArea[a] += (f.vals[a] || 0) })
      grandTotalRuta += f.rowTotal
    }))

    const wb = XLSX.utils.book_new()
    const GREEN_DARK  = '1a7a3c'
    const GREEN_LIGHT = 'd4edda'
    const GREEN_MID   = 'bbf7d0'
    const GREEN_PALE  = 'f0fdf4'
    const BLUE_PALE   = 'eff6ff'
    const WHITE       = 'ffffff'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thStyle = (extra?: any): any => ({
      font: { bold: true, color: { rgb: WHITE }, sz: 9 },
      fill: { fgColor: { rgb: GREEN_DARK } },
      border: {
        top: { style: 'thin', color: { rgb: '155e30' } },
        bottom: { style: 'thin', color: { rgb: '155e30' } },
        left: { style: 'thin', color: { rgb: '155e30' } },
        right: { style: 'thin', color: { rgb: '155e30' } }
      },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      ...extra
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tdStyle = (extra?: any): any => ({
      font: { sz: 9 },
      border: {
        top: { style: 'thin', color: { rgb: 'e5e7eb' } },
        bottom: { style: 'thin', color: { rgb: 'e5e7eb' } },
        left: { style: 'thin', color: { rgb: 'e5e7eb' } },
        right: { style: 'thin', color: { rgb: 'e5e7eb' } }
      },
      alignment: { horizontal: 'center', vertical: 'center' },
      ...extra
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tdLStyle = (extra?: any): any => ({
      ...tdStyle(),
      alignment: { horizontal: 'left', vertical: 'center' },
      ...extra
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws: any = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = (r: number, c: number, v: string | number, s: any) => {
      const addr = XLSX.utils.encode_cell({ r, c })
      ws[addr] = { v, t: typeof v === 'number' ? 'n' : 's', s }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merges: any[] = []
    const addMerge = (r1: number, c1: number, r2: number, c2: number) => {
      merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })
    }

    let r = 0

    // ── Título Por área
    sc(r, 0, `Distribución de personal — Por área ${tipoLabel}`, { font: { bold: true, sz: 13 }, alignment: { horizontal: 'left' } })
    addMerge(r, 0, r, 5); r++
    sc(r, 0, `Fecha: ${fecha}`, { font: { sz: 9, color: { rgb: '555555' } }, alignment: { horizontal: 'left' } })
    addMerge(r, 0, r, 5); r++
    r++

    // ── Headers tabla Por área fila 1
    let c = 0
    sc(r, c, 'HORARIO', thStyle({ alignment: { horizontal: 'center', vertical: 'center' } }))
    addMerge(r, c, r + 1, c); c++
    sc(r, c, 'RESPONSABLE', thStyle())
    addMerge(r, c, r + 1, c); c++
    sc(r, c, 'ÁREA', thStyle())
    addMerge(r, c, r + 1, c); c++
    AGK.forEach(ag => {
      sc(r, c, ag, thStyle())
      addMerge(r, c, r, c + AGR[ag].length - 1)
      c += AGR[ag].length
    })
    sc(r, c, 'TOTAL', thStyle())
    addMerge(r, c, r + 1, c)
    r++

    // ── Headers fila 2: paraderos verticales
    c = 3
    ALLP.forEach(({ p }) => {
      sc(r, c, p, thStyle({ alignment: { horizontal: 'center', vertical: 'bottom', textRotation: 90, wrapText: true } }))
      c++
    })
    r++

    // ── Body Por área
    Object.entries(grupos).forEach(([_hor, filas]) => {
      const startR = r
      filas.forEach((f, fi) => {
        c = 0
        if (fi === 0) {
          sc(r, c, f.hor, tdStyle({ fill: { fgColor: { rgb: GREEN_LIGHT } }, font: { bold: true, sz: 9, color: { rgb: '155724' } }, alignment: { horizontal: 'center', vertical: 'center' } }))
          if (filas.length > 1) addMerge(startR, 0, startR + filas.length - 1, 0)
        }
        c = 1
        sc(r, c++, f.sup, tdLStyle())
        sc(r, c++, f.area, tdLStyle())
        ALLP.forEach(({ p }) => {
          const v = f.data[p] || 0
          sc(r, c++, v || '', v ? tdStyle({ font: { bold: true, sz: 9 } }) : tdStyle({ font: { color: { rgb: 'd1d5db' }, sz: 9 } }))
        })
        sc(r, c, f.total || '', tdStyle({ font: { bold: true, color: { rgb: '059669' }, sz: 9 }, fill: { fgColor: { rgb: GREEN_PALE } } }))
        r++
      })
    })

    // ── Total Por área
    c = 0
    sc(r, c, 'TOTAL', tdLStyle({ font: { bold: true, sz: 9, color: { rgb: '14532d' } }, fill: { fgColor: { rgb: GREEN_MID } } }))
    addMerge(r, 0, r, 2)
    c = 3
    ALLP.forEach(({ p }) => {
      const v = totPar[p] || 0
      sc(r, c++, v || '', tdStyle({ font: { bold: true, color: { rgb: '14532d' }, sz: 9 }, fill: { fgColor: { rgb: GREEN_MID } } }))
    })
    sc(r, c, grandTotal, tdStyle({ font: { bold: true, color: { rgb: '14532d' }, sz: 9 }, fill: { fgColor: { rgb: '86efac' } } }))
    r += 2

    // ── Resumen Por área título
    sc(r, 0, `RESUMEN POR HORARIO — ${tipoLabel}: ${grandTotal} personas`, { font: { bold: true, sz: 9, color: { rgb: '14532d' } }, alignment: { horizontal: 'left' } })
    addMerge(r, 0, r, 5); r++

    // ── Headers resumen fila 1: HORARIO(r2) | TOTAL(r2) | grupos
    c = 0
    sc(r, c, 'HORARIO', thStyle())
    addMerge(r, c, r + 1, c); c++
    sc(r, c, 'TOTAL', thStyle())
    addMerge(r, c, r + 1, c); c++
    AGK.forEach(ag => {
      sc(r, c, ag, thStyle())
      addMerge(r, c, r, c + AGR[ag].length - 1)
      c += AGR[ag].length
    })
    r++

    // ── Headers resumen fila 2: paraderos verticales
    c = 2
    ALLP.forEach(({ p }) => {
      sc(r, c++, p, thStyle({ alignment: { horizontal: 'center', vertical: 'bottom', textRotation: 90, wrapText: true } }))
    })
    r++

    // ── Body resumen Por área
    Object.entries(grupos).forEach(([_hor, filas]) => {
      const horTotal = filas.reduce((a, f) => a + f.total, 0)
      const horPar: Record<string, number> = {}
      ALLP.forEach(({ p }) => { horPar[p] = 0 })
      filas.forEach(f => ALLP.forEach(({ p }) => { horPar[p] += (f.data[p] || 0) }))
      c = 0
      sc(r, c++, filas[0].hor, tdLStyle({ font: { bold: true, sz: 9, color: { rgb: '065f46' } }, fill: { fgColor: { rgb: GREEN_PALE } } }))
      sc(r, c++, horTotal, tdStyle({ font: { bold: true, sz: 9, color: { rgb: '065f46' } }, fill: { fgColor: { rgb: GREEN_PALE } } }))
      ALLP.forEach(({ p }) => {
        const v = horPar[p] || 0
        sc(r, c++, v || '', v
          ? tdStyle({ font: { bold: true, color: { rgb: '065f46' }, sz: 9 }, fill: { fgColor: { rgb: GREEN_PALE } } })
          : tdStyle({ font: { color: { rgb: 'd1d5db' }, sz: 9 }, fill: { fgColor: { rgb: GREEN_PALE } } }))
      })
      r++
    })

    // ── Total resumen Por área
    c = 0
    sc(r, c++, 'TOTAL', tdLStyle({ font: { bold: true, sz: 9, color: { rgb: '14532d' } }, fill: { fgColor: { rgb: GREEN_MID } } }))
    sc(r, c++, grandTotal, tdStyle({ font: { bold: true, sz: 9, color: { rgb: '14532d' } }, fill: { fgColor: { rgb: GREEN_MID } } }))
    ALLP.forEach(({ p }) => {
      const v = totPar[p] || 0
      sc(r, c++, v || '', tdStyle({ font: { bold: true, color: { rgb: '14532d' }, sz: 9 }, fill: { fgColor: { rgb: GREEN_MID } } }))
    })
    r += 3

    // ── Título Por ruta
    sc(r, 0, `Distribución de personal — Por ruta ${tipoLabel}`, { font: { bold: true, sz: 13 }, alignment: { horizontal: 'left' } })
    addMerge(r, 0, r, 5); r++
    sc(r, 0, `Fecha: ${fecha}`, { font: { sz: 9, color: { rgb: '555555' } }, alignment: { horizontal: 'left' } })
    addMerge(r, 0, r, 5); r++
    r++

    // ── Headers tabla Por ruta
    c = 0
    ;['HORARIO', 'RUTA', 'LOTE', 'COM', 'TOTAL'].forEach(h => {
      sc(r, c++, h, thStyle())
    })
    areasList.forEach(a => {
      sc(r, c++, a, thStyle({ alignment: { horizontal: 'center', vertical: 'bottom', textRotation: 90, wrapText: true } }))
    })
    r++

    // ── Body Por ruta
    hors.forEach(hor => {
      const filas = horFilas[hor]
      if (!filas.length) return
      const startR = r
      const rutaSpan: Record<string, number> = {}
      filas.forEach(f => { rutaSpan[f.ruta] = (rutaSpan[f.ruta] || 0) + 1 })
      const rutaStartRow: Record<string, number> = {}
      filas.forEach((fila, fi) => {
        c = 0
        if (fi === 0) {
          sc(r, c, hor, tdStyle({ fill: { fgColor: { rgb: GREEN_LIGHT } }, font: { bold: true, sz: 9, color: { rgb: '155724' } }, alignment: { horizontal: 'center', vertical: 'center' } }))
          if (filas.length > 1) addMerge(startR, 0, startR + filas.length - 1, 0)
        }
        c = 1
        if (!rutaStartRow[fila.ruta]) {
          rutaStartRow[fila.ruta] = r
          sc(r, c, fila.ruta, tdStyle({ fill: { fgColor: { rgb: BLUE_PALE } }, font: { bold: true, color: { rgb: '2563eb' }, sz: 9 }, alignment: { horizontal: 'center', vertical: 'center' } }))
          if (rutaSpan[fila.ruta] > 1) addMerge(r, 1, r + rutaSpan[fila.ruta] - 1, 1)
        }
        c = 2
        if (fila.lbl) {
          sc(r, c++, fila.lbl, tdLStyle({ font: { italic: true, color: { rgb: '6b7280' }, sz: 9 } }))
          sc(r, c++, '', tdStyle())
        } else {
          sc(r, c++, fila.lote, tdStyle())
          sc(r, c++, fila.com, tdStyle())
        }
        sc(r, c++, fila.rowTotal || '', tdStyle({ font: { bold: true, color: { rgb: '059669' }, sz: 9 }, fill: { fgColor: { rgb: GREEN_PALE } } }))
        areasList.forEach((a, i) => {
          const v = fila.vals[a] || 0
          const bg = i % 2 === 0 ? WHITE : 'f9fafb'
          sc(r, c++, v || '', v
            ? tdStyle({ font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: bg } } })
            : tdStyle({ font: { color: { rgb: 'd1d5db' }, sz: 9 }, fill: { fgColor: { rgb: bg } } }))
        })
        r++
      })
    })

    // ── Total Por ruta
    c = 0
    sc(r, c, 'TOTAL', tdLStyle({ font: { bold: true, sz: 9, color: { rgb: '14532d' } }, fill: { fgColor: { rgb: GREEN_MID } } }))
    addMerge(r, 0, r, 3)
    c = 4
    sc(r, c++, grandTotalRuta, tdStyle({ font: { bold: true, sz: 9, color: { rgb: '14532d' } }, fill: { fgColor: { rgb: GREEN_MID } } }))
    areasList.forEach((a, i) => {
      const v = totArea[a] || 0
      const bg = i % 2 === 0 ? GREEN_MID : 'a7f3d0'
      sc(r, c++, v || '', tdStyle({ font: { bold: true, color: { rgb: '14532d' }, sz: 9 }, fill: { fgColor: { rgb: bg } } }))
    })
    r += 2

    // ── Resumen Por ruta título
    sc(r, 0, `RESUMEN POR HORARIO — ${tipoLabel}: ${grandTotalRuta} personas`, { font: { bold: true, sz: 9, color: { rgb: '14532d' } }, alignment: { horizontal: 'left' } })
    addMerge(r, 0, r, 5); r++

    // ── Headers resumen ruta: HORARIO | TOTAL | áreas (fila única, sin rotación)
    c = 0
    sc(r, c++, 'HORARIO', thStyle({ alignment: { horizontal: 'center', vertical: 'center', wrapText: false } }))
    sc(r, c++, 'TOTAL', thStyle({ alignment: { horizontal: 'center', vertical: 'center', wrapText: false } }))
    areasList.forEach(a => {
      sc(r, c++, a, thStyle({ alignment: { horizontal: 'center', vertical: 'bottom', textRotation: 90, wrapText: true } }))
    })
    r++// fila 2 cubierta por merges

    // ── Body resumen Por ruta
    hors.forEach(hor => {
      const filas = horFilas[hor]; if (!filas.length) return
      const horTotal = filas.reduce((a, f) => a + f.rowTotal, 0)
      const horArea: Record<string, number> = {}
      areasList.forEach(a => { horArea[a] = 0 })
      filas.forEach(f => areasList.forEach(a => { horArea[a] += (f.vals[a] || 0) }))
      c = 0
      sc(r, c++, hor, tdLStyle({ font: { bold: true, sz: 9, color: { rgb: '065f46' } }, fill: { fgColor: { rgb: GREEN_PALE } } }))
      sc(r, c++, horTotal, tdStyle({ font: { bold: true, sz: 9, color: { rgb: '065f46' } }, fill: { fgColor: { rgb: GREEN_PALE } } }))
      areasList.forEach((a, i) => {
        const v = horArea[a] || 0
        const bg = i % 2 === 0 ? GREEN_PALE : 'e8faf0'
        sc(r, c++, v || '', v
          ? tdStyle({ font: { bold: true, color: { rgb: '065f46' }, sz: 9 }, fill: { fgColor: { rgb: bg } } })
          : tdStyle({ font: { color: { rgb: 'd1d5db' }, sz: 9 }, fill: { fgColor: { rgb: bg } } }))
      })
      r++
    })

    // ── Total resumen Por ruta
    c = 0
    sc(r, c++, 'TOTAL', tdLStyle({ font: { bold: true, sz: 9, color: { rgb: '14532d' } }, fill: { fgColor: { rgb: GREEN_MID } } }))
    sc(r, c++, grandTotalRuta, tdStyle({ font: { bold: true, sz: 9, color: { rgb: '14532d' } }, fill: { fgColor: { rgb: GREEN_MID } } }))
    areasList.forEach((a, i) => {
      const v = totArea[a] || 0
      const bg = i % 2 === 0 ? GREEN_MID : 'a7f3d0'
      sc(r, c++, v || '', tdStyle({ font: { bold: true, color: { rgb: '14532d' }, sz: 9 }, fill: { fgColor: { rgb: bg } } }))
    })

    // ── Anchos de columna
    ws['!cols'] = [
      { wch: 14 },
      { wch: 20 },
      { wch: 22 },
      { wch: 6  },
      { wch: 7  },
      ...Array(Math.max(ALLP.length, areasList.length)).fill(null).map(() => ({ wch: 5 }))
    ]
    ws['!merges'] = merges
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r, c: 5 + Math.max(ALLP.length, areasList.length) }
    })

    XLSX.utils.book_append_sheet(wb, ws, 'Resumen')
    XLSX.writeFile(wb, `reporte_${tipoLabel.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const exportarReporteRutas = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const fecha = new Date().toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    const color = filtroTipo === 'SALIDA' ? '#d97706' : '#2563eb'
    const colorLight = filtroTipo === 'SALIDA' ? '#fef3c7' : '#dbeafe'
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'RECOJO'

    const allFiltrado = all.filter(m => m.tipo === filtroTipo)
    const hors = [...new Set(allFiltrado.map(m => m.hor))]
    const areasList = [...new Set(allFiltrado.map(m => m.area))]

    const th = (extra = '') => `background:#1a7a3c;color:white;padding:4px 6px;font-size:9px;text-align:center;border:1px solid #155e30;${extra}`
    const td = (extra = '') => `padding:3px 5px;font-size:9px;border:1px solid #e5e7eb;text-align:center;${extra}`
    const tdL = (extra = '') => `padding:3px 5px;font-size:9px;border:1px solid #e5e7eb;text-align:left;white-space:nowrap;${extra}`

    type FilaVis = {
      ruta: string; lote: string; com: string; lbl: string; rid: string
      vals: Record<string, number>; rowTotal: number
    }

    const horFilas: Record<string, FilaVis[]> = {}
    hors.forEach(hor => {
      const progsHor = allFiltrado.filter(m => m.hor === hor)
      horFilas[hor] = []
      Object.entries(RUTAS).forEach(([ruta, filas]) => {
        filas.forEach(fila => {
          const rid = getRid(ruta, fila)
          const vals: Record<string, number> = {}
          let rowTotal = 0
          areasList.forEach(a => {
            let s = 0
            progsHor.filter(m => m.area === a).forEach(m => {
              Object.keys(m.data).forEach(ck => { if (ck.startsWith(rid + '||')) s += (m.data[ck] || 0) })
            })
            vals[a] = s
            rowTotal += s
          })
          if (rowTotal > 0) {
            horFilas[hor].push({
              ruta,
              lote: fila.lbl ? '' : String(fila.l ?? ''),
              com: fila.lbl ? '' : String(fila.c ?? ''),
              lbl: fila.lbl ?? '',
              rid, vals, rowTotal
            })
          }
        })
      })
    })

    const totArea: Record<string, number> = {}
    areasList.forEach(a => { totArea[a] = 0 })
    let grandTotal = 0
    Object.values(horFilas).forEach(filas => {
      filas.forEach(f => {
        areasList.forEach(a => { totArea[a] += (f.vals[a] || 0) })
        grandTotal += f.rowTotal
      })
    })

    const bodyRows = hors.map(hor => {
      const filas = horFilas[hor]
      if (!filas.length) return ''
      const horSpan = filas.length
      const rutaSpan: Record<string, number> = {}
      filas.forEach(f => { rutaSpan[f.ruta] = (rutaSpan[f.ruta] || 0) + 1 })
      const rutaRendered = new Set<string>()
      let horRendered = false
      return filas.map(fila => {
        const isFirstHor = !horRendered
        if (isFirstHor) horRendered = true
        const isFirstRuta = !rutaRendered.has(fila.ruta)
        if (isFirstRuta) rutaRendered.add(fila.ruta)
        const horCell = isFirstHor
          ? `<td rowspan="${horSpan}" style="${tdL('width:1%;white-space:nowrap;font-weight:700;color:#155724;background:#d4edda;vertical-align:middle;text-align:center;')}">${hor}</td>`
          : ''
        const rutaCell = isFirstRuta
          ? `<td rowspan="${rutaSpan[fila.ruta]}" style="${td('width:1%;white-space:nowrap;font-weight:700;color:#2563eb;vertical-align:middle;background:#eff6ff;')}">${fila.ruta}</td>`
          : ''
        const loteComCells = fila.lbl
          ? `<td colspan="2" style="${td('width:1%;white-space:nowrap;color:#6b7280;font-style:italic;text-align:left;')}">${fila.lbl}</td>`
          : `<td style="${td('width:1%;white-space:nowrap;')}">${fila.lote}</td><td style="${td('width:1%;white-space:nowrap;')}">${fila.com}</td>`
        const totalCell = `<td style="${td('width:1%;white-space:nowrap;font-weight:700;color:#059669;background:#f0fdf4;')}">${fila.rowTotal || ''}</td>`
        const areaCells = areasList.map((a, i) => {
          const v = fila.vals[a] || 0
          const bg = i % 2 === 0 ? '' : 'background:#f9fafb;'
          return `<td style="${td('width:26px;max-width:26px;' + bg + (v ? 'font-weight:600;' : 'color:#d1d5db;'))}">${v || ''}</td>`
        }).join('')
        return `<tr>${horCell}${rutaCell}${loteComCells}${totalCell}${areaCells}</tr>`
      }).join('')
    }).join('')

    const totalRow = `<tr style="background:#bbf7d0">
      <td colspan="4" style="${tdL('font-weight:800;color:#14532d;')}">TOTAL</td>
      <td style="${td('font-weight:800;color:#14532d;')}"> ${grandTotal}</td>
      ${areasList.map((a, i) => {
        const v = totArea[a] || 0
        const bg = i % 2 === 0 ? 'background:#bbf7d0;' : 'background:#a7f3d0;'
        return `<td style="${td('font-weight:700;color:#14532d;' + bg)}">${v || ''}</td>`
      }).join('')}
    </tr>`

    const subRows = hors.map(hor => {
      const filas = horFilas[hor]
      if (!filas.length) return ''
      const horTotal = filas.reduce((a, f) => a + f.rowTotal, 0)
      const horArea: Record<string, number> = {}
      areasList.forEach(a => { horArea[a] = 0 })
      filas.forEach(f => areasList.forEach(a => { horArea[a] += (f.vals[a] || 0) }))
      return `<tr style="background:#f0fdf4">
        <td style="${tdL('font-weight:700;color:#065f46;')}">${hor}</td>
        <td style="${td('font-weight:700;color:#065f46;')}">${horTotal}</td>
        ${areasList.map((a, i) => {
          const v = horArea[a] || 0
          const bg = i % 2 === 0 ? 'background:#f0fdf4;' : 'background:#e8faf0;'
          return `<td style="${td(bg + (v ? 'font-weight:600;color:#065f46;' : 'color:#d1d5db;'))}">${v || ''}</td>`
        }).join('')}
      </tr>`
    }).join('')

    const subTotalRow = `<tr style="background:#bbf7d0">
      <td style="${tdL('font-weight:800;color:#14532d;')}">TOTAL</td>
      <td style="${td('font-weight:800;color:#14532d;')}">${grandTotal}</td>
      ${areasList.map((a, i) => {
        const v = totArea[a] || 0
        const bg = i % 2 === 0 ? 'background:#bbf7d0;' : 'background:#a7f3d0;'
        return `<td style="${td('font-weight:700;color:#14532d;' + bg)}">${v || ''}</td>`
      }).join('')}
    </tr>`

    const areaHeaders = areasList.map((a, i) =>
      `<th style="${th('width:26px;max-width:26px;height:110px;padding:0;vertical-align:middle;text-align:center;' + (i > 0 ? 'border-left:1px solid #155e30;' : ''))}">
        <div style="display:table;width:26px;height:110px;">
          <div style="display:table-cell;vertical-align:middle;text-align:center;">
            <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;line-height:1.2;word-break:break-word;white-space:normal;width:14px;display:inline-block;text-align:center;">${a}</span>
          </div>
        </div>
      </th>`
    ).join('')

    const html = `<html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;font-size:9px;margin:16px;background:white}
      @media print{body{margin:8px} @page{size:landscape;margin:10mm}}
    </style></head><body>
      <div id="reporte">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div>
            <h2 style="margin:0 0 4px;font-size:13px;font-weight:800">Distribución de personal en comedores</h2>
            <span style="font-size:11px;font-weight:700;color:${color};padding:2px 10px;background:${colorLight};border-radius:4px;border:1px solid ${color}">${tipoLabel}</span>
          </div>
          <span style="font-size:10px;color:#555">Fecha: ${fecha}</span>
        </div>
        <table style="border-collapse:collapse;font-size:9px;table-layout:fixed">
          <colgroup>
            <col style="width:70px">
            <col style="width:36px">
            <col style="width:28px">
            <col style="width:28px">
            <col style="width:36px">
            ${areasList.map(() => `<col style="width:26px">`).join('')}
          </colgroup>
          <thead>
            <tr>
              <th style="${th('vertical-align:middle;')}">HORARIO</th>
              <th style="${th('vertical-align:middle;')}">RUTA</th>
              <th style="${th('vertical-align:middle;')}">LOTE</th>
              <th style="${th('vertical-align:middle;')}">COM</th>
              <th style="${th('vertical-align:middle;')}">TOTAL</th>
              ${areaHeaders}
            </tr>
          </thead>
          <tbody>${bodyRows}${totalRow}</tbody>
        </table>
        <div style="margin-top:20px">
          <p style="font-size:9px;font-weight:700;color:#14532d;margin-bottom:6px">
            RESUMEN POR HORARIO — ${tipoLabel}: ${grandTotal} personas
          </p>
          <table style="border-collapse:collapse;font-size:9px;table-layout:fixed">
            <colgroup>
              <col style="width:70px">
              <col style="width:36px">
              ${areasList.map(() => `<col style="width:26px">`).join('')}
            </colgroup>
            <thead>
              <tr>
                <th style="${th()}">HORARIO</th>
                <th style="${th()}">TOTAL</th>
                ${areaHeaders}
              </tr>
            </thead>
            <tbody>${subRows}${subTotalRow}</tbody>
          </table>
        </div>
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
            link.download = 'comedores_${tipoLabel.toLowerCase()}_${fecha.replace(/\//g,'-')}.jpg'
            link.href = canvas.toDataURL('image/jpeg', 0.95)
            link.click()
          })
        }
      </script>
    </body></html>`

    const win = window.open('', '_blank', 'width=1400,height=900')
    if (win) { win.document.write(html); win.document.close(); win.focus() }
  }

  const ResumenCard = ({ tipo }: { tipo: 'SALIDA' | 'RECOJO' }) => {
    const isSal = tipo === 'SALIDA'
    const mine = all.filter(x => x.tipo === tipo)
    const { grupos } = buildReporteData(tipo)
    return (
      <div className={`card border-2 ${isSal ? 'border-amber-100' : 'border-blue-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-bold ${isSal ? 'text-amber-600' : 'text-blue-600'}`}>
            {isSal ? '↑ SALIDA' : '↓ RECOJO'}
          </span>
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
          <button onClick={() => exportarReporte(tipo)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg text-white ${isSal ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            📊 Por área
          </button>
          <button onClick={() => exportarReporteRutas(tipo)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg text-white ${isSal ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            🏗 Por ruta
          </button>
          <button onClick={() => exportarExcel(tipo)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg text-white ${isSal ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-700 hover:bg-blue-800'}`}>
            📥 XLS
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