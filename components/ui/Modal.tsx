'use client'

import {
  type FormEvent, type ReactNode,
  useEffect, useId, useRef, useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import IconButton from './IconButton'

const noopSubscribe = () => () => {}
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  /** Action row pinned to the bottom (buttons). Inside the form when onSubmit is set. */
  footer?: ReactNode
  /** Renders the whole panel as a <form>, so footer buttons can be type="submit". */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Bottom sheet on phones, centered dialog from `sm` up.
 * Mount it conditionally (`{open && <Modal …/>}`). Handles Escape, backdrop click,
 * focus trap, focus restore and body scroll lock. Put `data-autofocus` (or
 * `autoFocus`) on the element that should receive focus when it opens.
 */
export default function Modal({
  onClose, title, description, children, footer, onSubmit, size = 'md',
}: ModalProps) {
  const isClient = useIsClient()
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  // Element that had focus before opening (captured on first render, before any autoFocus runs).
  const restoreFocusRef = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!isClient) return
    const panel = panelRef.current
    const previouslyFocused = restoreFocusRef.current as HTMLElement | null

    // Respect a field that already took focus via autoFocus; otherwise focus [data-autofocus] or the panel.
    if (!panel?.contains(document.activeElement)) {
      const initial = panel?.querySelector<HTMLElement>('[data-autofocus]')
      ;(initial ?? panel)?.focus()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [isClient])

  if (!isClient) return null

  const panelClass = cn(
    'relative flex w-full flex-col bg-surface text-fg shadow-2xl outline-none',
    'max-h-[92dvh] rounded-t-2xl animate-sheet-in',
    'sm:max-h-[85dvh] sm:rounded-2xl sm:animate-dialog-in',
    {
      'sm:max-w-sm': size === 'sm',
      'sm:max-w-md': size === 'md',
      'sm:max-w-lg': size === 'lg',
    }
  )

  const body = (
    <>
      {/* Grab handle (phones) */}
      <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-border-strong" />
      </div>

      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold text-fg">{title}</h2>
          {description && (
            <div id={descriptionId} className="mt-0.5 text-sm text-fg-subtle">{description}</div>
          )}
        </div>
        <IconButton label="Cerrar" onClick={onClose} className="-mr-2 -mt-1.5">
          <X className="h-5 w-5" />
        </IconButton>
      </div>

      {children && (
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5',
            footer ? 'pb-4' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5'
          )}
        >
          {children}
        </div>
      )}

      {footer && (
        <div className="flex gap-2 border-t border-border px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:pb-4">
          {footer}
        </div>
      )}
    </>
  )

  const a11y = {
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': titleId,
    'aria-describedby': description ? descriptionId : undefined,
    tabIndex: -1,
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-overlay animate-fade-in" onClick={onClose} aria-hidden="true" />
      {onSubmit ? (
        <form
          ref={el => { panelRef.current = el }}
          onSubmit={onSubmit}
          noValidate
          className={panelClass}
          {...a11y}
        >
          {body}
        </form>
      ) : (
        <div ref={el => { panelRef.current = el }} className={panelClass} {...a11y}>
          {body}
        </div>
      )}
    </div>,
    document.body
  )
}
