import { useState } from 'react'
import Topbar from '../../components/Topbar'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import DashboardPanel from './DashboardPanel'
import ConsolidadoPanel from './ConsolidadoPanel'
import SupervisoresPanel from './SupervisoresPanel'
import UsuariosPanel from './UsuariosPanel'
import TendenciasPanel from './TendenciasPanel'

type AdminTab = 'dashboard' | 'consolidado' | 'supervisores' | 'usuarios' | 'tendencias'

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'consolidado', label: 'Consolidado', icon: '📋' },
  { id: 'supervisores', label: 'Supervisores', icon: '👥' },
  { id: 'usuarios', label: 'Usuarios', icon: '👤' },
  { id: 'tendencias', label: 'Tendencias', icon: '📈' },
]

export default function AdminApp() {
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [refresh, setRefresh] = useState(0)
  const { toast, showToast, clearToast } = useToast()

  const doRefresh = () => setRefresh((r) => r + 1)

  return (
    <div className="flex flex-col min-h-screen bg-[#eef1f5]">
      <Topbar />

      <div className="flex border-b border-gray-200 bg-white px-3 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'text-primary-600 border-primary-600'
                : 'text-gray-500 border-transparent hover:text-primary-600'
            }`}
          >
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-3">
          {tab === 'dashboard' && (
            <DashboardPanel refresh={refresh} onDiaChange={doRefresh} showToast={showToast} />
          )}
          {tab === 'consolidado' && <ConsolidadoPanel refresh={refresh} />}
          {tab === 'supervisores' && <SupervisoresPanel refresh={refresh} />}
          {tab === 'usuarios' && <UsuariosPanel showToast={showToast} />}
          {tab === 'tendencias' && <TendenciasPanel refresh={refresh} />}
        </div>
      </div>

      {toast && (
        <Toast key={toast.id} message={toast.message} type={toast.type} onDone={clearToast} />
      )}
    </div>
  )
}
