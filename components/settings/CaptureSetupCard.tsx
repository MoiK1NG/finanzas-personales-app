'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BellRing, Check, Copy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/hooks/useConfirm'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/Spinner'
import { cn, focusRing } from '@/lib/utils'
import type { CaptureToken } from '@/types/database'

type Status =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'off' }
  | { kind: 'on'; createdAt: string; lastUsedAt: string | null }

const ENDPOINT_PATH = '/api/captura'

type TestResult = 'sending' | 'ok' | 'invalid' | 'failed' | null

/** 32 random bytes, URL-safe: long enough that it cannot be guessed. */
function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function fetchStatus(): Promise<Status> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { kind: 'unavailable' }
  const { data, error } = await supabase
    .from('capture_tokens')
    .select('created_at, last_used_at')
    .eq('user_id', user.id)
    .maybeSingle<Pick<CaptureToken, 'created_at' | 'last_used_at'>>()
  if (error) return { kind: 'unavailable' }
  return data ? { kind: 'on', createdAt: data.created_at, lastUsedAt: data.last_used_at } : { kind: 'off' }
}

function formatWhen(iso: string): string {
  return format(new Date(iso), "d 'de' MMM 'de' yyyy, h:mm a", { locale: es })
}

/**
 * "Captura automática": lets the phone forward payment notifications to the app. The user creates
 * a personal key here and pastes it, with the address, into an automation app on the phone.
 */
