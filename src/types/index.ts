export type UserRole = 'admin' | 'sup'
export type TipoProgram = 'SALIDA' | 'RECOJO'

export interface User {
  user: string
  name: string
  role: UserRole
}

export interface Programacion {
  key: string
  user: string
  tipo: TipoProgram
  hor: string
  area: string
  total: number
  ts: number
}

export interface ProgramacionWithData extends Programacion {
  data: Record<string, number>
}

export interface Horario {
  id: string
  label: string
}

export interface FilaRuta {
  l?: number
  c?: number
  lbl?: string
}
