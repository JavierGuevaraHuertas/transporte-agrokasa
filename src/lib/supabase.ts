import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,          // 🔑 mantiene sesión en refresh
    autoRefreshToken: true,        // 🔄 renueva token
    detectSessionInUrl: true,      // 🔗 necesario para auth flow
    storage: localStorage,         // 💾 asegura uso correcto en Vite
  },
})