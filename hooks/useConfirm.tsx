'use client'

import { type ReactNode, useCallback, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
}

/**
 * Promise-based replacement for window.confirm with the app's own dialog.
 *
 *   const { confirm, confirmDialog } = useConfirm()
 *   if (!(await confirm({ title: '¿Eliminar…?', tone: 'danger', confirmLabel: 'Eliminar' }))) return
 *   …
 *   return <>{…}{confirmDialog}</>
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    resolverRef.current?.(false)
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve
      setOptions(opts)
    })
  }, [])

  const settle = useCallback((ok: boolean) => {
    resolverRef.current?.(ok)
    resolverRef.current = null
    setOptions(null)
  }, [])

  const confirmDialog = options ? (
    <Modal
      size="sm"
      title={options.title}
      description={options.description}
      onClose={() => settle(false)}
      footer={
        <>
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => settle(false)} data-autofocus>
            {options.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button
            variant={options.tone === 'danger' ? 'danger' : 'primary'}
            className="flex-1 sm:flex-none"
            onClick={() => settle(true)}
          >
            {options.confirmLabel ?? 'Confirmar'}
          </Button>
        </>
      }
    />
  ) : null

  return { confirm, confirmDialog }
}
