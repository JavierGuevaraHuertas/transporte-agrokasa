import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../lib/database.types'

export function useAuth() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadUsuario(uid: string) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', uid)
      .maybeSingle()

    if (error) {
      console.error('Error cargando usuario:', error)
      return null
    }

    return data as Usuario | null
  }

  useEffect(() => {
    let active = true

    async function init() {
      try {
        const { data } = await supabase.auth.getSession()
        const session = data.session

        if (!active) return

        if (!session?.user) {
          setUsuario(null)
          setLoading(false)
          return
        }

        const u = await loadUsuario(session.user.id)

        if (!active) return
        setUsuario(u)
      } catch (error) {
        console.error('Error iniciando auth:', error)
        if (!active) return
        setUsuario(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return

      if (!session?.user) {
        setUsuario(null)
        setLoading(false)
        return
      }

      void loadUsuario(session.user.id).then((u) => {
        if (!active) return
        setUsuario(u)
        setLoading(false)
      })
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { usuario, loading }
}