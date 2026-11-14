'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { Check, Moon, Sun, SunDim, SunMoon, type LucideIcon } from 'lucide-react'
import IconButton from '@/components/ui/IconButton'
import { cn, focusRing } from '@/lib/utils'
import {
  THEME_CHANGE_EVENT,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  readThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@/lib/theme'

const ICONS: Record<ThemePreference, LucideIcon> = {
  system: SunMoon,
  light: Sun,
  neutral: SunDim,
  dark: Moon,
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === THEME_STORAGE_KEY) onChange() }
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** Header button that opens a small menu to pick the color theme: Automático, Claro, Neutro u Oscuro. */
export default function ThemeMenu() {
  // The server cannot know the saved choice: it renders "system" and the client corrects it.
  const preference = useSyncExternalStore(subscribe, readThemePreference, () => 'system' as const)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()

  const current = THEME_OPTIONS.find(option => option.value === preference) ?? THEME_OPTIONS[0]
  const CurrentIcon = ICONS[current.value]

  useEffect(() => {
    if (!open) return
    // Focus the selected option so arrow keys start from it.
    itemRefs.current[THEME_OPTIONS.findIndex(option => option.value === preference)]?.focus()
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
    // Only when the menu opens: changing the theme while open must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function choose(value: ThemePreference) {
    setThemePreference(value)
    close()
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => item !== null)
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      items[(index + step + items.length) % items.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        ref={buttonRef}
        label={`Tema: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(value => !value)}
      >
        <CurrentIcon className="h-5 w-5" aria-hidden="true" />
      </IconButton>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Tema de la app"
          onKeyDown={onMenuKeyDown}
          className="animate-fade-in absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-fg-subtle">Tema</p>
          {THEME_OPTIONS.map((option, index) => {
            const Icon = ICONS[option.value]
            const selected = option.value === preference
            return (
              <button
                key={option.value}
                ref={element => { itemRefs.current[index] = element }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={-1}
                onClick={() => choose(option.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted',
                  selected && 'bg-primary-soft hover:bg-primary-soft',
                  focusRing
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', selected ? 'text-accent' : 'text-fg-subtle')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-medium', selected ? 'text-accent' : 'text-fg')}>{option.label}</span>
                  <span className="block text-xs text-fg-subtle">{option.hint}</span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
