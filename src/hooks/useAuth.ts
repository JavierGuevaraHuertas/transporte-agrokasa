import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../lib/database.types'

export function useAuth() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUsuario = async (uid: string): Promise<Usuario | null> => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', uid)
      .single()

    if (error) throw error
    return data
  }

  useEffect(() => {
    let active = true

    // Suscribirse a cambios de sesión PRIMERO para no perder eventos
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return

      if (!session?.user) {
        setUsuario(null)
        setLoading(false)
        return
      }

      try {
        const data = await loadUsuario(session.user.id)
        if (!active) return
        setUsuario(data)
        setLoading(false)
      } catch (e) {
        console.error('Error en onAuthStateChange:', e)
        if (!active) return
        setUsuario(null)
        setLoading(false)
      }
    })

    // Verificar sesión inicial
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error || !data.session?.user) {
        setUsuario(null)
        setLoading(false)
      }
      // Si hay sesión, onAuthStateChange ya la maneja
    }).catch(() => {
      if (!active) return
      setUsuario(null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { usuario, loading }
}
