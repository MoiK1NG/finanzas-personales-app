'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { CircleCheck, Share, Smartphone } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

/** Chromium-only event; not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'server' | 'standalone' | 'ios' | 'other'

function readPlatform(): Platform {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return 'standalone'
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  return isIOS ? 'ios' : 'other'
}

function subscribeDisplayMode(onChange: () => void) {
  const query = window.matchMedia('(display-mode: standalone)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * "Instalar en el teléfono": the app is installable (manifest + icons). Chrome/Edge/Android expose
 * beforeinstallprompt, so we offer a button there; iOS Safari has no prompt, so we show the steps.
 */
export default function InstallAppCard() {
  const platform = useSyncExternalStore<Platform>(subscribeDisplayMode, readPlatform, () => 'server')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
  }

  if (platform === 'server') return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          Instalar en el teléfono
        </CardTitle>
      </CardHeader>

      {platform === 'standalone' || installed ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <CircleCheck className="h-4 w-4 shrink-0 text-income" aria-hidden="true" />
          Ya tienes la app instalada.
        </p>
      ) : deferredPrompt ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg-muted">Ábrela desde tu pantalla de inicio, a pantalla completa.</p>
          <Button onClick={install} className="w-full sm:w-auto">
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            Instalar app
          </Button>
        </div>
      ) : platform === 'ios' ? (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-fg-muted marker:text-fg-subtle">
          <li>Abre esta página en Safari.</li>
          <li>
            Toca Compartir{' '}
            <Share className="inline h-4 w-4 align-text-bottom text-accent" aria-label="(ícono de compartir)" />.
          </li>
          <li>Elige «Añadir a pantalla de inicio».</li>
          <li>Toca «Añadir».</li>
        </ol>
      ) : (
        <p className="text-sm text-fg-muted">
          En Chrome o Edge abre el menú del navegador (⋮) y elige «Instalar aplicación» o «Añadir a pantalla de inicio».
        </p>
      )}
    </Card>
  )
}
