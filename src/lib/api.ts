import { supabase } from './supabase'
import type {
  Programacion,
  ProgramacionDetalle,
  Database,
} from './database.types'
import type { ProgramacionWithData } from '../types'
import { ALLP } from '../utils/constants'

// ── AUTH ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  try {
    await supabase.auth.signOut()
  } finally {
    try {
      localStorage.removeItem('trp_idx')
      sessionStorage.clear()
    } catch {
      // ignorar
    }
  }
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getUsuario(uid: string) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', uid)
    .single()

  if (error) throw error
  return data
}

// ── ÁREAS POR USUARIO ────────────────────────────────────────────────────────

export async function getUsuarioAreas(usuarioId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('usuario_areas')
    .select('area')
    .eq('usuario_id', usuarioId)

  if (error) throw error
  return data.map((r) => r.area)
}

export async function setUsuarioAreas(usuarioId: string, areas: string[]): Promise<void> {
  const { error: delErr } = await supabase
    .from('usuario_areas')
    .delete()
    .eq('usuario_id', usuarioId)

  if (delErr) throw delErr

  if (areas.length === 0) return

  const payload: Database['public']['Tables']['usuario_areas']['Insert'][] = areas.map((area) => ({
    usuario_id: usuarioId,
    area,
  }))

  const { error: insErr } = await supabase
    .from('usuario_areas')
    .insert(payload)

  if (insErr) throw insErr
}

// ── DÍAS ─────────────────────────────────────────────────────────────────────