export default function CaptureSetupCard() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  /** The key right after creating it: shown once, never stored in readable form. */
  const [newKey, setNewKey] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'url' | 'key' | null>(null)
  const [testResult, setTestResult] = useState<TestResult>(null)
  /** Key pasted to test the connection later (the app cannot show the active one again). */
  const [testKey, setTestKey] = useState('')
  const { confirm, confirmDialog } = useConfirm()

  useEffect(() => {
    let active = true
    fetchStatus().then(result => { if (active) setStatus(result) })
    return () => { active = false }
  }, [])

  const endpoint = typeof window === 'undefined' ? ENDPOINT_PATH : `${window.location.origin}${ENDPOINT_PATH}`

  async function createKey() {
    setError(null)
    setWorking(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setWorking(false)
      setError('Tu sesión expiró. Vuelve a iniciar sesión.')
      return
    }
    const key = generateKey()
    const createdAt = new Date().toISOString()
    const { error: saveError } = await supabase.from('capture_tokens').upsert({
      user_id: user.id,
      token_hash: await sha256Hex(key),
      created_at: createdAt,
      last_used_at: null,
    })
    setWorking(false)
    if (saveError) {
      setError('No se pudo crear la clave. Intenta de nuevo.')
      return
    }
    setNewKey(key)
    setTestKey('')
    setTestResult(null)
    setStatus({ kind: 'on', createdAt, lastUsedAt: null })
  }

  async function replaceKey() {
    const ok = await confirm({
      title: '¿Generar una clave nueva?',
      description: 'La clave actual deja de funcionar: tendrás que pegar la nueva en la automatización de tu teléfono.',
      confirmLabel: 'Generar clave nueva',
      tone: 'primary',
    })
    if (ok) await createKey()
  }

  async function turnOff() {
    const ok = await confirm({
      title: '¿Desactivar la captura?',
      description: 'Tu teléfono ya no podrá enviar notificaciones a la app. Lo que está en «Por clasificar» se conserva.',
      confirmLabel: 'Desactivar',
      tone: 'danger',
    })
    if (!ok) return
    setError(null)
    setWorking(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: deleteError } = user
      ? await supabase.from('capture_tokens').delete().eq('user_id', user.id)
      : { error: new Error('no session') }
    setWorking(false)
    if (deleteError) {
      setError('No se pudo desactivar. Intenta de nuevo.')
      return
    }
    setNewKey(null)
    setStatus({ kind: 'off' })
  }

  async function copy(what: 'url' | 'key', text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
    } catch {
      setError('No se pudo copiar. Mantén presionado el texto para copiarlo a mano.')
    }
  }

  /** Sends a sample notification through the same address and key the phone uses. */
  async function sendTest(key: string) {
    const trimmed = key.trim()
    if (!trimmed) return
    setTestResult('sending')
    try {
      const response = await fetch(ENDPOINT_PATH, {
        method: 'POST',
        headers: { 'content-type': 'text/plain', 'x-capture-token': trimmed },
        body: 'FinanzasApp\nPrueba de conexión\nSi ves esto en «Por clasificar», la captura funciona. Puedes descartarla.',
      })
      setTestResult(response.ok ? 'ok' : response.status === 401 ? 'invalid' : 'failed')
      // A valid key updates "Última notificación recibida".
      if (response.ok) fetchStatus().then(setStatus)
    } catch {
      setTestResult('failed')
    }
  }

  const testMessage = (idle: string) => (
    <p role="status" className={cn('text-xs', testResult === 'invalid' ? 'text-expense' : 'text-fg-subtle')}>
      {testResult === 'ok' && 'Llegó. Mírala en Movimientos → Por clasificar y descártala.'}
      {testResult === 'invalid' && 'Esa clave no coincide con la activa. Revisa que esté completa o genera una nueva.'}
      {testResult === 'failed' && 'No llegó. Revisa tu conexión e intenta de nuevo.'}
      {(testResult === null || testResult === 'sending') && idle}
    </p>
  )

  const copyRow = (label: string, value: string, what: 'url' | 'key') => (
    <div>
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg">{value}</code>
        <Button size="sm" variant="secondary" onClick={() => copy(what, value)} aria-label={`Copiar ${label.toLowerCase()}`}>
          {copied === what
            ? <Check className="h-4 w-4 text-income" aria-hidden="true" />
            : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied === what ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-4 w-4" aria-hidden="true" />
          Captura automática
        </CardTitle>
        {status.kind === 'on' && <Badge variant="green">Activa</Badge>}
      </CardHeader>

      {status.kind === 'loading' ? (
        <LoadingState className="py-6" label="Cargando captura automática" />
      ) : status.kind === 'unavailable' ? (
        <p className="text-sm text-fg-subtle">
          Esta función todavía no está activada en la base de datos.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            Tu teléfono envía a la app cada notificación de pago (Nu, Nequi, DaviPlata…) y queda en{' '}
            <Link href="/transacciones" className={cn('rounded font-medium text-accent hover:underline', focusRing)}>
              Movimientos → Por clasificar
            </Link>
            , donde eliges la categoría. Nada se registra solo.
          </p>

          {status.kind === 'off' && (
            <Button loading={working} onClick={createKey} className="w-full sm:w-auto">
              Activar captura
            </Button>
          )}

          {status.kind === 'on' && newKey && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Alert tone="warning" title="Copia la clave ahora">
                No se vuelve a mostrar. Si la pierdes, genera una nueva.
              </Alert>
              {copyRow('Dirección', endpoint, 'url')}
              {copyRow('Clave', newKey, 'key')}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="soft" size="sm" loading={testResult === 'sending'} onClick={() => sendTest(newKey)}>
                  Enviar prueba
                </Button>
                {testMessage('Comprueba que la dirección y la clave funcionan antes de ir al teléfono.')}
              </div>
            </div>
          )}

          {status.kind === 'on' && !newKey && (
            <form
              className="space-y-3 rounded-lg border border-border p-3"
              onSubmit={e => { e.preventDefault(); sendTest(testKey) }}
            >
              <p className="text-sm font-medium text-fg">Probar conexión</p>
              {copyRow('Dirección', endpoint, 'url')}
              <Input
                label="Tu clave"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={testKey}
                onChange={e => { setTestKey(e.target.value); if (testResult !== 'sending') setTestResult(null) }}
                placeholder="Pega la clave que usas en MacroDroid"
                hint="No se guarda: solo se usa para esta prueba. Si no la tienes, genera una nueva."
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="submit"
                  variant="soft"
                  size="sm"
                  loading={testResult === 'sending'}
                  disabled={!testKey.trim()}
                >
                  Enviar prueba
                </Button>
                {testMessage('Envía una notificación de prueba igual a la que manda tu teléfono.')}
              </div>
            </form>
          )}

          {status.kind === 'on' && (
            <>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-fg-subtle">Clave creada</dt>
                  <dd className="text-fg-muted">{formatWhen(status.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Última notificación recibida</dt>
                  <dd className="text-fg-muted">
                    {status.lastUsedAt ? formatWhen(status.lastUsedAt) : 'Aún no ha llegado ninguna'}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" size="sm" loading={working} onClick={replaceKey}>
                  Generar clave nueva
                </Button>
                <Button variant="ghost" size="sm" disabled={working} onClick={turnOff} className="text-expense">
                  Desactivar
                </Button>
              </div>
            </>
          )}

          {error && <Alert tone="danger">{error}</Alert>}

          <details className="rounded-lg border border-border">
            <summary className={cn('cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-fg', focusRing)}>
              Cómo configurarlo en el teléfono
            </summary>
            <div className="space-y-3 border-t border-border px-3 py-3 text-sm text-fg-muted">
              <p>
                Se hace una sola vez con una app de automatización para Android, por ejemplo MacroDroid.
                Los nombres de los menús pueden variar un poco según la versión.
              </p>
              <ol className="list-decimal space-y-2 pl-5 marker:text-fg-subtle">
                <li>Instala MacroDroid desde Play Store y dale acceso a las notificaciones cuando lo pida.</li>
                <li>
                  Crea una macro con el disparador «Notificación recibida» y elige solo tus apps de pago:
                  Nu, Nequi, DaviPlata, Davivienda, Bancolombia y Google Wallet. No incluyas el correo ni los
                  mensajes de texto: repiten el mismo pago.
                </li>
                <li>
                  Agrega la acción «Solicitud HTTP» con método POST y pega la <strong>Dirección</strong> de arriba.
                </li>
                <li>
                  En los encabezados agrega uno llamado <code className="rounded bg-surface-2 px-1">x-capture-token</code>{' '}
                  con tu <strong>Clave</strong> como valor.
                </li>
                <li>
                  En el cuerpo, de tipo texto, escribe tres líneas usando el botón de variables de la notificación:
                  el nombre de la app, el título y el texto, en ese orden y cada uno en su propia línea.
                </li>
                <li>
                  En el teléfono Xiaomi o Redmi abre Ajustes → Apps → MacroDroid: activa «Inicio automático» y pon
                  el ahorro de batería en «Sin restricciones». Si no, el sistema la cierra y deja de capturar.
                </li>
                <li>Haz un pago pequeño de prueba y revisa que aparezca en Movimientos → Por clasificar.</li>
              </ol>
            </div>
          </details>
        </div>
      )}
      {confirmDialog}
    </Card>
  )
}
