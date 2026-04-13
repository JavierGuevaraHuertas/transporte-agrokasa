interface ModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  confirmVariant?: 'danger' | 'success'
  onConfirm: () => void
  onCancel: () => void
}

export default function Modal({
  open, title, message, confirmLabel, confirmVariant = 'danger', onConfirm, onCancel
}: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/45 z-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-sm font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 btn-secondary py-2 text-xs">Cancelar</button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg text-white ${
              confirmVariant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
