import { supabase } from './supabase'
import type { Programacion, ProgramacionDetalle } from './database.types'
import { ALLP } from '../utils/constants'

// ── AUTH ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
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
  return data.map(r => r.area)
}

export async function setUsuarioAreas(usuarioId: string, areas: string[]): Promise<void> {
  // Borrar las existentes y reinsertar
  const { error: delErr } = await supabase
    .from('usuario_areas')
    .delete()
    .eq('usuario_id', usuarioId)
  if (delErr) throw delErr

  if (areas.length === 0) return

  const { error: insErr } = await supabase
    .from('usuario_areas')
    .insert(areas.map(area => ({ usuario_id: usuarioId, area })))
  if (insErr) throw insErr
}

// ── DÍAS ─────────────────────────────────────────────────────────────────────

export async function getDia(fecha: string) {
  const { data } = await supabase
    .from('dias')
    .select('*')
    .eq('fecha', fecha)
    .maybeSingle()
  return data
}

export async function setDiaEstado(
  fecha: string,
  estado: 'abierto' | 'cerrado',
  adminId: string
) {
  const existing = await getDia(fecha)
  if (existing) {
    const { error } = await supabase
      .from('dias')
      .update({ estado, cerrado_por: estado === 'cerrado' ? adminId : null, cerrado_at: estado === 'cerrado' ? new Date().toISOString() : null })
      .eq('fecha', fecha)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('dias')
      .insert({ fecha, estado, cerrado_por: estado === 'cerrado' ? adminId : null, cerrado_at: estado === 'cerrado' ? new Date().toISOString() : null })
    if (error) throw error
  }
}

// ── PROGRAMACIONES ────────────────────────────────────────────────────────────

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

/**
 * Guarda (upsert) una programación completa con su detalle.
 * fData: Record<"ruta_lote_com||paradero", cantidad>
 */
export async function saveProgramacion(
  usuarioId: string,
  fecha: string,
  tipo: 'SALIDA' | 'RECOJO',
  horarioId: string,
  horarioLabel: string,
  area: string,
  fData: Record<string, number>
): Promise<Programacion> {
  // 1. Upsert cabecera
  const { data: prog, error: progErr } = await supabase
    .from('programaciones')
    .upsert({
      usuario_id:    usuarioId,
      fecha,
      tipo,
      horario_id:    horarioId,
      horario_label: horarioLabel,
      area,
    }, { onConflict: 'usuario_id,fecha,tipo,horario_id,area' })
    .select()
    .single()
  if (progErr) throw progErr

  // 2. Borrar detalles anteriores
  const { error: delErr } = await supabase
    .from('programacion_detalle')
    .delete()
    .eq('programacion_id', prog.id)
  if (delErr) throw delErr

  // 3. Insertar nuevos detalles
  const rows = Object.entries(fData)
    .filter(([, v]) => v > 0)
    .map(([ck, cantidad]) => {
      const [ridPart, paradero] = ck.split('||')
      const parts = ridPart.split('_')       // R-1_1_2  o  R-2_VIVERO
      const ruta = parts[0] + '-' + parts[1] // 'R-1'
      const resto = parts.slice(2)
      const filaLabel = isNaN(Number(resto[0])) ? resto[0] : null
      const lote      = filaLabel ? null : Number(resto[0])
      const comedor   = filaLabel ? null : Number(resto[1])
      const agrupador = ALLP.find(x => x.p === paradero)?.ag ?? ''
      return { programacion_id: prog.id, ruta, lote, comedor, fila_label: filaLabel, agrupador, paradero, cantidad }
    })

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('programacion_detalle').insert(rows)
    if (insErr) throw insErr
  }

  return prog
}

export async function deleteProgramacion(id: string) {
  const { error } = await supabase.from('programaciones').delete().eq('id', id)
  if (error) throw error
}

// ── CONSOLIDADO ───────────────────────────────────────────────────────────────

export async function getConsolidadoParaderos(
  fecha: string,
  tipo?: string,
  horario?: string,
  area?: string
) {
  let q = supabase.from('consolidado_paraderos').select('*').eq('fecha', fecha)
  if (tipo && tipo !== 'ALL')    q = q.eq('tipo', tipo)
  if (horario && horario !== 'ALL') q = q.eq('horario_label', horario)
  if (area && area !== 'ALL')    q = q.eq('area', area)
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
  let q = supabase.from('consolidado_comedores').select('*').eq('fecha', fecha)
  if (tipo && tipo !== 'ALL')    q = q.eq('tipo', tipo)
  if (horario && horario !== 'ALL') q = q.eq('horario_label', horario)
  if (area && area !== 'ALL')    q = q.eq('area', area)
  const { data, error } = await q
  if (error) throw error
  return data
}

// ── TENDENCIAS ────────────────────────────────────────────────────────────────

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

// ── TODOS LOS USUARIOS (para admin) ──────────────────────────────────────────

export async function getAllUsuarios() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*, usuario_areas(area)')
    .eq('rol', 'supervisor')
    .order('nombre')
  if (error) throw error
  return data
}

// ── REALTIME: suscribirse a cambios de programaciones ─────────────────────────

export function suscribirProgramaciones(
  fecha: string,
  callback: () => void
) {
  const channel = supabase
    .channel(`prog_${fecha}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'programaciones',
      filter: `fecha=eq.${fecha}`,
    }, callback)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
