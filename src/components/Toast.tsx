import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type: 'ok' | 'warn' | 'err'
  onDone: () => void
}

const STYLES = {
  ok:   'bg-green-100 text-green-800 border border-green-200',
  warn: 'bg-amber-100 text-amber-800 border border-amber-200',
  err:  'bg-red-100 text-red-800 border border-red-200',
}

export default function Toast({ message, type, onDone }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 300) }, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-opacity duration-300 ${STYLES[type]} ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {message}
    </div>
  )
}
