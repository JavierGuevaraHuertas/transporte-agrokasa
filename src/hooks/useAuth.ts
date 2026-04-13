import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../lib/database.types'

export function useAuth() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUsuario = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', uid)
        .single()

      if (error) throw error
      setUsuario(data)
    } catch {
      setUsuario(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        loadUsuario(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadUsuario(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setUsuario(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { usuario, loading }
}