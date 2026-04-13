export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Usuario = Database['public']['Tables']['usuarios']['Row']
export type Programacion = Database['public']['Tables']['programaciones']['Row']
export type ProgramacionDetalle = Database['public']['Tables']['programacion_detalle']['Row']

export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string
          nombre: string
          username: string
          email: string | null
          rol: 'admin' | 'supervisor' | 'usuario'
          created_at: string | null
        }
        Insert: {
          id: string
          nombre: string
          username: string
          email?: string | null
          rol?: 'admin' | 'supervisor' | 'usuario'
          created_at?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          username?: string
          email?: string | null
          rol?: 'admin' | 'supervisor' | 'usuario'
          created_at?: string | null
        }
        Relationships: []
      }

      usuario_areas: {
        Row: {
          id: string
          usuario_id: string
          area: string
          created_at: string | null
        }
        Insert: {
          id?: string
          usuario_id: string
          area: string
          created_at?: string | null
        }
        Update: {
          id?: string
          usuario_id?: string
          area?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'usuario_areas_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'usuarios'
            referencedColumns: ['id']
          }
        ]
      }

      dias: {
        Row: {
          id: string
          fecha: string
          estado: 'abierto' | 'cerrado'
          cerrado_por: string | null
          cerrado_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          fecha: string
          estado?: 'abierto' | 'cerrado'
          cerrado_por?: string | null
          cerrado_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          fecha?: string
          estado?: 'abierto' | 'cerrado'
          cerrado_por?: string | null
          cerrado_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'dias_cerrado_por_fkey'
            columns: ['cerrado_por']
            isOneToOne: false
            referencedRelation: 'usuarios'
            referencedColumns: ['id']
          }
        ]
      }

      programaciones: {
        Row: {
          id: string
          usuario_id: string
          fecha: string
          tipo: 'SALIDA' | 'RECOJO'
          horario_id: string
          horario_label: string
          area: string
          created_at: string | null
        }
        Insert: {
          id?: string
          usuario_id: string
          fecha: string
          tipo: 'SALIDA' | 'RECOJO'
          horario_id: string
          horario_label: string
          area: string
          created_at?: string | null
        }
        Update: {
          id?: string
          usuario_id?: string
          fecha?: string
          tipo?: 'SALIDA' | 'RECOJO'
          horario_id?: string
          horario_label?: string
          area?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'programaciones_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'usuarios'
            referencedColumns: ['id']
          }
        ]
      }

      programacion_detalle: {
        Row: {
          id: string
          programacion_id: string
          ruta: string
          lote: number | null
          comedor: number | null
          fila_label: string | null
          agrupador: string | null
          paradero: string
          cantidad: number
          created_at: string | null
        }
        Insert: {
          id?: string
          programacion_id: string
          ruta: string
          lote?: number | null
          comedor?: number | null
          fila_label?: string | null
          agrupador?: string | null
          paradero: string
          cantidad: number
          created_at?: string | null
        }
        Update: {
          id?: string
          programacion_id?: string
          ruta?: string
          lote?: number | null
          comedor?: number | null
          fila_label?: string | null
          agrupador?: string | null
          paradero?: string
          cantidad?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'programacion_detalle_programacion_id_fkey'
            columns: ['programacion_id']
            isOneToOne: false
            referencedRelation: 'programaciones'
            referencedColumns: ['id']
          }
        ]
      }

      consolidado_paraderos: {
        Row: {
          fecha: string
          tipo: string | null
          horario_label: string | null
          area: string | null
          ruta: string | null
          lote: number | null
          comedor: number | null
          fila_label: string | null
          agrupador: string | null
          paradero: string | null
          cantidad: number | null
        }
        Insert: never
        Update: never
        Relationships: []
      }

      consolidado_comedores: {
        Row: {
          fecha: string
          tipo: string | null
          horario_label: string | null
          area: string | null
          ruta: string | null
          lote: number | null
          comedor: number | null
          fila_label: string | null
          agrupador: string | null
          paradero: string | null
          cantidad: number | null
        }
        Insert: never
        Update: never
        Relationships: []
      }

      tendencias_semanales: {
        Row: {
          semana: string
          tipo: string | null
          valor: number | null
          fecha: string | null
          area: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }

    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}