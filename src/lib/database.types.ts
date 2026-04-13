export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id:         string
          username:   string
          nombre:     string
          rol:        'admin' | 'supervisor'
          activo:     boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['usuarios']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['usuarios']['Insert']>
      }
      usuario_areas: {
        Row: {
          id:         string
          usuario_id: string
          area:       string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['usuario_areas']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['usuario_areas']['Insert']>
      }
      dias: {
        Row: {
          id:          string
          fecha:       string
          estado:      'abierto' | 'cerrado'
          cerrado_por: string | null
          cerrado_at:  string | null
          created_at:  string
        }
        Insert: Omit<Database['public']['Tables']['dias']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['dias']['Insert']>
      }
      programaciones: {
        Row: {
          id:            string
          usuario_id:    string
          fecha:         string
          tipo:          'SALIDA' | 'RECOJO'
          horario_id:    string
          horario_label: string
          area:          string
          total:         number
          created_at:    string
          updated_at:    string
        }
        Insert: Omit<Database['public']['Tables']['programaciones']['Row'], 'id' | 'total' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['programaciones']['Insert']>
      }
      programacion_detalle: {
        Row: {
          id:               string
          programacion_id:  string
          ruta:             string
          lote:             number | null
          comedor:          number | null
          fila_label:       string | null
          agrupador:        string
          paradero:         string
          cantidad:         number
          created_at:       string
        }
        Insert: Omit<Database['public']['Tables']['programacion_detalle']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['programacion_detalle']['Insert']>
      }
    }
    Views: {
      consolidado_paraderos: {
        Row: {
          fecha:         string
          tipo:          string
          horario_label: string
          agrupador:     string
          paradero:      string
          total:         number
        }
      }
      consolidado_comedores: {
        Row: {
          fecha:         string
          tipo:          string
          horario_label: string
          area:          string
          ruta:          string
          lote:          number | null
          comedor:       number | null
          fila_label:    string | null
          total:         number
        }
      }
      tendencias_semanales: {
        Row: {
          semana: string
          tipo:   string
          area:   string
          total:  number
        }
      }
    }
    Functions: {
      recalc_total_programacion: {
        Args: { prog_id: string }
        Returns: void
      }
    }
  }
}

// Tipos helpers
export type Usuario            = Database['public']['Tables']['usuarios']['Row']
export type UsuarioArea        = Database['public']['Tables']['usuario_areas']['Row']
export type Dia                = Database['public']['Tables']['dias']['Row']
export type Programacion       = Database['public']['Tables']['programaciones']['Row']
export type ProgramacionDetalle = Database['public']['Tables']['programacion_detalle']['Row']
export type ConsolidadoParadero = Database['public']['Views']['consolidado_paraderos']['Row']
export type ConsolidadoComedor  = Database['public']['Views']['consolidado_comedores']['Row']
export type TendenciaSemanal    = Database['public']['Views']['tendencias_semanales']['Row']
