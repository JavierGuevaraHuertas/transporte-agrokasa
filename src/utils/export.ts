import type { ProgramacionWithData } from '../types'
import { ALLP } from './constants'

export function exportToCSV(all: ProgramacionWithData[]) {
  if (!all.length) {
    alert('Sin datos para exportar')
    return
  }

  let csv = 'Supervisor,Tipo,Horario,Area,Agrupador,Paradero,Personas\n'

  all.forEach((m) => {
    ALLP.forEach(({ ag, p }) => {
      let s = 0

      Object.keys(m.data).forEach((ck) => {
        if (ck.endsWith('||' + p)) {
          s += Number(m.data[ck] || 0)
        }
      })

      if (s > 0) {
        csv += `"${m.user}","${m.tipo}","${m.hor}","${m.area}","${ag}","${p}",${s}\n`
      }
    })
  })

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `transporte_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  URL.revokeObjectURL(url)
}