export async function getDia(fecha: string) {
  const { data, error } = await supabase
    .from('dias')
    .select('*')
    .eq('fecha', fecha)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function setDiaEstado(
  fecha: string,
  estado: 'abierto' | 'cerrado',
  adminId: string
) {
  const existing = await getDia(fecha)

  const payload: Database['public']['Tables']['dias']['Insert'] = {
    fecha,
    estado,
    cerrado_por: estado === 'cerrado' ? adminId || null : null,
    cerrado_at: estado === 'cerrado' ? new Date().toISOString() : null,
  }

  if (existing) {
    const { error } = await supabase
      .from('dias')
      .update(payload)
      .eq('fecha', fecha)

    if (error) throw error
  } else {
    const { error } = await supabase
      .from('dias')
      .insert(payload)

    if (error) throw error
  }
}

// ── PROGRAMACIONES ──────────────────────────────────────────────────────────

export async function getProgramacionesByUser(usuarioId: string, fecha: string) {
  const { data, error } = await supabase
    .from('programaciones')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('fecha', fecha)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Programacion[]
}

export async function getAllProgramaciones(fecha: string) {
  const { data, error } = await supabase
    .from('programaciones')
    .select('*, usuarios(nombre, username)')
    .eq('fecha', fecha)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getProgramacionDetalle(programacionId: string) {
  const { data, error } = await supabase
    .from('programacion_detalle')
    .select('*')
    .eq('programacion_id', programacionId)

  if (error) throw error
  return data as ProgramacionDetalle[]
}

function detalleToData(detalle: ProgramacionDetalle[]): Record<string, number> {
  const data: Record<string, number> = {}

  detalle.forEach((row) => {
    const comedor = Number(row.comedor ?? 0)

    let rutaBase = row.ruta || ''
    const partesRuta = rutaBase.split('-')
    if (partesRuta.length > 2) {
      rutaBase = partesRuta.slice(0, 2).join('-')
    }

    const rutaTxt = rutaBase.replace('-', '_')
    const rid = row.fila_label
      ? `${rutaTxt}_${row.fila_label}`
      : `${rutaTxt}_${row.lote ?? 0}_${comedor > 0 ? comedor : 1}`

    const ck = `${rid}||${row.paradero}`
    data[ck] = row.cantidad ?? 0
  })

  return data
}

export async function getAllProgs(fecha: string): Promise<ProgramacionWithData[]> {
  const progs = await getAllProgramaciones(fecha)

  const enriched = await Promise.all(
    (progs || []).map(async (p: any) => {
      const detalle = await getProgramacionDetalle(p.id)

      return {
        key: p.id,
        user: p.usuarios?.username || '',
        tipo: p.tipo,
        hor: p.horario_label,
        area: p.area,
        total: p.total || 0,
        data: detalleToData(detalle),
      } as ProgramacionWithData
    })
  )

  return enriched
}

export async function saveProgramacion(
  usuarioId: string,
  fecha: string,
  tipo: 'SALIDA' | 'RECOJO',
  horarioId: string,
  horarioLabel: string,
  area: string,
  fData: Record<string, number>,
  editKey?: string | null  // ID del registro que se está editando
): Promise<Programacion> {
  const total = Object.values(fData).reduce((a, b) => a + (b || 0), 0)

  let progId: string

  if (editKey) {
    // ── EDICIÓN: verificar que el nuevo horario no esté usado por otra programación ──
    const { data: existing, error: checkErr } = await supabase
      .from('programaciones')
      .select('id')
      .eq('usuario_id', usuarioId)
      .eq('fecha', fecha)
      .eq('tipo', tipo)
      .eq('horario_id', horarioId)
      .eq('area', area)
      .neq('id', editKey)  // excluir el registro actual
      .maybeSingle()

    if (checkErr) throw checkErr

    if (existing) {
      throw new Error(`Ya existe una programación para ese horario y área`)
    }

    // Actualizar el registro existente
    const { data: prog, error: updErr } = await supabase
      .from('programaciones')
      .update({
        horario_id: horarioId,
        horario_label: horarioLabel,
        area,
        total,
      })
      .eq('id', editKey)
      .select()
      .single()

    if (updErr) throw updErr
    progId = prog.id

  } else {
    // ── NUEVA: verificar que no exista ya ese horario ──
    const { data: existing, error: checkErr } = await supabase
      .from('programaciones')
      .select('id')
      .eq('usuario_id', usuarioId)
      .eq('fecha', fecha)
      .eq('tipo', tipo)
      .eq('horario_id', horarioId)
      .eq('area', area)
      .maybeSingle()

    if (checkErr) throw checkErr

    if (existing) {
      throw new Error(`Ya existe una programación para ese horario y área`)
    }

    // Insertar nuevo registro
    const { data: prog, error: insProgErr } = await supabase
      .from('programaciones')
      .insert({
        usuario_id: usuarioId,
        fecha,
        tipo,
        horario_id: horarioId,
        horario_label: horarioLabel,
        area,
        total,
      })
      .select()
      .single()

    if (insProgErr) throw insProgErr
    progId = prog.id
  }

  // ── Reemplazar detalle ──
  const { error: delErr } = await supabase
    .from('programacion_detalle')
    .delete()
    .eq('programacion_id', progId)

  if (delErr) throw delErr

  const rows: Database['public']['Tables']['programacion_detalle']['Insert'][] =
    Object.entries(fData)
      .filter(([, v]) => v > 0)
      .map(([ck, cantidad]) => {
        const [ridPart, paradero] = ck.split('||')
        const parts = ridPart.split('_')
        const agrupador = ALLP.find((x) => x.p === paradero)?.ag ?? ''

        let ruta = ''
        let lote: number | null = null
        let comedor: number | null = null
        let filaLabel: string | null = null

        const penultimo = parts[parts.length - 2]
        const ultimo = parts[parts.length - 1]
        const tieneLoteComedor = /^\d+$/.test(penultimo ?? '') && /^\d+$/.test(ultimo ?? '')

        if (tieneLoteComedor) {
          lote = Number(penultimo)
          comedor = Number(ultimo)
          ruta = parts.slice(0, parts.length - 2).join('-')
        } else {
          filaLabel = parts[parts.length - 1] || null
          ruta = parts.slice(0, parts.length - 1).join('-')
        }

        return {
          programacion_id: progId,
          ruta,
          lote,
          comedor,
          fila_label: filaLabel,
          agrupador,
          paradero,
          cantidad,
        }
      })

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from('programacion_detalle')
      .insert(rows)

    if (insErr) throw insErr
  }

  // Retornar el registro actualizado
  const { data: final, error: finalErr } = await supabase
    .from('programaciones')
    .select('*')
    .eq('id', progId)
    .single()

  if (finalErr) throw finalErr
  return final as Programacion
}

export async function deleteProgramacion(id: string) {
  const { error } = await supabase
    .from('programaciones')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ── CONSOLIDADO ─────────────────────────────────────────────────────────────

export async function getConsolidadoParaderos(
  fecha: string,
  tipo?: string,
  horario?: string,
  area?: string
) {
  let q = supabase
    .from('consolidado_paraderos')
    .select('*')
    .eq('fecha', fecha)

  if (tipo && tipo !== 'ALL') q = q.eq('tipo', tipo)
  if (horario && horario !== 'ALL') q = q.eq('horario_label', horario)
  if (area && area !== 'ALL') q = q.eq('area', area)

  const { data, error } = await q
  if (error) throw error
  return data
}

export async function getConsolidadoComedores(
  fecha: string,
  tipo?: string,
  horario?: string,
  area?: string
) {
  let q = supabase
    .from('consolidado_comedores')
    .select('*')
    .eq('fecha', fecha)

  if (tipo && tipo !== 'ALL') q = q.eq('tipo', tipo)
  if (horario && horario !== 'ALL') q = q.eq('horario_label', horario)
  if (area && area !== 'ALL') q = q.eq('area', area)

  const { data, error } = await q
  if (error) throw error
  return data
}

// ── TENDENCIAS ──────────────────────────────────────────────────────────────

export async function getTendencias(desde: string, hasta: string, tipo?: string) {
  let q = supabase
    .from('tendencias_semanales')
    .select('*')
    .gte('semana', desde)
    .lte('semana', hasta)
    .order('semana')

  if (tipo && tipo !== 'ALL') q = q.eq('tipo', tipo)

  const { data, error } = await q
  if (error) throw error
  return data
}

// ── TODOS LOS USUARIOS ──────────────────────────────────────────────────────

export async function getAllUsuarios() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*, usuario_areas(area)')
    .eq('rol', 'supervisor')
    .order('nombre')

  if (error) throw error
  return data
}

// ── REALTIME ────────────────────────────────────────────────────────────────

export function suscribirProgramaciones(fecha: string, callback: () => void) {
  const channel = supabase
    .channel(`prog_${fecha}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'programaciones',
        filter: `fecha=eq.${fecha}`,
      },
      callback
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}