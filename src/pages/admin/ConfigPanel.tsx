// @ts-nocheck
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

// ── Types ────────────────────────────────────────────────────
interface Horario { id: string; tipo: 'SALIDA' | 'RECOJO'; horario_id: string; label: string; orden: number; activo: boolean }
interface Agrupador { id: string; nombre: string; orden: number; activo: boolean }
interface Paradero  { id: string; agrupador_id: string; nombre: string; orden: number; activo: boolean }
interface Ruta      { id: string; nombre: string; orden: number; activo: boolean }
interface RutaFila  { id: string; ruta_id: string; lote: number|null; comedor: number|null; etiqueta: string|null; ruta_display: string|null; orden: number; activo: boolean }
interface Area      { id: string; nombre: string; orden: number; activo: boolean }

type Section = 'horarios' | 'paraderos' | 'rutas' | 'areas'

// ── Helpers ──────────────────────────────────────────────────
const badge = (activo: boolean) =>
  activo
    ? 'bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold'
    : 'bg-gray-100 text-gray-400 text-xs px-2 py-0.5 rounded-full font-semibold'

export default function ConfigPanel() {
  const [section, setSection] = useState<Section>('horarios')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{text:string; ok:boolean} | null>(null)

  // Data
  const [horarios,    setHorarios]    = useState<Horario[]>([])
  const [agrupadores, setAgrupadores] = useState<Agrupador[]>([])
  const [paraderos,   setParaderos]   = useState<Paradero[]>([])
  const [rutas,       setRutas]       = useState<Ruta[]>([])
  const [rutaFilas,   setRutaFilas]   = useState<RutaFila[]>([])
  const [areas,       setAreas]       = useState<Area[]>([])

  // New-item forms
  const [newHor,   setNewHor]   = useState({ tipo: 'SALIDA' as 'SALIDA'|'RECOJO', horario_id: '', label: '' })
  const [newAg,    setNewAg]    = useState({ nombre: '' })
  const [newPar,   setNewPar]   = useState({ agrupador_id: '', nombre: '' })
  const [newRuta,  setNewRuta]  = useState({ nombre: '' })
  const [newFila,  setNewFila]  = useState({ ruta_id: '', lote: '', comedor: '', etiqueta: '', ruta_display: '' })
  const [newArea,  setNewArea]  = useState({ nombre: '' })
  const [selAg,    setSelAg]    = useState('')
  const [selRuta,  setSelRuta]  = useState('')

  const toast = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000) }

  const load = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (t: string) => (supabase.from(t as any) as any)
    const [h, ag, par, r, rf, a] = await Promise.all([
      q('config_horarios').select('*').order('tipo').order('orden'),
      q('config_agrupadores').select('*').order('orden'),
      q('config_paraderos').select('*').order('orden'),
      q('config_rutas').select('*').order('orden'),
      q('config_ruta_filas').select('*').order('orden'),
      q('config_areas').select('*').order('orden'),
    ])
    if (h.data)   setHorarios(h.data as Horario[])
    if (ag.data)  { setAgrupadores(ag.data as Agrupador[]); setSelAg(s => s || ag.data[0]?.id || '') }
    if (par.data) setParaderos(par.data as Paradero[])
    if (r.data)   { setRutas(r.data as Ruta[]); setSelRuta(s => s || r.data[0]?.id || '') }
    if (rf.data)  setRutaFilas(rf.data as RutaFila[])
    if (a.data)   setAreas(a.data as Area[])
  }, [])

  useEffect(() => { void load() }, [load])

  // Toggle activo — type-safe per table
  type ConfigTable = 'config_horarios' | 'config_agrupadores' | 'config_paraderos' | 'config_rutas' | 'config_ruta_filas' | 'config_areas'

  const toggle = async (table: ConfigTable, id: string, activo: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from(table) as any).update({ activo: !activo }).eq('id', id)
    void load()
  }

  // Delete
  const del = async (table: ConfigTable, id: string) => {
    if (!confirm('¿Eliminar este registro?')) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from(table) as any).delete().eq('id', id)
    void load()
    toast('Eliminado')
  }

  // ── SECTIONS ────────────────────────────────────────────────

  const SectionHorarios = () => {
    const salida = horarios.filter(h => h.tipo === 'SALIDA')
    const recojo = horarios.filter(h => h.tipo === 'RECOJO')

    const add = async () => {
      if (!newHor.horario_id || !newHor.label) return toast('Completa ID y etiqueta', false)
      setSaving(true)
      const maxOrden = horarios.filter(h => h.tipo === newHor.tipo).reduce((a, h) => Math.max(a, h.orden), 0)
      const { error } = await (supabase.from('config_horarios') as any).insert({ ...newHor, orden: maxOrden + 1 })
      setSaving(false)
      if (error) return toast(error.message, false)
      setNewHor({ tipo: 'SALIDA', horario_id: '', label: '' })
      void load(); toast('Horario creado')
    }

    const HorGroup = ({ tipo, list }: { tipo: string; list: Horario[] }) => (
      <div className="mb-4">
        <p className={`text-xs font-bold px-2 py-1 rounded mb-2 inline-block ${tipo === 'SALIDA' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
          {tipo === 'SALIDA' ? '↑ SALIDA' : '↓ INGRESO'}
        </p>
        <div className="flex flex-col gap-1.5">
          {list.map(h => (
            <div key={h.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100">
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-800">{h.label}</p>
                <p className="text-xs text-gray-400">{h.horario_id}</p>
              </div>
              <span className={badge(h.activo)}>{h.activo ? 'Activo' : 'Inactivo'}</span>
              <button onClick={() => toggle('config_horarios', h.id, h.activo)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-500">
                {h.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => del('config_horarios', h.id)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50">
                Eliminar
              </button>
            </div>
          ))}
        </div>
      </div>
    )

    return (
      <div>
        <HorGroup tipo="SALIDA" list={salida} />
        <HorGroup tipo="RECOJO" list={recojo} />
        <div className="card mt-4">
          <p className="text-xs font-bold text-gray-500 mb-3 uppercase">+ Nuevo horario</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select value={newHor.tipo} onChange={e => setNewHor(p => ({...p, tipo: e.target.value as 'SALIDA'|'RECOJO'}))} className="input-base text-xs">
                <option value="SALIDA">SALIDA</option>
                <option value="RECOJO">INGRESO</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                ID único <span className="text-gray-400 font-normal">(ej: {newHor.tipo === 'SALIDA' ? 'Sal.16:30' : 'Rec.08:00-17:00'})</span>
              </label>
              <input value={newHor.horario_id} onChange={e => setNewHor(p => ({...p, horario_id: e.target.value}))} placeholder={newHor.tipo === 'SALIDA' ? 'ej: Sal.16:30' : 'ej: Rec.08:00-17:00'} className="input-base text-xs" />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Etiqueta visible</label>
            <input value={newHor.label} onChange={e => setNewHor(p => ({...p, label: e.target.value}))} placeholder="ej: Salida 16:30" className="input-base text-xs" />
          </div>
          <button onClick={add} disabled={saving} className="btn-primary text-xs py-2 w-full">
            {saving ? 'Guardando…' : '+ Agregar horario'}
          </button>
        </div>
      </div>
    )
  }

  const SectionParaderos = () => {
    const addAg = async () => {
      if (!newAg.nombre) return toast('Escribe el nombre del agrupador', false)
      setSaving(true)
      const maxOrden = agrupadores.reduce((a, x) => Math.max(a, x.orden), 0)
      const { error } = await (supabase.from('config_agrupadores') as any).insert({ nombre: newAg.nombre.toUpperCase(), orden: maxOrden + 1 })
      setSaving(false)
      if (error) return toast(error.message, false)
      setNewAg({ nombre: '' }); void load(); toast('Agrupador creado')
    }

    const addPar = async () => {
      if (!newPar.agrupador_id || !newPar.nombre) return toast('Selecciona agrupador y escribe el nombre', false)
      setSaving(true)
      const maxOrden = paraderos.filter(p => p.agrupador_id === newPar.agrupador_id).reduce((a, p) => Math.max(a, p.orden), 0)
      const { error } = await (supabase.from('config_paraderos') as any).insert({ ...newPar, orden: maxOrden + 1 })
      setSaving(false)
      if (error) return toast(error.message, false)
      setNewPar(p => ({ ...p, nombre: '' })); void load(); toast('Paradero creado')
    }

    const agSel = agrupadores.find(a => a.id === selAg)
    const parsDeAg = paraderos.filter(p => p.agrupador_id === selAg)

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Agrupadores */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Zonas / Agrupadores</p>
          <div className="flex flex-col gap-1.5 mb-3">
            {agrupadores.map(ag => (
              <div key={ag.id} onClick={() => setSelAg(ag.id)}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${selAg === ag.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                <p className="flex-1 text-xs font-bold text-gray-700">{ag.nombre}</p>
                <span className="text-xs text-gray-400">{paraderos.filter(p => p.agrupador_id === ag.id).length} par.</span>
                <span className={badge(ag.activo)}>{ag.activo ? '●' : '○'}</span>
                <button onClick={e => { e.stopPropagation(); toggle('config_agrupadores', ag.id, ag.activo) }} className="text-xs px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 hover:bg-gray-50">
                  {ag.activo ? 'Off' : 'On'}
                </button>
              </div>
            ))}
          </div>
          <div className="card">
            <p className="text-xs font-bold text-gray-500 mb-2">+ Nueva zona</p>
            <input value={newAg.nombre} onChange={e => setNewAg({nombre: e.target.value})} placeholder="Nombre ej: LIMA NORTE" className="input-base text-xs mb-2" />
            <button onClick={addAg} disabled={saving} className="btn-primary text-xs py-1.5 w-full">Agregar zona</button>
          </div>
        </div>

        {/* Paraderos de la zona seleccionada */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">
            Paraderos {agSel ? `— ${agSel.nombre}` : '(selecciona zona)'}
          </p>
          <div className="flex flex-col gap-1.5 mb-3 max-h-64 overflow-y-auto">
            {parsDeAg.map(p => (
              <div key={p.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100">
                <p className="flex-1 text-xs text-gray-700">{p.nombre}</p>
                <span className={badge(p.activo)}>{p.activo ? '●' : '○'}</span>
                <button onClick={() => toggle('config_paraderos', p.id, p.activo)} className="text-xs px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 hover:bg-gray-50">
                  {p.activo ? 'Off' : 'On'}
                </button>
                <button onClick={() => del('config_paraderos', p.id)} className="text-xs px-1.5 py-0.5 rounded border border-red-200 text-red-400 hover:bg-red-50">✕</button>
              </div>
            ))}
            {parsDeAg.length === 0 && <p className="text-xs text-gray-300 text-center py-4">Sin paraderos</p>}
          </div>
          {selAg && (
            <div className="card">
              <p className="text-xs font-bold text-gray-500 mb-2">+ Nuevo paradero en {agSel?.nombre}</p>
              <input
                value={newPar.nombre}
                onChange={e => setNewPar({ agrupador_id: selAg, nombre: e.target.value })}
                placeholder="Nombre del paradero"
                className="input-base text-xs mb-2"
              />
              <button onClick={addPar} disabled={saving} className="btn-primary text-xs py-1.5 w-full">Agregar paradero</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const SectionRutas = () => {
    const addRuta = async () => {
      if (!newRuta.nombre) return toast('Escribe el nombre de la ruta', false)
      setSaving(true)
      const maxOrden = rutas.reduce((a, r) => Math.max(a, r.orden), 0)
      const { error } = await (supabase.from('config_rutas') as any).insert({ nombre: newRuta.nombre.toUpperCase(), orden: maxOrden + 1 })
      setSaving(false)
      if (error) return toast(error.message, false)
      setNewRuta({ nombre: '' }); void load(); toast('Ruta creada')
    }

    const addFila = async () => {
      if (!newFila.ruta_id) return toast('Selecciona una ruta', false)
      if (!newFila.etiqueta && (!newFila.lote || !newFila.comedor)) return toast('Ingresa lote+comedor o etiqueta', false)
      setSaving(true)
      const maxOrden = rutaFilas.filter(f => f.ruta_id === newFila.ruta_id).reduce((a, f) => Math.max(a, f.orden), 0)
      const { error } = await (supabase.from('config_ruta_filas') as any).insert({
        ruta_id: newFila.ruta_id,
        lote: newFila.lote ? parseInt(newFila.lote) : null,
        comedor: newFila.comedor ? parseInt(newFila.comedor) : null,
        etiqueta: newFila.etiqueta || null,
        ruta_display: newFila.ruta_display || null,
        orden: maxOrden + 1
      })
      setSaving(false)
      if (error) return toast(error.message, false)
      setNewFila(p => ({ ...p, lote: '', comedor: '', etiqueta: '', ruta_display: '' }))
      void load(); toast('Fila creada')
    }

    const rutaSel = rutas.find(r => r.id === selRuta)
    const filasDeRuta = rutaFilas.filter(f => f.ruta_id === selRuta).sort((a, b) => a.orden - b.orden)

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Rutas */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Rutas</p>
          <div className="flex flex-col gap-1.5 mb-3">
            {rutas.map(r => (
              <div key={r.id} onClick={() => { setSelRuta(r.id); setNewFila(p => ({...p, ruta_id: r.id})) }}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${selRuta === r.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                <p className="flex-1 text-xs font-bold text-blue-600">{r.nombre}</p>
                <span className="text-xs text-gray-400">{rutaFilas.filter(f => f.ruta_id === r.id).length} filas</span>
                <button onClick={e => { e.stopPropagation(); toggle('config_rutas', r.id, r.activo) }} className="text-xs px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 hover:bg-gray-50">
                  {r.activo ? 'Off' : 'On'}
                </button>
              </div>
            ))}
          </div>
          <div className="card">
            <p className="text-xs font-bold text-gray-500 mb-2">+ Nueva ruta</p>
            <input value={newRuta.nombre} onChange={e => setNewRuta({nombre: e.target.value})} placeholder="ej: R-7" className="input-base text-xs mb-2" />
            <button onClick={addRuta} disabled={saving} className="btn-primary text-xs py-1.5 w-full">Agregar ruta</button>
          </div>
        </div>

        {/* Filas de ruta */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">
            Lotes / Comedores {rutaSel ? `— ${rutaSel.nombre}` : '(selecciona ruta)'}
          </p>
          <div className="flex flex-col gap-1 mb-3 max-h-64 overflow-y-auto">
            {filasDeRuta.map(f => (
              <div key={f.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100">
                <div className="flex-1">
                  {f.etiqueta
                    ? <p className="text-xs font-semibold text-gray-500 italic">{f.etiqueta}</p>
                    : <p className="text-xs font-semibold text-gray-700">L{f.lote} - C{f.comedor}</p>
                  }
                  {f.ruta_display && <p className="text-xs text-gray-300">display: "{f.ruta_display}"</p>}
                </div>
                <button onClick={() => toggle('config_ruta_filas', f.id, f.activo)} className="text-xs px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 hover:bg-gray-50">
                  {f.activo ? 'Off' : 'On'}
                </button>
                <button onClick={() => del('config_ruta_filas', f.id)} className="text-xs px-1.5 py-0.5 rounded border border-red-200 text-red-400 hover:bg-red-50">✕</button>
              </div>
            ))}
            {filasDeRuta.length === 0 && <p className="text-xs text-gray-300 text-center py-4">Sin filas</p>}
          </div>
          {selRuta && (
            <div className="card">
              <p className="text-xs font-bold text-gray-500 mb-2">+ Nueva fila en {rutaSel?.nombre}</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Lote</label>
                  <input type="number" value={newFila.lote} onChange={e => setNewFila(p => ({...p, lote: e.target.value}))} placeholder="ej: 7" className="input-base text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Comedor</label>
                  <input type="number" value={newFila.comedor} onChange={e => setNewFila(p => ({...p, comedor: e.target.value}))} placeholder="ej: 2" className="input-base text-xs" />
                </div>
              </div>
              <div className="mb-2">
                <label className="text-xs text-gray-400 mb-1 block">Etiqueta (opcional, ej: VIVERO)</label>
                <input value={newFila.etiqueta} onChange={e => setNewFila(p => ({...p, etiqueta: e.target.value}))} placeholder="Solo si no tiene lote/comedor" className="input-base text-xs" />
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-400 mb-1 block">Mostrar como ruta (opcional, dejar vacío = usa la ruta de la fila)</label>
                <input value={newFila.ruta_display} onChange={e => setNewFila(p => ({...p, ruta_display: e.target.value}))} placeholder="ej: espacio si no tiene ruta visual" className="input-base text-xs" />
              </div>
              <button onClick={addFila} disabled={saving} className="btn-primary text-xs py-1.5 w-full">Agregar fila</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const SectionAreas = () => {
    const add = async () => {
      if (!newArea.nombre) return toast('Escribe el nombre del área', false)
      setSaving(true)
      const maxOrden = areas.reduce((a, x) => Math.max(a, x.orden), 0)
      const { error } = await (supabase.from('config_areas') as any).insert({ nombre: newArea.nombre, orden: maxOrden + 1 })
      setSaving(false)
      if (error) return toast(error.message, false)
      setNewArea({ nombre: '' }); void load(); toast('Área creada')
    }

    return (
      <div>
        <div className="flex flex-col gap-1.5 mb-4 max-h-96 overflow-y-auto">
          {areas.map(a => (
            <div key={a.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100">
              <p className="flex-1 text-xs font-semibold text-gray-700">{a.nombre}</p>
              <span className={badge(a.activo)}>{a.activo ? 'Activo' : 'Inactivo'}</span>
              <button onClick={() => toggle('config_areas', a.id, a.activo)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:bg-gray-50">
                {a.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => del('config_areas', a.id)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-400 hover:bg-red-50">✕</button>
            </div>
          ))}
        </div>
        <div className="card">
          <p className="text-xs font-bold text-gray-500 mb-2">+ Nueva área</p>
          <input value={newArea.nombre} onChange={e => setNewArea({nombre: e.target.value})} placeholder="ej: Cosecha Palto" className="input-base text-xs mb-2" />
          <button onClick={add} disabled={saving} className="btn-primary text-xs py-2 w-full">Agregar área</button>
        </div>
      </div>
    )
  }

  const SECTIONS: { id: Section; label: string; icon: string }[] = [
    { id: 'horarios',  label: 'Horarios',          icon: '🕐' },
    { id: 'paraderos', label: 'Zonas / Paraderos',  icon: '📍' },
    { id: 'rutas',     label: 'Rutas / Lotes',      icon: '🗺' },
    { id: 'areas',     label: 'Áreas laborales',    icon: '🌿' },
  ]

  return (
    <div>
      <div className="card mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⚙️</span>
          <h2 className="text-sm font-bold text-gray-900">Configuración del sistema</h2>
          <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">Solo admin</span>
        </div>
        <p className="text-xs text-gray-400">Gestiona horarios, paraderos, rutas y áreas. Los cambios se aplican inmediatamente.</p>
      </div>

      {/* Toast */}
      {msg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg text-white ${msg.ok ? 'bg-green-600' : 'bg-red-500'}`}>
          {msg.text}
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              section === s.id ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-primary-400'
            }`}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      <div className="card">
        {section === 'horarios'  && <SectionHorarios />}
        {section === 'paraderos' && <SectionParaderos />}
        {section === 'rutas'     && <SectionRutas />}
        {section === 'areas'     && <SectionAreas />}
      </div>
    </div>
  )
}
