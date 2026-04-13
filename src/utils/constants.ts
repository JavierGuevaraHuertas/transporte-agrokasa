import type { Horario, FilaRuta } from '../types'

export const USERS: Record<string, { pass: string; name: string; role: 'admin' | 'sup' }> = {
  admin:      { pass: 'admin',      name: 'Administrador',      role: 'admin' },
  jguevara:   { pass: 'jguevara',   name: 'Jorge Guevara',       role: 'sup' },
  cdiaz:      { pass: 'cdiaz',      name: 'Cristian Diaz',       role: 'sup' },
  tsotelo:    { pass: 'tsotelo',    name: 'Tomás Sotelo',        role: 'sup' },
  cbenites:   { pass: 'cbenites',   name: 'Candelario Benites',  role: 'sup' },
  aarroyo:    { pass: 'aarroyo',    name: 'Alberto Arroyo',      role: 'sup' },
  mchesnova:  { pass: 'mchesnova',  name: 'Mariluz Chesnova',    role: 'sup' },
}

export const SUPS = Object.entries(USERS)
  .filter(([, v]) => v.role === 'sup')
  .map(([k, v]) => ({ user: k, name: v.name }))

export const AGR: Record<string, string[]> = {
  BARRANCA:   ['Mercado Nuevo Amanecer', 'Argos', 'Los Pinos', 'La Florida'],
  SUPE:       ['Virgen del Rosario (Purmacana)', 'Rio Seco / Campiña', 'Albergue (San Nicolas)', 'Plaza de Armas Supe', 'Leticia', 'Puerto Supe', 'Reparticion', 'Grifo Petroamerica', 'Colegio Michell'],
  PARAMONGA:  ['Urb.07 de Junio', 'Plaza de Armas'],
  PATIVILCA:  ['El Porvenir', 'Buenos Aires', 'La Paradita', 'Grifo Alex', 'Vista Alegre / Galpon / Milagros'],
  MOLINOS:    ['Paradero de Mototaxi'],
  ARENALES:   ['1er Paradero'],
  AGROPENSA:  ['Chiu Chiu', 'Sta. Elena', 'Agropensa', '1° de Mayo'],
  PAMPAS:     ['Vinto Alto', 'Vinto Bajo', 'Vista Alegre', 'Pampa (Posta)'],
  ARAYA:      ['Parque Principal'],
  CASUARINAS: ['Casuarinas'],
}

export const AGK = Object.keys(AGR)

export const ALLP: { ag: string; p: string }[] = AGK.flatMap(ag =>
  AGR[ag].map(p => ({ ag, p }))
)

export const RUTAS: Record<string, FilaRuta[]> = {
  'R-1': [{ l: 1, c: 1 }, { l: 2, c: 1 }, { l: 3, c: 1 }],
  'R-2': [{ l: 15, c: 1 }, { l: 7, c: 1 }, { l: 7, c: 2 }, { l: 7, c: 3 }, { l: 1, c: 2 }, { l: 8, c: 1 }, { lbl: 'VIVERO' }, { l: 2, c: 2 }],
  'R-3': [{ l: 11, c: 1 }, { l: 9, c: 2 }, { l: 9, c: 1 }],
  'R-4': [{ l: 12, c: 2 }, { l: 12, c: 1 }, { l: 12, c: 3 }, { l: 11, c: 2 }, { l: 11, c: 3 }, { l: 11, c: 4 }],
  'R-5': [{ l: 14, c: 1 }, { l: 16, c: 2 }, { l: 16, c: 1 }, { l: 4, c: 3 }, { l: 4, c: 2 }, { l: 3, c: 3 }],
  'R-6': [{ l: 4, c: 1 }, { l: 6, c: 2 }, { l: 10, c: 1 }, { l: 6, c: 1 }, { l: 3, c: 2 }, { lbl: 'BASE ACOPIO' }],
}

export const HOR: Record<string, Horario[]> = {
  RECOJO: [
    { id: 'Rec.05:00-14:00', label: 'De 05:00 a 14:00' },
    { id: 'Rec.06:30-15:30', label: 'De 06:30 a 15:30' },
    { id: 'Rec.07:30-16:30', label: 'De 07:30 a 16:30' },
    { id: 'Rec.17:00-02:00', label: 'De 17:00 a 02:00' },
  ],
  SALIDA: [
    { id: 'Sal.14:00', label: 'Salida 14:00' },
    { id: 'Sal.16:00', label: 'Salida 16:00' },
    { id: 'Sal.15:30', label: 'Salida 15:30' },
    { id: 'Sal.17:30', label: 'Salida 17:30' },
    { id: 'Sal.13:00', label: 'Salida 13:00' },
    { id: 'Sal.17:00', label: 'Salida 17:00' },
    { id: 'Sal.23:00', label: 'Salida 23:00' },
    { id: 'Sal.2:00',  label: 'Salida 2:00'  },
  ],
}

export const ALL_AREAS = [
  'Apicola',
  'Aplicacion Arándano',
  'Aplicacion Palto',
  'Calidad',
  'Certificacion',
  'Control Biologico',
  'Cosecha Arándano',
  'Evaluacion Fitosanitaria Arándano',
  'Evaluacion Fitosanitaria FLM1',
  'Evaluacion Fitosanitaria FLM2',
  'Evaluacion Produccion',
  'Fertirriego',
  'Informacion',
  'Investigacion y Desarrollo',
  'Labores Arándano',
  'Labores Palto Fundo 1',
  'Labores Palto Fundo 2',
]

export const AREA_COLORS = [
  '#1a7a3c', '#2563eb', '#dc2626', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
  '#ea580c', '#0284c7',
]

export const getRid = (ruta: string, fila: FilaRuta) =>
  fila.lbl ? `${ruta}_${fila.lbl}` : `${ruta}_${fila.l}_${fila.c}`
