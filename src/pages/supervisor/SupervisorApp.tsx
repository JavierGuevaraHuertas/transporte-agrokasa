import { useState } from 'react'
import type { TipoProgram } from '../../types'
import Topbar from '../../components/Topbar'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import MenuPanel from './MenuPanel'
import ListaPanel from './ListaPanel'
import FormPanel from './FormPanel'

export type SupView = 'menu' | 'lista' | 'form'

export interface FormState {
  tipo: TipoProgram
  key: string | null
  hor: string | null
  area: string | null
}

export default function SupervisorApp() {
  const [view, setView] = useState<SupView>('menu')
  const [formState, setFormState] = useState<FormState>({ tipo: 'SALIDA', key: null, hor: null, area: null })
  const [refresh, setRefresh] = useState(0)
  const { toast, showToast, clearToast } = useToast()

  const goForm = (tipo: TipoProgram, key: string | null, hor: string | null, area: string | null) => {
    setFormState({ tipo, key, hor, area })
    setView('form')
  }

  const onSaved = (msg: string) => {
    showToast(msg, 'ok')
    setRefresh(r => r + 1)
    setView('lista')
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#eef1f5]">
      <Topbar />
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-3">
          {view === 'menu' && (
            <MenuPanel
              refresh={refresh}
              onGoLista={(tipo) => { setFormState(s => ({ ...s, tipo })); setView('lista') }}
              onNewDirect={(tipo) => goForm(tipo, null, null, null)}
            />
          )}
          {view === 'lista' && (
            <ListaPanel
              tipo={formState.tipo}
              onBack={() => setView('menu')}
              onNew={() => goForm(formState.tipo, null, null, null)}
              onEdit={(key, tipo, hor, area) => goForm(tipo, key, hor, area)}
              refresh={refresh}
            />
          )}
          {view === 'form' && (
            <FormPanel
              formState={formState}
              onBack={() => setView('lista')}
              onSaved={onSaved}
            />
          )}
        </div>
      </div>
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onDone={clearToast} />}
    </div>
  )
}