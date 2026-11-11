'use client'

import { useId, useState, type InputHTMLAttributes, type Ref } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js'
import Button from '@/components/ui/Button'
import Input, { fieldClass, fieldErrorClass } from '@/components/ui/Input'
import IconButton from '@/components/ui/IconButton'
import Alert from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { cn, focusRing } from '@/lib/utils'

/** Turns a Supabase sign-in error into a clear Spanish message (never the raw English text). */
function signInErrorMessage(err: AuthError): string {
  const message = err.message ?? ''

  if (isAuthRetryableFetchError(err) || err.status === 0) {
    return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.'
  }
  if (err.code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Todavía no has confirmado tu correo. Abre el enlace que te enviamos y vuelve a intentarlo.'
  }
  if (
    err.code === 'over_request_rate_limit' ||
    err.code === 'over_email_send_rate_limit' ||
    err.status === 429 ||
    /rate limit|too many/i.test(message)
  ) {
    return 'Demasiados intentos. Espera un momento e intenta de nuevo.'
  }
  if (err.code === 'user_banned') {
    return 'Esta cuenta está bloqueada. No es posible iniciar sesión con ella.'
  }
  if (err.code === 'email_address_invalid') {
    return 'Ese correo no es válido. Revísalo e intenta de nuevo.'
  }
  if (
    err.code === 'invalid_credentials' ||
    /invalid login credentials/i.test(message) ||
    (!err.code && err.status === 400)
  ) {
    return 'Correo o contraseña incorrectos.'
  }
  return 'No pudimos iniciar sesión. Intenta de nuevo en unos minutos.'
}

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  hint?: string
  error?: string
  ref?: Ref<HTMLInputElement>
}

/** Password field with a show/hide toggle; same look and label/hint wiring as the shared Input. */
function PasswordInput({ label, hint, error, id, className, ref, ...props }: PasswordInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const [visible, setVisible] = useState(false)
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-fg-muted">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(fieldClass, error && fieldErrorClass, 'pr-12', className)}
          {...props}
        />
        <IconButton
          label="Mostrar contraseña"
          size="sm"
          aria-pressed={visible}
          aria-controls={inputId}
          onClick={() => setVisible(v => !v)}
          className="absolute right-1 top-1/2 -translate-y-1/2"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </IconButton>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-expense">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })

      if (err) {
        setError(signInErrorMessage(err))
        setLoading(false)
        return
      }
    } catch {
      setError('No pudimos iniciar sesión. Revisa tu conexión e intenta de nuevo.')
      setLoading(false)
      return
    }

    // Keep the button in its loading state while the dashboard loads.
    router.push('/')
    router.refresh()
  }

  return (
    <Card padding="lg">
      <h1 className="text-xl font-bold tracking-tight text-fg">Bienvenido</h1>
      <p className="mt-1 text-sm text-fg-subtle">Inicia sesión en tu cuenta</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          label="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="tu@correo.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <PasswordInput
          label="Contraseña"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" loading={loading} size="lg" className="w-full">
          Iniciar sesión
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-fg-subtle">
        ¿No tienes cuenta?{' '}
        <Link
          href="/registro"
          className={cn(
            'inline-block rounded py-2.5 font-medium text-accent underline-offset-4 hover:underline',
            focusRing
          )}
        >
          Regístrate gratis
        </Link>
      </p>
    </Card>
  )
}
