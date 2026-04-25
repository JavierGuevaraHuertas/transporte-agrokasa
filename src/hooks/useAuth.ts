import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../lib/database.types'

export function useAuth() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  const clearState = () => {
    setUsuario(null)
    setLoading(false)
  }

  const loadUsuario = async (uid: string) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', uid)
      .single()

    if (error) throw error
    setUsuario(data)
  }

  useEffect(() => {
    let active = true
    let resolved = false

    const safe = (fn: () => void) => {
      if (active) fn()
    }

    const finish = () => {
      resolved = true
      safe(() => setLoading(false))
    }

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) throw error
        if (!active || resolved) return

        const session = data.session

        if (!session?.user) {
          clearState()
          resolved = true
          return
        }

        await loadUsuario(session.user.id)
        finish()
      } catch (e) {
        console.error('Error inicializando auth:', e)
        resolved = true
        safe(() => clearState())
      }
    }

    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || resolved) return

      if (!session?.user) {
        resolved = true
        safe(() => clearState())
        return
      }

      setTimeout(async () => {
        try {
          if (!active || resolved) return
          await loadUsuario(session.user.id)
          finish()
        } catch (e) {
          console.error('Error en onAuthStateChange:', e)
          resolved = true
          safe(() => clearState())
        }
      }, 0)
    })

    const timeoutId = window.setTimeout(() => {
      if (resolved) return
      resolved = true
      safe(() => setLoading(false))
    }, 10000)

    return () => {
      active = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  return { usuario, loading }
}