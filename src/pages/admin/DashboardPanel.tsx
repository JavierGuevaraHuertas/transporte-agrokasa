import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx-js-style'
import Modal from '../../components/Modal'
import { ALLP, AGK, AGR, RUTAS } from '../../utils/constants'
import {
  getAllUsuarios,
  getDia,
  setDiaEstadoTipo,
  getAllProgramaciones,
  getProgramacionDetalle,
} from '../../lib/api'

interface Supervisor {
  id: string
  username: string
  nombre: string
  rol: string
}

interface ProgUI {
  id: string
  user: string
  area: string
  tipo: 'SALIDA' | 'RECOJO'
  hor: string
  total: number
  data: Record<string, number>
}

interface Props {
  refresh: number
  onDiaChange: () => void
  showToast: (msg: string, type: 'ok' | 'warn' | 'err') => void
}

export default function DashboardPanel({ refresh, onDiaChange: _onDiaChange, showToast }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  // dateRecojo defaults to Monday when today is Saturday
  const defaultDateRecojo = (() => {
    const d = new Date()
    if (d.getDay() === 6) { const m = new Date(d); m.setDate(d.getDate() + 2); return m.toISOString().slice(0, 10) }
    return d.toISOString().slice(0, 10)
  })()
  const [dateSalida, setDateSalida] = useState(today)
  const [dateRecojo, setDateRecojo] = useState(defaultDateRecojo)
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [cerradoSalida, setCerradoSalida] = useState(false)
  const [cerradoRecojo, setCerradoRecojo] = useState(false)
  const [modalTipo, setModalTipo] = useState<'SALIDA' | 'RECOJO' | null>(null)
  const [all, setAll] = useState<ProgUI[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getAllUsuarios()
      .then((data) => setSupervisores(data.filter((u: Supervisor) => u.rol === 'supervisor')))
      .catch((e) => {
        console.error('Error cargando supervisores:', e)
        setSupervisores([])
      })
  }, [])

  const mapProgs = async (progs: any[]): Promise<ProgUI[]> => {
    return Promise.all(
      (progs || []).map(async (p: any) => {
        const detalle = await getProgramacionDetalle(p.id)
        const data: Record<string, number> = {}
        for (const row of detalle) {
          const rutaTxt = row.ruta.replace('-', '_')
          const rid = row.fila_label
            ? `${rutaTxt}_${row.fila_label}`
            : `${rutaTxt}_${row.lote ?? 0}_${row.comedor ?? 0}`
          const ck = `${rid}||${row.paradero}`
          data[ck] = row.cantidad ?? 0
        }
        return { id: p.id, user: p.usuarios?.username || '', area: p.area, tipo: p.tipo, hor: p.horario_label, total: p.total || 0, data } as ProgUI
      })
    )
  }

  useEffect(() => {
    let active = true

    async function cargarDashboard() {
      try {
        setLoading(true)

        // Load both dates in parallel (they may differ on Saturdays)
        const [diaSalida, diaRecojo, progsSalida, progsRecojo] = await Promise.all([
          getDia(dateSalida),
          dateSalida === dateRecojo ? Promise.resolve(null) : getDia(dateRecojo),
          getAllProgramaciones(dateSalida),
          dateSalida === dateRecojo ? Promise.resolve(null) : getAllProgramaciones(dateRecojo),
        ])
        const dia = diaSalida
        const diaRec = dateSalida === dateRecojo ? diaSalida : diaRecojo

        if (!active) return
        setCerradoSalida(dia?.estado_salida === 'cerrado' || dia?.estado === 'cerrado')
        setCerradoRecojo(diaRec?.estado_recojo === 'cerrado' || diaRec?.estado === 'cerrado')

        const mappedSalida = await mapProgs((progsSalida || []).filter((p: any) => p.tipo === 'SALIDA'))
        const recojoSource = dateSalida === dateRecojo
          ? (progsSalida || []).filter((p: any) => p.tipo === 'RECOJO')
          : (progsRecojo || []).filter((p: any) => p.tipo === 'RECOJO')
        const mappedRecojo = await mapProgs(recojoSource)

        if (!active) return
        setAll([...mappedSalida, ...mappedRecojo])
      } catch (e) {
        console.error('Error cargando dashboard:', e)
        if (!active) return
        setCerradoSalida(false)
        setCerradoRecojo(false)
        setAll([])
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    void cargarDashboard()

    return () => { active = false }
  }, [dateSalida, dateRecojo, refresh])

  const sal = useMemo(
    () => all.filter((x) => x.tipo === 'SALIDA').reduce((a, x) => a + (x.total || 0), 0),
    [all]
  )

  const rec = useMemo(
    () => all.filter((x) => x.tipo === 'RECOJO').reduce((a, x) => a + (x.total || 0), 0),
    [all]
  )

  const areas = useMemo(() => new Set(all.map((x) => x.area)).size, [all])
  const conDatos = useMemo(() => new Set(all.map((x) => x.user)).size, [all])
  const sinDatos = Math.max(0, supervisores.length - conDatos)

  const handleToggleTipo = (tipo: 'SALIDA' | 'RECOJO') => setModalTipo(tipo)

  const confirmToggleTipo = async () => {
    if (!modalTipo) return
    const esCerrado = modalTipo === 'SALIDA' ? cerradoSalida : cerradoRecojo
    const fecha = modalTipo === 'SALIDA' ? dateSalida : dateRecojo
    try {
      await setDiaEstadoTipo(fecha, modalTipo, esCerrado ? 'abierto' : 'cerrado')
      if (modalTipo === 'SALIDA') setCerradoSalida(!cerradoSalida)
      else setCerradoRecojo(!cerradoRecojo)
      const label = modalTipo === 'SALIDA' ? 'Salida' : 'Ingreso'
      showToast(
        esCerrado ? `${label} reabierta` : `${label} cerrada — supervisores bloqueados`,
        esCerrado ? 'ok' : 'warn'
      )
    } catch (e) {
      console.error('Error cambiando estado:', e)
      showToast('No se pudo cambiar el estado', 'err')
    } finally {
      setModalTipo(null)
    }
  }

  const buildReporteData = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const supMap: Record<string, string> = {}
    supervisores.forEach((s) => { supMap[s.username] = s.nombre })

    const allFiltrado = all.filter((m) => m.tipo === filtroTipo)

    type Fila = { sup: string; area: string; hor: string; data: Record<string, number>; total: number }
    const grupos: Record<string, Fila[]> = {}

    allFiltrado.forEach((m) => {
      const hor = m.hor
      if (!grupos[hor]) grupos[hor] = []

      const data: Record<string, number> = {}
      ALLP.forEach(({ p }) => {
        let s = 0
        Object.keys(m.data).forEach((ck) => {
          if (ck.endsWith('||' + p)) s += m.data[ck] || 0
        })
        if (s > 0) data[p] = s
      })

      const total = Object.values(data).reduce((a, b) => a + b, 0)
      grupos[hor].push({ sup: supMap[m.user] || m.user, area: m.area, hor, data, total })
    })

    const totPar: Record<string, number> = {}
    ALLP.forEach(({ p }) => { totPar[p] = 0 })

    allFiltrado.forEach((m) =>
      ALLP.forEach(({ p }) => {
        Object.keys(m.data).forEach((ck) => {
          if (ck.endsWith('||' + p)) totPar[p] += m.data[ck] || 0
        })
      })
    )

    const grandTotal = Object.values(totPar).reduce((a, b) => a + b, 0)
    // Return grupos with keys sorted in canonical horario order
    const sortedGrupos: typeof grupos = {}
    sortHorarios(Object.keys(grupos), filtroTipo).forEach((h) => { sortedGrupos[h] = grupos[h] })
    return { grupos: sortedGrupos, totPar, grandTotal }
  }

  const buildTablaHtml = (
    filtroTipo: 'SALIDA' | 'RECOJO',
    fontSize: string,
    thFn: (e?: string) => string,
    tdFn: (e?: string) => string,
    tdLFn: (e?: string) => string,
    parHeadersFn: (thFn: (e?: string) => string) => string
  ) => {
    const { grupos, totPar, grandTotal } = buildReporteData(filtroTipo)

    const agHeaders = AGK.map(
      (ag) => `<th colspan="${AGR[ag].length}" style="${thFn('min-width:40px')}">${ag}</th>`
    ).join('')
    const parHeaders = parHeadersFn(thFn)

    const bodyRows = Object.entries(grupos)
      .map(([_hor, filas]) => {
        // Subtotal per paradero for this horario
        const horSubTotals: Record<string, number> = {}
        ALLP.forEach(({ p }) => { horSubTotals[p] = filas.reduce((a, f) => a + (f.data[p] || 0), 0) })
        const horTotal = filas.reduce((a, f) => a + (f.total || 0), 0)

        const dataRows = filas.map((f, fi) =>
          `<tr>
          ${fi === 0 ? `<td rowspan="${filas.length + 1}" style="${tdLFn('font-weight:600;vertical-align:middle;background:#f9fafb;border-bottom:2px solid #6ee7b7;')}">${f.hor}</td>` : ''}
          <td style="${tdLFn()}">${f.sup}</td>
          <td style="${tdLFn(f.area === 'Cosecha Palto' ? 'background:#fef08a;font-weight:700;' : '')}">${f.area}</td>
          ${ALLP.map(({ ag, p }, i) => {
            const v = f.data[p] || 0
            const bl = i > 0 && ALLP[i - 1].ag !== ag ? 'border-left:2px solid #d1fae5;' : ''
            return `<td style="${tdFn(bl + (v ? '' : 'color:#d1d5db;'))}">${v || ''}</td>`
          }).join('')}
          <td style="${tdFn('font-weight:700;color:#059669;border-left:2px solid #d1d5db;background:#f0fdf4')}">${f.total || ''}</td>
        </tr>`
        ).join('')

        const subTotalRow = `<tr style="background:#e8f5e9;">
          <td colspan="2" style="${tdLFn('font-weight:800;color:#14532d;background:#d4edda;border-top:1px solid #6ee7b7;border-bottom:2px solid #6ee7b7;')}">Sub Total</td>
          ${ALLP.map(({ ag, p }, i) => {
            const v = horSubTotals[p] || 0
            const bl = i > 0 && ALLP[i - 1].ag !== ag ? 'border-left:2px solid #6ee7b7;' : ''
            return `<td style="${tdFn('font-weight:700;color:#14532d;background:#d4edda;border-top:1px solid #6ee7b7;border-bottom:2px solid #6ee7b7;' + bl + (v ? '' : 'color:#9ca3af;'))}">${v || ''}</td>`
          }).join('')}
          <td style="${tdFn('font-weight:800;color:#14532d;background:#bbf7d0;border-left:2px solid #6ee7b7;border-top:1px solid #6ee7b7;border-bottom:2px solid #6ee7b7;')}">${horTotal}</td>
        </tr>`

        return dataRows + subTotalRow
      }).join('')

    const totalRow = `<tr>
      <td colspan="3" style="${tdLFn('font-weight:800;color:#14532d;background:#bbf7d0')}">TOTAL</td>
      ${ALLP.map(({ ag, p }, i) => {
        const v = totPar[p] || 0
        const bl = i > 0 && ALLP[i - 1].ag !== ag ? 'border-left:2px solid #6ee7b7;' : ''
        return `<td style="${tdFn('font-weight:700;color:#14532d;background:#bbf7d0;' + bl)}">${v || ''}</td>`
      }).join('')}
      <td style="${tdFn('font-weight:800;color:#14532d;background:#86efac;border-left:2px solid #aaa')}">${grandTotal}</td>
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
`
  }

  const exportarReporte = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    // ── CAMBIO: usar la fecha del estado en lugar de new Date() ──
    const fechaBase = filtroTipo === 'SALIDA' ? dateSalida : dateRecojo
    const fecha = new Date(fechaBase + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    const color = filtroTipo === 'SALIDA' ? '#d97706' : '#2563eb'
    const colorLight = filtroTipo === 'SALIDA' ? '#fef3c7' : '#dbeafe'
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'INGRESO'

    const th = (extra = '') => `background:#1a7a3c;color:white;padding:4px 6px;font-size:9px;text-align:center;border:1px solid #155e30;${extra}`
    const td = (extra = '') => `padding:3px 5px;font-size:9px;border:1px solid #e5e7eb;text-align:center;${extra}`
    const tdL = (extra = '') => `padding:3px 5px;font-size:9px;border:1px solid #e5e7eb;text-align:left;white-space:nowrap;${extra}`

    const parHeaders = (thFn: (e?: string) => string) =>
      ALLP.map(({ ag, p }, i) => {
        const bl = i > 0 && ALLP[i - 1].ag !== ag ? 'border-left:2px solid #0f4f28;' : ''
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
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <h2 style="margin:0 0 4px;font-size:13px;font-weight:800">Distribución de personal en los paraderos, ${fecha}</h2>
            <span style="font-size:11px;font-weight:700;color:${color};padding:2px 10px;background:${colorLight};border-radius:4px;border:1px solid ${color}">${tipoLabel}</span>
          </div>
        </div>
        ${tabla}
      </div>
    </body></html>`

    const win = window.open('', '_blank', 'width=1400,height=900')
    if (win) { win.document.write(html); win.document.close(); win.focus() }
  }

  const exportarExcel = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    // ── CAMBIO: usar la fecha del estado en lugar de new Date() ──
    const fechaBase = filtroTipo === 'SALIDA' ? dateSalida : dateRecojo
    const fecha = new Date(fechaBase + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'INGRESO'
    const { grupos } = buildReporteData(filtroTipo)

    const wb = XLSX.utils.book_new()
    const GREEN_DARK = '1a7a3c', GREEN_LIGHT = 'd4edda', GREEN_MID = 'bbf7d0', GREEN_PALE = 'f0fdf4', WHITE = 'ffffff'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thStyle = (extra?: any): any => ({ font: { bold: true, color: { rgb: WHITE }, sz: 9 }, fill: { fgColor: { rgb: GREEN_DARK } }, border: { top: { style: 'thin', color: { rgb: '155e30' } }, bottom: { style: 'thin', color: { rgb: '155e30' } }, left: { style: 'thin', color: { rgb: '155e30' } }, right: { style: 'thin', color: { rgb: '155e30' } } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, ...extra })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tdStyle = (extra?: any): any => ({ font: { sz: 9 }, border: { top: { style: 'thin', color: { rgb: 'e5e7eb' } }, bottom: { style: 'thin', color: { rgb: 'e5e7eb' } }, left: { style: 'thin', color: { rgb: 'e5e7eb' } }, right: { style: 'thin', color: { rgb: 'e5e7eb' } } }, alignment: { horizontal: 'center', vertical: 'center' }, ...extra })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tdLStyle = (extra?: any): any => ({ ...tdStyle(), alignment: { horizontal: 'left', vertical: 'center' }, ...extra })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws: any = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merges: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = (r: number, c: number, v: string | number, s: any) => { ws[XLSX.utils.encode_cell({ r, c })] = { v, t: typeof v === 'number' ? 'n' : 's', s } }
    const addMerge = (r1: number, c1: number, r2: number, c2: number) => merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })

    let r = 0
    sc(r, 0, `Distribución de personal — Por área ${tipoLabel}, ${fecha}`, { font: { bold: true, sz: 13 }, alignment: { horizontal: 'left' } })
    addMerge(r, 0, r, 25); r++; r++

    let c = 0
    sc(r, c, 'HORARIO', thStyle({ alignment: { horizontal: 'center', vertical: 'center' } })); addMerge(r, c, r + 1, c); c++
    sc(r, c, 'RESPONSABLE', thStyle()); addMerge(r, c, r + 1, c); c++
    sc(r, c, 'ÁREA', thStyle()); addMerge(r, c, r + 1, c); c++
    AGK.forEach((ag) => { sc(r, c, ag, thStyle()); addMerge(r, c, r, c + AGR[ag].length - 1); c += AGR[ag].length })
    sc(r, c, 'TOTAL', thStyle()); addMerge(r, c, r + 1, c); r++

    c = 3
    ALLP.forEach(({ p }) => { sc(r, c, p, thStyle({ alignment: { horizontal: 'center', vertical: 'bottom', textRotation: 90, wrapText: true } })); c++ })
    r++

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scf = (row: number, col: number, formula: string, s: any) => { ws[XLSX.utils.encode_cell({r:row,c:col})] = {f: formula, t:'n', s} }
    const encC = (col: number) => XLSX.utils.encode_col(col)

    const subTotalRows: number[] = [] // track row numbers of Sub Total rows

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
        sc(r, c++, f.area, f.area === 'Cosecha Palto' ? tdLStyle({ fill: { fgColor: { rgb: 'fef08a' } }, font: { bold: true, sz: 9, color: { rgb: '713f12' } } }) : tdLStyle())
        const dataStartCol = c
        ALLP.forEach(({ p }) => { const v = f.data[p] || 0; sc(r, c++, v || '', v ? tdStyle({ font: { bold: true, sz: 9 } }) : tdStyle({ font: { color: { rgb: 'd1d5db' }, sz: 9 } })) })
        scf(r, c, `SUM(${encC(dataStartCol)}${r+1}:${encC(c-1)}${r+1})`, tdStyle({ font: { bold: true, color: { rgb: '059669' }, sz: 9 }, fill: { fgColor: { rgb: GREEN_PALE } } }))
        r++
      })
      // Sub Total row per horario
      const endR = r - 1
      const subStyle = (extra?: any): any => ({ font: { bold: true, sz: 9, color: { rgb: '14532d' } }, fill: { fgColor: { rgb: GREEN_MID } }, border: { top: { style: 'thin', color: { rgb: '6ee7b7' } }, bottom: { style: 'thin', color: { rgb: '6ee7b7' } }, left: { style: 'thin', color: { rgb: '6ee7b7' } }, right: { style: 'thin', color: { rgb: '6ee7b7' } } }, alignment: { horizontal: 'center', vertical: 'center' }, ...extra })
      c = 0
      sc(r, c++, 'Sub Total', subStyle({ alignment: { horizontal: 'left' } }))
      addMerge(r, 0, r, 2); c = 3
      ALLP.forEach(() => {
        scf(r, c, `SUM(${encC(c)}${startR+1}:${encC(c)}${endR+1})`, subStyle())
        c++
      })
      scf(r, c, `SUM(${encC(c)}${startR+1}:${encC(c)}${endR+1})`, subStyle({ fill: { fgColor: { rgb: '6ee7b7' } } }))
      subTotalRows.push(r) // record this subtotal row
      r++
    })

    c = 0
    sc(r, c, 'TOTAL', tdLStyle({ font: { bold: true, sz: 9, color: { rgb: '14532d' } }, fill: { fgColor: { rgb: GREEN_MID } } }))
    addMerge(r, 0, r, 2); c = 3
    // TOTAL = SUM of only the Sub Total rows (not individual rows - avoids double counting)
    const subTotalParaderoCol = (col: number) => subTotalRows.map(sr => `${encC(col)}${sr+1}`).join(',')
    ALLP.forEach(() => {
      scf(r, c, `SUM(${subTotalParaderoCol(c)})`, tdStyle({ font: { bold: true, color: { rgb: '14532d' }, sz: 9 }, fill: { fgColor: { rgb: GREEN_MID } } }))
      c++
    })
    scf(r, c, `SUM(${subTotalParaderoCol(c)})`, tdStyle({ font: { bold: true, color: { rgb: '14532d' }, sz: 9 }, fill: { fgColor: { rgb: '86efac' } } }))

    ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 6 }, ...Array(ALLP.length).fill(null).map(() => ({ wch: 5 }))]
    ws['!merges'] = merges
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 3 + ALLP.length } })

    XLSX.utils.book_append_sheet(wb, ws, 'Por Área')
    XLSX.writeFile(wb, `area_${tipoLabel.toLowerCase()}_${fechaBase}.xlsx`)
  }

  // Orden canónico de horarios para sorting
  const ORDEN_SALIDA = ['Salida 13:00','Salida 14:00','Salida 15:30','Salida 16:30','Salida 17:00','Salida 17:30','Salida 23:00','Salida 2:00']
  const ORDEN_RECOJO = ['De 05:00 a 14:00','De 06:30 a 15:30','De 07:30 a 16:30','De 17:00 a 02:00']

  const sortHorarios = (hors: string[], tipo: 'SALIDA' | 'RECOJO') => {
    const orden = tipo === 'SALIDA' ? ORDEN_SALIDA : ORDEN_RECOJO
    return [...hors].sort((a, b) => {
      const ia = orden.indexOf(a)
      const ib = orden.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }

  const buildParaderosData = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const allFiltrado = all.filter((m) => m.tipo === filtroTipo)
    const hors = sortHorarios([...new Set(allFiltrado.map((m) => m.hor))], filtroTipo)

    const horParMap: Record<string, Record<string, number>> = {}
    hors.forEach((hor) => { horParMap[hor] = {} })

    allFiltrado.forEach((m) => {
      ALLP.forEach(({ p }) => {
        let s = 0
        Object.keys(m.data).forEach((ck) => { if (ck.endsWith('||' + p)) s += m.data[ck] || 0 })
        if (s > 0) horParMap[m.hor][p] = (horParMap[m.hor]?.[p] || 0) + s
      })
    })

    const horTotals: Record<string, number> = {}
    hors.forEach((hor) => { horTotals[hor] = ALLP.reduce((a, { p }) => a + (horParMap[hor]?.[p] || 0), 0) })

    const parTotals: Record<string, number> = {}
    ALLP.forEach(({ p }) => { parTotals[p] = hors.reduce((a, hor) => a + (horParMap[hor]?.[p] || 0), 0) })
    const grandTotal = Object.values(parTotals).reduce((a, b) => a + b, 0)

    const parUsados = ALLP  // show ALL paraderos regardless of data
    const agUsados = AGK   // show ALL agrupadores

    return { hors, horParMap, horTotals, parTotals, parUsados, agUsados, grandTotal }
  }

  const exportarReporteParaderos = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const fechaBase = filtroTipo === 'SALIDA' ? dateSalida : dateRecojo
    const fechaDisplay = new Date(fechaBase + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'INGRESO'
    const { hors, horParMap, horTotals, parUsados, agUsados, parTotals, grandTotal } = buildParaderosData(filtroTipo)

    const DARK_BLUE = '#0d2b6e', MID_BLUE = '#1a3a8f', LIGHT_BLUE = '#e8edf7'
    const YELLOW_HL = '#fff3b0', YELLOW_BORDER = '#e6b800', GRAY_BORDER = '#c0c8d8', WHITE = '#ffffff'
    const maxHorTotal = Math.max(...Object.values(horTotals))

    const thBase = `background:${DARK_BLUE};color:${WHITE};font-weight:700;font-size:9px;text-align:center;border:1px solid ${GRAY_BORDER};padding:2px 3px;vertical-align:middle;`
    const thAg = `background:${MID_BLUE};color:${WHITE};font-weight:700;font-size:9px;text-align:center;border:1px solid ${GRAY_BORDER};padding:3px 4px;`
    const tdBase = `font-size:9px;text-align:center;border:1px solid ${GRAY_BORDER};padding:2px 3px;`
    const tdTotal = `font-size:9px;font-weight:800;text-align:center;border:1px solid ${GRAY_BORDER};padding:2px 4px;background:${LIGHT_BLUE};color:${DARK_BLUE};`
    const tdGrand = `font-size:9px;font-weight:900;text-align:center;border:1px solid ${DARK_BLUE};padding:2px 4px;background:${DARK_BLUE};color:${WHITE};`

    const agHeaderCells = agUsados.map((ag) => {
      const cols = AGR[ag].length
      return `<th colspan="${cols}" style="${thAg}">${ag}</th>`
    }).join('')

    const parHeaderCells = parUsados.map(({ p }) =>
      `<th style="${thBase}width:28px;min-width:28px;max-width:28px;padding:0;">
        <div style="height:90px;display:flex;align-items:center;justify-content:center;">
          <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:8px;line-height:1.2;text-align:center;">${p}</span>
        </div>
      </th>`
    ).join('')

    const dataRows = hors.map((hor) => {
      const isMax = horTotals[hor] === maxHorTotal && maxHorTotal > 0
      const rowBg = isMax ? `background:${YELLOW_HL};` : `background:${WHITE};`
      const horStyle = isMax
        ? `font-size:9px;font-weight:900;text-align:center;border:2px solid ${YELLOW_BORDER};padding:3px 6px;background:${YELLOW_HL};color:#6b4c00;white-space:nowrap;`
        : `font-size:9px;font-weight:700;text-align:center;border:1px solid ${GRAY_BORDER};padding:3px 6px;background:${LIGHT_BLUE};color:${DARK_BLUE};white-space:nowrap;`
      const cells = parUsados.map(({ p }) => {
        const v = horParMap[hor]?.[p] || 0
        const brd = isMax ? `border:1px solid ${YELLOW_BORDER};` : ''
        return `<td style="${tdBase}${rowBg}${brd}${v ? 'font-weight:700;' : `color:${GRAY_BORDER};`}">${v || ''}</td>`
      }).join('')
      const totStyle = isMax
        ? `font-size:9px;font-weight:900;text-align:center;border:2px solid ${YELLOW_BORDER};padding:2px 4px;background:${YELLOW_HL};color:#6b4c00;`
        : tdTotal
      return `<tr><td style="${horStyle}">${hor}</td>${cells}<td style="${totStyle}">${horTotals[hor] || ''}</td></tr>`
    }).join('')

    const totalCells = parUsados.map(({ p }) => {
      const v = parTotals[p] || 0
      return `<td style="${tdGrand}${v ? '' : `color:#8899cc;`}">${v || ''}</td>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;margin:16px;background:#f0f2f8}
      .card{background:white;border-radius:10px;padding:16px;box-shadow:0 4px 16px rgba(0,0,0,.12);max-width:1500px;margin:0 auto}
      table{border-collapse:collapse;width:100%}
      @media print{body{background:white;margin:6px}.card{box-shadow:none;padding:8px}@page{size:landscape;margin:8mm}}
    </style></head><body><div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-size:13px;font-weight:900;color:${DARK_BLUE};letter-spacing:0.5px;text-transform:uppercase;">Distribución de Personal en los Paraderos, ${fechaDisplay}</div>
          <div style="margin-top:3px;"><span style="font-size:10px;font-weight:700;color:white;background:${filtroTipo === 'SALIDA' ? '#d97706' : '#2563eb'};padding:2px 8px;border-radius:4px;">${tipoLabel}</span></div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th rowspan="2" style="${thBase}min-width:65px;font-size:10px;">HORARIO</th>
            ${agHeaderCells}
            <th rowspan="2" style="${thBase}min-width:46px;font-size:10px;background:#0a1f5c;">TOTAL</th>
          </tr>
          <tr>${parHeaderCells}</tr>
        </thead>
        <tbody>
          ${dataRows}
          <tr>
            <td style="${tdGrand}">TOTAL</td>
            ${totalCells}
            <td style="${tdGrand}font-size:11px;">${grandTotal}</td>
          </tr>
        </tbody>
      </table>
    </div></body></html>`

    const win = window.open('', '_blank', 'width=1500,height=900')
    if (win) { win.document.write(html); win.document.close(); win.focus() }
  }

  const exportarExcelParaderos = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const fechaBase = filtroTipo === 'SALIDA' ? dateSalida : dateRecojo
    const fechaDisplay = new Date(fechaBase + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'INGRESO'
    const { hors, horParMap, horTotals, parUsados, agUsados } = buildParaderosData(filtroTipo)

    const DARK_BLUE = '0d2b6e', MID_BLUE = '1a3a8f', LIGHT_BLUE = 'dce3f5'
    const YELLOW_HL = 'fff3b0', WHITE = 'ffffff', GRAY = 'c0c8d8'
    const maxHorTotal = Math.max(...Object.values(horTotals))

    const wb = XLSX.utils.book_new()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws: any = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merges: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = (r: number, c: number, v: string | number, s: any) => {
      ws[XLSX.utils.encode_cell({ r, c })] = { v, t: typeof v === 'number' ? 'n' : 's', s }
    }
    const addMerge = (r1: number, c1: number, r2: number, c2: number) => merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })

    const brd = { top: { style: 'thin', color: { rgb: GRAY } }, bottom: { style: 'thin', color: { rgb: GRAY } }, left: { style: 'thin', color: { rgb: GRAY } }, right: { style: 'thin', color: { rgb: GRAY } } }
    const brdDark = { top: { style: 'thin', color: { rgb: DARK_BLUE } }, bottom: { style: 'thin', color: { rgb: DARK_BLUE } }, left: { style: 'thin', color: { rgb: DARK_BLUE } }, right: { style: 'thin', color: { rgb: DARK_BLUE } } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thS = (extra?: any): any => ({ font: { bold: true, color: { rgb: WHITE }, sz: 9 }, fill: { fgColor: { rgb: DARK_BLUE } }, border: brd, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, ...extra })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thAgS = (extra?: any): any => ({ font: { bold: true, color: { rgb: WHITE }, sz: 9 }, fill: { fgColor: { rgb: MID_BLUE } }, border: brd, alignment: { horizontal: 'center', vertical: 'center' }, ...extra })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grandS = (extra?: any): any => ({ font: { bold: true, color: { rgb: WHITE }, sz: 9 }, fill: { fgColor: { rgb: DARK_BLUE } }, border: brdDark, alignment: { horizontal: 'center', vertical: 'center' }, ...extra })

    let r = 0
    sc(r, 0, `Distribución de Personal en los Paraderos — ${tipoLabel}, ${fechaDisplay}`, { font: { bold: true, sz: 13, color: { rgb: DARK_BLUE } }, alignment: { horizontal: 'left' } })
    addMerge(r, 0, r, 25); r++; r++

    // Header row 1: HORARIO + agrupadores + TOTAL
    let c = 0
    sc(r, c, 'HORARIO', thS()); addMerge(r, c, r + 1, c); c++
    agUsados.forEach((ag) => {
      const cols = AGR[ag].length
      sc(r, c, ag, thAgS()); addMerge(r, c, r, c + cols - 1); c += cols
    })
    sc(r, c, 'TOTAL', thS({ fill: { fgColor: { rgb: '0a1f5c' } } })); addMerge(r, c, r + 1, c); r++

    // Header row 2: paradero names
    c = 1
    parUsados.forEach(({ p }) => {
      sc(r, c++, p, thS({ alignment: { horizontal: 'center', vertical: 'bottom', textRotation: 90, wrapText: true } }))
    }); r++

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scf = (row: number, col: number, formula: string, s: any) => { ws[XLSX.utils.encode_cell({r:row,c:col})] = {f: formula, t:'n', s} }
    const encC = (col: number) => XLSX.utils.encode_col(col)

    const firstDataRow = r
    // Data rows
    hors.forEach((hor) => {
      const isMax = horTotals[hor] === maxHorTotal && maxHorTotal > 0
      const rowFill = isMax ? { fgColor: { rgb: YELLOW_HL } } : { fgColor: { rgb: LIGHT_BLUE } }
      const horFont = isMax
        ? { bold: true, sz: 9, color: { rgb: '6b4c00' } }
        : { bold: true, sz: 9, color: { rgb: DARK_BLUE } }
      c = 0
      sc(r, c++, hor, { font: horFont, fill: rowFill, border: brd, alignment: { horizontal: 'center', vertical: 'center' } })
      const dataStartCol = c
      parUsados.forEach(({ p }) => {
        const v = horParMap[hor]?.[p] || 0
        const cellFill = isMax ? { fgColor: { rgb: YELLOW_HL } } : { fgColor: { rgb: WHITE } }
        sc(r, c++, v || '', v
          ? { font: { bold: true, sz: 9 }, fill: cellFill, border: brd, alignment: { horizontal: 'center', vertical: 'center' } }
          : { font: { color: { rgb: GRAY }, sz: 9 }, fill: cellFill, border: brd, alignment: { horizontal: 'center', vertical: 'center' } }
        )
      })
      const totFill = isMax ? { fgColor: { rgb: YELLOW_HL } } : { fgColor: { rgb: LIGHT_BLUE } }
      const totFont = isMax ? { bold: true, sz: 9, color: { rgb: '6b4c00' } } : { bold: true, sz: 9, color: { rgb: DARK_BLUE } }
      // TOTAL col = SUM of all paradero cols in this row
      scf(r, c, `SUM(${encC(dataStartCol)}${r+1}:${encC(c-1)}${r+1})`, { font: totFont, fill: totFill, border: brd, alignment: { horizontal: 'center', vertical: 'center' } })
      r++
    })
    const lastDataRow = r - 1

    // Total row with SUM formulas per column
    c = 0
    sc(r, c++, 'TOTAL', grandS())
    parUsados.forEach(() => {
      scf(r, c, `SUM(${encC(c)}${firstDataRow+1}:${encC(c)}${lastDataRow+1})`, grandS())
      c++
    })
    // Grand total = SUM of all TOTAL col values
    const totCol = c
    scf(r, totCol, `SUM(${encC(totCol)}${firstDataRow+1}:${encC(totCol)}${lastDataRow+1})`, grandS({ font: { bold: true, sz: 10, color: { rgb: WHITE } } }))

    ws['!cols'] = [{ wch: 16 }, ...parUsados.map(() => ({ wch: 5 })), { wch: 7 }]
    ws['!rows'] = [undefined, undefined, { hpt: 20 }, { hpt: 80 }, ...hors.map(() => ({ hpt: 16 }))]
    ws['!merges'] = merges
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c } })

    XLSX.utils.book_append_sheet(wb, ws, 'Por Paradero')
    XLSX.writeFile(wb, `paraderos_${tipoLabel.toLowerCase()}_${fechaBase}.xlsx`)
  }

  const exportarReporteComedoresT = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const fechaBase = filtroTipo === 'SALIDA' ? dateSalida : dateRecojo
    const fechaDisplay = new Date(fechaBase + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    const color = filtroTipo === 'SALIDA' ? '#d97706' : '#2563eb'
    const colorLight = filtroTipo === 'SALIDA' ? '#fef3c7' : '#dbeafe'
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'INGRESO'

    const allFiltrado = all.filter((m) => m.tipo === filtroTipo)
    const hors = sortHorarios(Array.from<string>(new Set(allFiltrado.map((m: ProgUI) => m.hor))), filtroTipo)

    // Areas por horario (solo las que tienen datos en ese horario)
    const areasByHor: Record<string, string[]> = {}
    hors.forEach((h) => {
      const progsHor = allFiltrado.filter((m: ProgUI) => m.hor === h)
      areasByHor[h] = [...new Set(progsHor.map((m: ProgUI) => m.area))].sort()
    })
    const totalAreasByHor: Record<string, number> = {}
    hors.forEach((h) => { totalAreasByHor[h] = areasByHor[h].length + 1 }) // +1 for subtotal col

    const th = (extra = '') => `background:#1a7a3c;color:white;padding:4px 6px;font-size:9px;text-align:center;vertical-align:middle;border:1px solid #155e30;${extra}`
    const thD = (extra = '') => `background:#155e30;color:white;padding:3px 4px;font-size:8px;text-align:center;vertical-align:middle;border:1px solid #0f4f28;${extra}`
    const td = (extra = '') => `padding:3px 5px;font-size:9px;border:1px solid #e5e7eb;text-align:center;vertical-align:middle;${extra}`

    // Build data: ruta/fila → horario → area → cantidad
    type FilaData = {
      ruta: string; lote: string; com: string; lbl: string; rutaDisplay?: string
      vals: Record<string, Record<string, number>> // hor → area → qty
      horSubTotals: Record<string, number>
      grandTotal: number
    }
    const filasMap: FilaData[] = []
    // Grand totals per hor+area
    const horAreaGrandTotals: Record<string, Record<string, number>> = {}
    hors.forEach((h) => { horAreaGrandTotals[h] = {}; areasByHor[h].forEach((a) => { horAreaGrandTotals[h][a] = 0 }) })
    const horSubGrandTotals: Record<string, number> = {}
    hors.forEach((h) => { horSubGrandTotals[h] = 0 })
    let grandTotal = 0

    Object.entries(RUTAS).forEach(([ruta, rutaFilas]) => {
      rutaFilas.forEach((fila) => {
        const rutaTxt = ruta.replace('-', '_')
        const ridData = fila.lbl ? `${rutaTxt}_${fila.lbl}` : `${rutaTxt}_${fila.l ?? 0}_${fila.c ?? 0}`
        const vals: Record<string, Record<string, number>> = {}
        const horSubTotals: Record<string, number> = {}
        let rowTotal = 0

        hors.forEach((hor) => {
          vals[hor] = {}
          let horSub = 0
          areasByHor[hor].forEach((area) => {
            const progsHorArea = allFiltrado.filter((m: ProgUI) => m.hor === hor && m.area === area)
            let s = 0
            progsHorArea.forEach((m: ProgUI) => {
              Object.keys(m.data).forEach((ck) => { if (ck.startsWith(ridData + '||')) s += m.data[ck] || 0 })
            })
            vals[hor][area] = s
            horSub += s
            horAreaGrandTotals[hor][area] = (horAreaGrandTotals[hor][area] || 0) + s
          })
          horSubTotals[hor] = horSub
          horSubGrandTotals[hor] = (horSubGrandTotals[hor] || 0) + horSub
          rowTotal += horSub
        })

        // Always include all rows (even empty ones) to show full structure
        const displayRuta = fila.rutaDisplay || ruta
        filasMap.push({ ruta: displayRuta, lote: fila.lbl ? '' : String(fila.l ?? ''), com: fila.lbl ? '' : String(fila.c ?? ''), lbl: fila.lbl ?? '', rutaDisplay: fila.rutaDisplay, vals, horSubTotals, grandTotal: rowTotal })
        grandTotal += rowTotal
      })
    })

    // Header row 1: RUTA | LOTE | COM | TOTAL | [hor1 colspan] | [hor2 colspan] ...
    const horHeaderRow1 = hors.map((h) =>
      `<th colspan="${totalAreasByHor[h]}" style="${th('border-left:2px solid #0d5225;font-size:9px;background:#155e30;')}">${h}</th>`
    ).join('')

    // Header row 2: areas under each hor + subtotal col
    const horHeaderRow2 = hors.map((h) => {
      const areaCols = areasByHor[h].map((a) =>
        `<th style="${thD('width:26px;min-width:26px;max-width:26px;padding:0;')}">
          <div style="height:80px;display:flex;align-items:center;justify-content:center;">
            <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:8px;line-height:1.2;${a === 'Cosecha Palto' ? 'background:#fef08a;color:#713f12;font-weight:700;' : ''}">${a}</span>
          </div>
        </th>`
      ).join('')
      const subTotalCol = `<th style="${thD('min-width:30px;font-weight:800;background:#0f4f28;border-left:1px solid #6ee7b7;')}">Sub<br/>Total</th>`
      return areaCols + subTotalCol
    }).join('')

    // Build ruta spans
    const rutaSpan: Record<string, number> = {}
    filasMap.forEach((f) => { rutaSpan[f.ruta] = (rutaSpan[f.ruta] || 0) + 1 })
    const rutaRendered = new Set<string>()

    const bodyRows = filasMap.map((fila, _idx) => {
      const isFirstRuta = !rutaRendered.has(fila.ruta)
      if (isFirstRuta) rutaRendered.add(fila.ruta)
      const even = _idx % 2 === 0 ? 'background:#ffffff;' : 'background:#f9fafb;'
      const borderTop = isFirstRuta ? 'border-top:2px solid #bbf7d0;' : ''

      const rutaCell = isFirstRuta
        ? `<td rowspan="${rutaSpan[fila.ruta]}" style="${td((!fila.rutaDisplay ? 'font-weight:700;color:#2563eb;background:#eff6ff;' : 'font-weight:700;color:#6b7280;background:#f3f4f6;') + 'border-right:2px solid #bfdbfe;' + borderTop)}">${fila.rutaDisplay !== undefined ? fila.rutaDisplay : fila.ruta}</td>` : ''
      const loteComCells = fila.lbl
        ? `<td colspan="2" style="${td('color:#6b7280;font-style:italic;text-align:left;' + even + borderTop)}">${fila.lbl}</td>`
        : `<td style="${td(even + borderTop)}">${fila.lote}</td><td style="${td(even + borderTop)}">${fila.com}</td>`
      const totalVal = fila.grandTotal || ''
      const totalCell = `<td style="${td('font-weight:700;color:#059669;background:#f0fdf4;border-left:2px solid #6ee7b7;border-right:2px solid #6ee7b7;' + borderTop)}">${totalVal}</td>`

      const horCells = hors.map((h) => {
        const areaCells = areasByHor[h].map((a) => {
          const v = fila.vals[h]?.[a] || 0
          return `<td style="${td(even + borderTop + (v ? 'font-weight:600;' : 'color:#d1d5db;'))}">${v || ''}</td>`
        }).join('')
        const sub = fila.horSubTotals[h] || 0
        const subCell = `<td style="${td('font-weight:700;color:#059669;background:#f0fdf4;border-left:1px solid #6ee7b7;' + borderTop)}">${sub || ''}</td>`
        return areaCells + subCell
      }).join('')

      return `<tr>${rutaCell}${loteComCells}${totalCell}${horCells}</tr>`
    }).join('')

    // Total row
    const totalCells = hors.map((h) => {
      const areaTotals = areasByHor[h].map((a) => {
        const v = horAreaGrandTotals[h][a] || 0
        return `<td style="${td('font-weight:700;color:#14532d;background:#bbf7d0;')}">${v || ''}</td>`
      }).join('')
      const sub = horSubGrandTotals[h] || 0
      return areaTotals + `<td style="${td('font-weight:800;color:#14532d;background:#6ee7b7;border-left:1px solid #059669;')}">${sub || ''}</td>`
    }).join('')

    const html = `<html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;font-size:9px;margin:16px;background:white}
      @media print{body{margin:8px} @page{size:landscape;margin:6mm}}
    </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <h2 style="margin:0 0 4px;font-size:13px;font-weight:800">Distribución de personal en comedores, ${fechaDisplay}</h2>
          <span style="font-size:11px;font-weight:700;color:${color};padding:2px 10px;background:${colorLight};border-radius:4px;border:1px solid ${color}">${tipoLabel}</span>
        </div>
      </div>
      <table style="border-collapse:collapse;font-size:9px;width:auto">
        <thead>
          <tr>
            <th style="${th('min-width:40px;')}" rowspan="2">RUTA</th>
            <th style="${th('min-width:28px;')}" rowspan="2">LOTE</th>
            <th style="${th('min-width:28px;')}" rowspan="2">COM</th>
            <th style="${th('min-width:36px;border-left:2px solid #6ee7b7;border-right:2px solid #6ee7b7;')}" rowspan="2">TOTAL</th>
            ${horHeaderRow1}
          </tr>
          <tr>${horHeaderRow2}</tr>
        </thead>
        <tbody>
          ${bodyRows}
          <tr style="background:#bbf7d0">
            <td colspan="3" style="${td('font-weight:800;color:#14532d;text-align:left;')}">TOTAL</td>
            <td style="${td('font-weight:800;color:#14532d;border-left:2px solid #6ee7b7;border-right:2px solid #6ee7b7;')}">${grandTotal}</td>
            ${totalCells}
          </tr>
        </tbody>
      </table>
    </body></html>`

    const win = window.open('', '_blank', 'width=1600,height=900')
    if (win) { win.document.write(html); win.document.close(); win.focus() }
  }

  const exportarExcelComedoresT = (filtroTipo: 'SALIDA' | 'RECOJO') => {
    const fechaBase = filtroTipo === 'SALIDA' ? dateSalida : dateRecojo
    const fechaDisplay = new Date(fechaBase + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
    const tipoLabel = filtroTipo === 'SALIDA' ? 'SALIDA' : 'INGRESO'

    const allFiltrado = all.filter((m: ProgUI) => m.tipo === filtroTipo)
    const hors = sortHorarios(Array.from<string>(new Set(allFiltrado.map((m: ProgUI) => m.hor))), filtroTipo)

    // Areas por horario (igual que en el HTML)
    const areasByHor: Record<string, string[]> = {}
    hors.forEach((h) => {
      const progsHor = allFiltrado.filter((m: ProgUI) => m.hor === h)
      areasByHor[h] = Array.from<string>(new Set(progsHor.map((m: ProgUI) => m.area))).sort()
    })

    const WHITE = 'ffffff', GREEN_DARK = '1a7a3c', GREEN_DARK2 = '0f4f28', GREEN_MID = 'bbf7d0'
    const GREEN_PALE = 'f0fdf4', GREEN_SUB = 'd4edda', BLUE_PALE = 'eff6ff', GRAY = 'e5e7eb', CYAN = '6ee7b7'

    const brd = { top:{style:'thin',color:{rgb:GRAY}}, bottom:{style:'thin',color:{rgb:GRAY}}, left:{style:'thin',color:{rgb:GRAY}}, right:{style:'thin',color:{rgb:GRAY}} }
    const brdGreen = { top:{style:'thin',color:{rgb:CYAN}}, bottom:{style:'thin',color:{rgb:CYAN}}, left:{style:'thin',color:{rgb:CYAN}}, right:{style:'thin',color:{rgb:CYAN}} }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thS = (e?: any): any => ({ font:{bold:true,color:{rgb:WHITE},sz:9}, fill:{fgColor:{rgb:GREEN_DARK}}, border:brd, alignment:{horizontal:'center',vertical:'center',wrapText:true}, ...e })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thS2 = (e?: any): any => ({ font:{bold:true,color:{rgb:WHITE},sz:8}, fill:{fgColor:{rgb:GREEN_DARK2}}, border:brd, alignment:{horizontal:'center',vertical:'bottom',textRotation:90,wrapText:false}, ...e })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tdS = (e?: any): any => ({ font:{sz:9}, border:brd, alignment:{horizontal:'center',vertical:'center'}, ...e })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subS = (e?: any): any => ({ font:{bold:true,sz:9,color:{rgb:'14532d'}}, fill:{fgColor:{rgb:GREEN_SUB}}, border:brdGreen, alignment:{horizontal:'center',vertical:'center'}, ...e })

    const wb = XLSX.utils.book_new()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws: any = {}; const merges: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = (r: number, c: number, v: string | number, s: any) => { ws[XLSX.utils.encode_cell({r,c})] = {v, t:typeof v==='number'?'n':'s', s} }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scf = (row: number, col: number, formula: string, sty: any) => { ws[XLSX.utils.encode_cell({r:row,c:col})] = {f: formula, t:'n', s: sty} }
    const encC = (col: number) => XLSX.utils.encode_col(col)
    const addMerge = (r1: number, c1: number, r2: number, c2: number) => merges.push({s:{r:r1,c:c1},e:{r:r2,c:c2}})

    let r = 0
    sc(r, 0, `Distribución de personal en comedores — ${tipoLabel}, ${fechaDisplay}`, {font:{bold:true,sz:13},alignment:{horizontal:'left'}}); addMerge(r,0,r,25); r++; r++

    const FIXED_COLS = 4 // RUTA, LOTE, COM, TOTAL

    // Header row 1: RUTA | LOTE | COM | TOTAL | [hor colspan(areas+1)] ...
    let c = 0
    sc(r, c, 'RUTA', thS()); addMerge(r,c,r+1,c); c++
    sc(r, c, 'LOTE', thS()); addMerge(r,c,r+1,c); c++
    sc(r, c, 'COM', thS()); addMerge(r,c,r+1,c); c++
    sc(r, c, 'TOTAL', thS()); addMerge(r,c,r+1,c); c++
    hors.forEach((h) => {
      const span = areasByHor[h].length + 1 // areas + subtotal
      sc(r, c, h, thS({alignment:{horizontal:'center',vertical:'center'}}))
      if (span > 1) addMerge(r, c, r, c + span - 1)
      c += span
    })
    r++

    // Header row 2: area subcolumns + Sub Total per hor
    // Write empty bordered cells for fixed columns (they are merged from row above but need borders)
    for (let fc = 0; fc < FIXED_COLS; fc++) {
      sc(r, fc, '', thS({alignment:{horizontal:'center',vertical:'center'}}))
    }
    c = FIXED_COLS
    hors.forEach((h) => {
      areasByHor[h].forEach((a) => { sc(r, c++, a, a === 'Cosecha Palto' ? thS2({ fill: { fgColor: { rgb: 'fef08a' } }, font: { bold: true, sz: 8, color: { rgb: '713f12' } } }) : thS2()) })
      sc(r, c++, 'Sub Total', thS2({fill:{fgColor:{rgb:'0a3d20'}},font:{bold:true,sz:8,color:{rgb:CYAN}}}))
    })
    r++

    // Build data: ruta/fila → hor → area → qty
    type FilaXL = {
      ruta: string; lote: string; com: string; lbl: string; rutaDisplay?: string
      vals: Record<string, Record<string, number>>
      horSubTotals: Record<string, number>
      rowTotal: number
    }
    const filasMap: FilaXL[] = []
    const horAreaGT: Record<string, Record<string, number>> = {}
    const horSubGT: Record<string, number> = {}
    hors.forEach((h) => { horAreaGT[h] = {}; areasByHor[h].forEach((a) => { horAreaGT[h][a] = 0 }); horSubGT[h] = 0 })
    let grandTotal = 0

    Object.entries(RUTAS).forEach(([ruta, rutaFilas]) => {
      rutaFilas.forEach((fila) => {
        const rutaTxt = ruta.replace('-', '_')
        const ridData = fila.lbl ? `${rutaTxt}_${fila.lbl}` : `${rutaTxt}_${fila.l??0}_${fila.c??0}`
        const vals: Record<string, Record<string, number>> = {}
        const horSubTotals: Record<string, number> = {}
        let rowTotal = 0
        hors.forEach((hor) => {
          vals[hor] = {}
          let sub = 0
          areasByHor[hor].forEach((area) => {
            const progsHA = allFiltrado.filter((m: ProgUI) => m.hor === hor && m.area === area)
            let s = 0
            progsHA.forEach((m: ProgUI) => { Object.keys(m.data).forEach((ck) => { if (ck.startsWith(ridData+'||')) s += m.data[ck]||0 }) })
            vals[hor][area] = s; sub += s
            horAreaGT[hor][area] = (horAreaGT[hor][area]||0) + s
          })
          horSubTotals[hor] = sub; horSubGT[hor] = (horSubGT[hor]||0) + sub; rowTotal += sub
        })
        const xlDr = fila.rutaDisplay !== undefined ? (fila.rutaDisplay || ruta) : ruta
        filasMap.push({ruta: xlDr, lote:fila.lbl?'':String(fila.l??''), com:fila.lbl?'':String(fila.c??''), lbl:fila.lbl??'', rutaDisplay: fila.rutaDisplay, vals, horSubTotals, rowTotal})
        grandTotal += rowTotal
      })
    })

    // Ruta spans — use unique key per group (rutaDisplay rows are their own group)
    const rutaGroupKey = (f: FilaXL) => f.rutaDisplay !== undefined ? `__rd__${f.rutaDisplay}` : f.ruta
    const rutaSpan: Record<string, number> = {}
    filasMap.forEach((f) => { const k = rutaGroupKey(f); rutaSpan[k] = (rutaSpan[k]||0)+1 })
    const rutaStartRow: Record<string, number> = {}

    const firstDataRow = r
    filasMap.forEach((fila, fi) => {
      c = 0
      const gk = rutaGroupKey(fila)
      const isFirstRuta = rutaStartRow[gk] === undefined
      if (isFirstRuta) {
        rutaStartRow[gk] = r
        sc(r, c, fila.rutaDisplay !== undefined ? fila.rutaDisplay : fila.ruta, fila.rutaDisplay !== undefined
          ? tdS({fill:{fgColor:{rgb:'f3f4f6'}},font:{bold:true,color:{rgb:'6b7280'},sz:9},border:brd,alignment:{horizontal:'center',vertical:'center'}})
          : tdS({fill:{fgColor:{rgb:BLUE_PALE}},font:{bold:true,color:{rgb:'2563eb'},sz:9},border:brd,alignment:{horizontal:'center',vertical:'center'}}))
        if (rutaSpan[gk] > 1) addMerge(r, 0, r+rutaSpan[gk]-1, 0)
      } else {
        // Still write border for non-first rows (xlsx-js-style needs explicit border on each cell even in merged range)
        sc(r, c, '', tdS({fill:{fgColor:{rgb: fila.rutaDisplay !== undefined ? 'f3f4f6' : BLUE_PALE}},border:brd}))
      }
      c++
      const bg = fi%2===0 ? WHITE : 'f9fafb'
      if (fila.lbl) { sc(r,c++,fila.lbl,tdS({font:{italic:true,color:{rgb:'6b7280'},sz:9},fill:{fgColor:{rgb:bg}},border:brd})); addMerge(r,1,r,2); c++ }
      else {
        sc(r,c++,fila.lote,tdS({fill:{fgColor:{rgb:bg}},border:brd}))
        sc(r,c++,fila.com,tdS({fill:{fgColor:{rgb:bg}},border:brd}))
      }
      // TOTAL col placeholder - filled after hors loop
      const totalColIdx = c; c++
      const subColIndices: number[] = []
      hors.forEach((h, hi) => {
        const hbg = hi%2===0 ? WHITE : 'f0f9ff'
        const areaStart = c
        areasByHor[h].forEach((a) => {
          const v = fila.vals[h]?.[a]||0
          sc(r,c,v||'',v?tdS({font:{bold:true,sz:9},fill:{fgColor:{rgb:hbg}}}):tdS({font:{color:{rgb:'d1d5db'},sz:9},fill:{fgColor:{rgb:hbg}}}))
          c++
        })
        subColIndices.push(c)
        const areaEnd = c - 1
        if (areaEnd >= areaStart) {
          scf(r, c, `SUM(${encC(areaStart)}${r+1}:${encC(areaEnd)}${r+1})`, subS())
        } else {
          sc(r, c, '', subS())
        }
        c++
      })
      // Fill TOTAL formula
      const subRefs = subColIndices.map(ci => `${encC(ci)}${r+1}`).join(',')
      scf(r, totalColIdx, subRefs ? `SUM(${subRefs})` : '0', tdS({font:{bold:true,color:{rgb:'059669'},sz:9},fill:{fgColor:{rgb:GREEN_PALE}},border:brd}))
      r++
    })

    const lastDataRow = r - 1

    // Total row
    c = 0
    sc(r,c++,'TOTAL',subS({fill:{fgColor:{rgb:GREEN_MID}}})); addMerge(r,0,r,2); c+=2
    // Grand total col formula
    const grandSubRefs2: string[] = []
    let tc3 = FIXED_COLS
    hors.forEach((h) => { tc3 += areasByHor[h].length; grandSubRefs2.push(`${encC(tc3)}${firstDataRow+1}:${encC(tc3)}${lastDataRow+1}`); tc3++ })
    scf(r,c++,grandSubRefs2.map(ref=>`SUM(${ref})`).join('+'),subS({fill:{fgColor:{rgb:GREEN_MID}},font:{bold:true,sz:10,color:{rgb:'14532d'}}}))
    let tc4 = FIXED_COLS
    hors.forEach((h, hi) => {
      const hbg = hi%2===0 ? GREEN_MID : 'a7f3d0'
      areasByHor[h].forEach(() => {
        scf(r, tc4, `SUM(${encC(tc4)}${firstDataRow+1}:${encC(tc4)}${lastDataRow+1})`, subS({fill:{fgColor:{rgb:hbg}}}))
        tc4++
      })
      scf(r, tc4, `SUM(${encC(tc4)}${firstDataRow+1}:${encC(tc4)}${lastDataRow+1})`, subS({fill:{fgColor:{rgb:'6ee7b7'}},font:{bold:true,sz:9,color:{rgb:'14532d'}}}))
      tc4++
    })

    const totalCols = FIXED_COLS + hors.reduce((a,h) => a+areasByHor[h].length+1, 0)
    ws['!cols'] = [
      {wch:12},  // RUTA
      {wch:6},   // LOTE
      {wch:6},   // COM
      {wch:8},   // TOTAL
      ...hors.flatMap((h) => [
        ...areasByHor[h].map(() => ({wch:5})),
        {wch:8}   // Sub Total
      ])
    ]
    const maxAreaLen = hors.reduce((max: number, h: string) =>
      Math.max(max, ...areasByHor[h].map((a: string) => a.length)), 0)
    const headerHeight = Math.max(80, maxAreaLen * 5.5)
    ws['!rows'] = [undefined, undefined, {hpt:18}, {hpt: headerHeight}]
    ws['!merges'] = merges
    ws['!ref'] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r,c:totalCols-1}})
    XLSX.utils.book_append_sheet(wb, ws, 'Comedores')
    XLSX.writeFile(wb, `comedores_horario_${tipoLabel.toLowerCase()}_${fechaBase}.xlsx`)
  }

  const ResumenCard = ({ tipo }: { tipo: 'SALIDA' | 'RECOJO' }) => {
    const isSal = tipo === 'SALIDA'
    const mine = all.filter((x) => x.tipo === tipo)
    const { grupos } = buildReporteData(tipo)

    return (
      <div className={`card border-2 ${isSal ? 'border-amber-100' : 'border-blue-100'}`}>

        {/* Botones al inicio */}
        <div className="flex flex-col gap-1.5 mb-2">
          <div className="flex gap-1.5">
            <button onClick={() => exportarReporte(tipo)} className={`flex-1 text-xs font-semibold py-1.5 rounded-lg text-white ${isSal ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              📊 Por área
            </button>
            <button onClick={() => exportarExcel(tipo)} className={`flex-1 text-xs font-semibold py-1.5 rounded-lg border ${isSal ? 'border-amber-400 text-amber-700 hover:bg-amber-50' : 'border-blue-400 text-blue-700 hover:bg-blue-50'}`}>
              📥 XLS área
            </button>
          </div>

          <div className="flex gap-1.5">
            <button onClick={() => exportarReporteComedoresT(tipo)} className={`flex-1 text-xs font-semibold py-1.5 rounded-lg text-white ${isSal ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
              🍽 Por comedor
            </button>
            <button onClick={() => exportarExcelComedoresT(tipo)} className={`flex-1 text-xs font-semibold py-1.5 rounded-lg border ${isSal ? 'border-yellow-500 text-yellow-700 hover:bg-yellow-50' : 'border-cyan-500 text-cyan-700 hover:bg-cyan-50'}`}>
              📥 XLS comedor
            </button>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => exportarReporteParaderos(tipo)} className={`flex-1 text-xs font-semibold py-1.5 rounded-lg text-white ${isSal ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'}`}>
              📍 Por paradero
            </button>
            <button onClick={() => exportarExcelParaderos(tipo)} className={`flex-1 text-xs font-semibold py-1.5 rounded-lg border ${isSal ? 'border-rose-400 text-rose-700 hover:bg-rose-50' : 'border-violet-400 text-violet-700 hover:bg-violet-50'}`}>
              📥 XLS paradero
            </button>
          </div>
        </div>

        {/* Título y total */}
        <div className={`flex items-center justify-between mb-3 pt-2 border-t ${isSal ? 'border-amber-100' : 'border-blue-100'}`}>
          <span className={`text-sm font-bold ${isSal ? 'text-amber-600' : 'text-blue-600'}`}>
            {isSal ? '↑ SALIDA' : '↓ INGRESO'}
          </span>
          <span className={`text-lg font-bold ${isSal ? 'text-amber-600' : 'text-blue-600'}`}>
            {mine.reduce((a, x) => a + (x.total || 0), 0)} pers.
          </span>
        </div>

        {Object.entries(grupos).map(([hor, filas]) => (
          <div key={hor} className="mb-1">
            {filas.map((f, i) => (
              <div key={i} className="flex items-center gap-1 py-0.5 border-b border-gray-50 last:border-0">
                <span className={`text-xs font-semibold ${isSal ? 'text-amber-700' : 'text-blue-700'}`}>{hor} — {f.total} pers.</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-500">{f.sup}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">{f.area}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  const CobCard = ({ tipo }: { tipo: 'SALIDA' | 'RECOJO' }) => {
    const mine = all.filter((x) => x.tipo === tipo)
    const con = new Set(mine.map((x) => x.user))
    const ok = supervisores.filter((s) => con.has(s.username))
    const pend = supervisores.filter((s) => !con.has(s.username))

    return (
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-600">{tipo === 'SALIDA' ? 'Salida' : 'Ingreso'}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pend.length === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {pend.length === 0 ? '✓ Completo' : `${pend.length} pendientes`}
          </span>
        </div>

        {ok.map((s) => {
          const tot = mine.filter((x) => x.user === s.username).reduce((a, x) => a + (x.total || 0), 0)
          return (
            <div key={s.id} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-xs text-gray-700 flex-1">{s.nombre}</span>
              <span className="text-xs font-semibold text-green-600">{tot} pers.</span>
            </div>
          )
        })}

        {pend.map((s) => (
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
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">Panel Administrador</h2>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cerradoSalida ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
            {cerradoSalida ? '🔒 Salida cerrada' : '🔓 Salida abierta'}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cerradoRecojo ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {cerradoRecojo ? '🔒 Ingreso cerrado' : '🔓 Ingreso abierto'}
          </span>
          {loading && <span className="text-xs text-gray-400">Cargando…</span>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-amber-600 whitespace-nowrap">↑ Salida</span>
            <input
              type="date"
              value={dateSalida}
              onChange={(e) => setDateSalida(e.target.value)}
              className="input-base w-auto text-xs"
            />
            <button
              onClick={() => handleToggleTipo('SALIDA')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white whitespace-nowrap ${cerradoSalida ? 'bg-amber-500 hover:bg-amber-600' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              {cerradoSalida ? '🔓 Reabrir' : '🔒 Cerrar'}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">↓ Ingreso</span>
            <input
              type="date"
              value={dateRecojo}
              onChange={(e) => setDateRecojo(e.target.value)}
              className="input-base w-auto text-xs"
            />
            <button
              onClick={() => handleToggleTipo('RECOJO')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white whitespace-nowrap ${cerradoRecojo ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {cerradoRecojo ? '🔓 Reabrir' : '🔒 Cerrar'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Total Salida', value: sal, cls: 'text-amber-600' },
          { label: 'Total Ingreso', value: rec, cls: 'text-blue-600' },
          { label: 'Programaciones', value: all.length, cls: 'text-green-600', sub: `${areas} área(s)` },
          { label: 'Faltan registrar', value: sinDatos, cls: sinDatos > 0 ? 'text-red-600' : 'text-green-600', sub: sinDatos === 0 ? '✓ Todos registraron' : 'supervisores' },
        ].map((m) => (
          <div key={m.label} className="card py-2 px-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{m.label}</p>
              <p className={`text-lg font-bold ${m.cls}`}>{m.value}</p>
            </div>
            {m.sub && <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <ResumenCard tipo="SALIDA" />
        <ResumenCard tipo="RECOJO" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CobCard tipo="SALIDA" />
        <CobCard tipo="RECOJO" />
      </div>

      <Modal
        open={modalTipo !== null}
        title={
          modalTipo === 'SALIDA'
            ? (cerradoSalida ? 'Reabrir Salida' : 'Cerrar Salida')
            : (cerradoRecojo ? 'Reabrir Ingreso' : 'Cerrar Ingreso')
        }
        message={
          modalTipo === 'SALIDA'
            ? (cerradoSalida ? 'Se permitirá registrar salidas nuevamente. ¿Confirmas?' : 'Los supervisores no podrán registrar salidas. ¿Confirmas?')
            : (cerradoRecojo ? 'Se permitirá registrar ingresos nuevamente. ¿Confirmas?' : 'Los supervisores no podrán registrar ingresos. ¿Confirmas?')
        }
        confirmLabel={
          modalTipo === 'SALIDA'
            ? (cerradoSalida ? 'Reabrir' : 'Cerrar Salida')
            : (cerradoRecojo ? 'Reabrir' : 'Cerrar Ingreso')
        }
        confirmVariant={
          (modalTipo === 'SALIDA' ? cerradoSalida : cerradoRecojo) ? 'success' : 'danger'
        }
        onConfirm={() => void confirmToggleTipo()}
        onCancel={() => setModalTipo(null)}
      />
    </div>
  )
}
