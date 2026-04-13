import { useState, useCallback } from 'react'

interface ToastState {
  message: string
  type: 'ok' | 'warn' | 'err'
  id: number
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, type: 'ok' | 'warn' | 'err' = 'ok') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  const clearToast = useCallback(() => setToast(null), [])

  return { toast, showToast, clearToast }
}
