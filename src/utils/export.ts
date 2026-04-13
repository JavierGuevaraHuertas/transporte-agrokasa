import type { ProgramacionWithData } from '../types'
import { USERS } from './constants'
import { ALLP } from './constants'

export function exportToCSV(all: ProgramacionWithData[]) {
  if (!all.length) { alert('Sin datos para exportar'); return }
  const unames: Record<string, string> = {}
  Object.keys(USERS).forEach(u => { unames[u] = USERS[u].name })
  let csv = 'Supervisor,Tipo,Horario,Area,Agrupador,Paradero,Personas\n'
  all.forEach(m => {
    ALLP.forEach(({ ag, p }) => {
      let s = 0
      Object.keys(m.data).forEach(ck => { if (ck.endsWith('||' + p)) s += (parseInt(String(m.data[ck])) || 0) })
      if (s > 0) csv += `"${unames[m.user] || m.user}","${m.tipo}","${m.hor}","${m.area}","${ag}","${p}",${s}\n`
    })
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `transporte_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}
