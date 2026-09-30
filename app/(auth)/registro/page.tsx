'use client'

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type Ref } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Eye, EyeOff, MailCheck, PartyPopper } from 'lucide-react'
import { isAuthRetryableFetchError, isAuthWeakPasswordError, type AuthError } from '@supabase/supabase-js'
import Button from '@/components/ui/Button'
import Input, { fieldClass, fieldErrorClass } from '@/components/ui/Input'
import IconButton from '@/components/ui/IconButton'
import Alert from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { cn, focusRing } from '@/lib/utils'

const MIN_PASSWORD = 6
const passwordTooShort = (min: number) => `La contraseña debe tener al menos ${min} caracteres.`
const PASSWORD_TOO_SHORT = passwordTooShort(MIN_PASSWORD)

type SignUpProblem =
  | { kind: 'exists' }
  | { kind: 'password'; message: string }
  | { kind: 'form'; message: string }

/** Turns a Supabase sign-up error into a clear Spanish message (never the raw English text). */
function signUpProblem(err: AuthError): SignUpProblem {
  const message = err.message ?? ''

  if (isAuthRetryableFetchError(err) || err.status === 0) {
    return { kind: 'form', message: 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.' }
  }
  if (
    err.code === 'user_already_exists' ||
    err.code === 'email_exists' ||
    /already (been )?registered|already exists/i.test(message)
  ) {
    return { kind: 'exists' }
  }
  const reasons = isAuthWeakPasswordError(err) ? err.reasons : []
  // The project may require more than MIN_PASSWORD: use the minimum Supabase reports when it gives one.
  const serverMin = message.match(/password[^.]*at least (\d+) characters/i)
  if (reasons.includes('length') || serverMin || /password.*too short/i.test(message)) {
    return {
      kind: 'password',
      message: serverMin ? passwordTooShort(Number(serverMin[1])) : PASSWORD_TOO_SHORT,
    }
  }
  if (reasons.includes('pwned')) {
    return {
      kind: 'password',
      message: 'Esa contraseña apareció en filtraciones de datos conocidas. Elige una distinta.',
    }
  }
  if (reasons.includes('characters') || /password should contain/i.test(message)) {
    return {
      kind: 'password',
      message: 'La contraseña debe combinar minúsculas, mayúsculas, números y símbolos.',
    }
  }
  if (err.code === 'weak_password' || /weak password|password is (too )?weak/i.test(message)) {
    return {
      kind: 'password',
      message: 'Esa contraseña es muy fácil de adivinar. Usa una más larga que combine letras y números.',
    }
  }
  if (
    err.code === 'over_email_send_rate_limit' ||
    err.code === 'over_request_rate_limit' ||
    err.status === 429 ||
    /rate limit|too many|for security purposes/i.test(message)
  ) {
    return { kind: 'form', message: 'Demasiados intentos. Espera un minuto e intenta de nuevo.' }
  }
  if (err.code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(message)) {
    return { kind: 'form', message: 'Ese correo no es válido. Revísalo e intenta de nuevo.' }
  }
  if (err.code === 'email_address_not_authorized') {
    return { kind: 'form', message: 'No podemos enviar correos a esa dirección. Prueba con otro correo.' }
  }
  if (err.code === 'signup_disabled') {
    return { kind: 'form', message: 'El registro de cuentas nuevas está desactivado por ahora.' }
  }
  return { kind: 'form', message: 'No pudimos crear tu cuenta. Intenta de nuevo en unos minutos.' }
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

const linkButtonClass = cn(
  'inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary px-5 text-base font-medium text-primary-fg shadow-sm transition-colors hover:bg-primary-hover',
  focusRing
)

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  /** true when Supabase returned a session right away (email confirmation disabled). */
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const successHeadingRef = useRef<HTMLHeadingElement>(null)

  // The form is replaced by the confirmation: move focus to its heading so it is announced.
  useEffect(() => {
    if (success) successHeadingRef.current?.focus()
  }, [success])

  function focusPassword() {
    requestAnimationFrame(() => passwordRef.current?.focus())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPasswordError(null)
    setAccountExists(false)

    if (password.length < MIN_PASSWORD) {
      setPasswordError(PASSWORD_TOO_SHORT)
      focusPassword()
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })

      setLoading(false)

      if (err) {
        const problem = signUpProblem(err)
        if (problem.kind === 'exists') {
          setAccountExists(true)
        } else if (problem.kind === 'password') {
          setPasswordError(problem.message)
          focusPassword()
        } else {
          setError(problem.message)
        }
        return
      }

      // With email confirmation on, an already registered email comes back without an error
      // but with an obfuscated user that has no identities: no account was created, no email sent.
      if (data.user && data.user.identities?.length === 0) {
        setAccountExists(true)
        return
      }

      setSignedIn(Boolean(data.session))
      setSuccess(true)
    } catch {
      setLoading(false)
      setError('No pudimos crear tu cuenta. Revisa tu conexión e intenta de nuevo.')
    }
  }

  if (success) {
    const Icon = signedIn ? PartyPopper : MailCheck
    return (
      <Card padding="lg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-income-soft">
            <Icon className="h-6 w-6 text-income" aria-hidden="true" />
          </div>
          <h1
            ref={successHeadingRef}
            tabIndex={-1}
            className="text-xl font-bold tracking-tight text-fg outline-hidden"
          >
            ¡Cuenta creada!
          </h1>
          {signedIn ? (
            <p className="mt-2 text-sm text-fg-muted">Ya puedes empezar a organizar tu presupuesto.</p>
          ) : (
            <p className="mt-2 text-sm text-fg-muted">
              Te enviamos un enlace a{' '}
              <strong className="font-semibold text-fg break-all">{email}</strong>. Ábrelo para
              confirmar tu cuenta y luego inicia sesión.
            </p>
          )}
          <Link href={signedIn ? '/' : '/login'} className={cn(linkButtonClass, 'mt-6')}>
            {signedIn ? 'Ir al inicio' : 'Ir a iniciar sesión'}
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card padding="lg">
      <h1 className="text-xl font-bold tracking-tight text-fg">Crear cuenta</h1>
      <p className="mt-1 text-sm text-fg-subtle">Empieza a controlar tus finanzas hoy</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          label="Nombre completo"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Juan Pérez"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
        />
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
          onChange={e => {
            setEmail(e.target.value)
            if (accountExists) setAccountExists(false)
          }}
          required
        />
        <PasswordInput
          ref={passwordRef}
          label="Contraseña"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          hint={`Mínimo ${MIN_PASSWORD} caracteres`}
          error={passwordError ?? undefined}
          value={password}
          onChange={e => {
            setPassword(e.target.value)
            if (passwordError) setPasswordError(null)
          }}
          required
        />

        {accountExists && (
          <Alert
            tone="danger"
            title="Ya existe una cuenta con ese correo"
            action={
              <Link
                href="/login"
                className={cn(
                  'inline-flex h-10 items-center justify-center rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2',
                  focusRing
                )}
              >
                Iniciar sesión
              </Link>
            }
          >
            Inicia sesión con ese correo o usa uno distinto.
          </Alert>
        )}

        {error && <Alert tone="danger">{error}</Alert>}

        <Button type="submit" loading={loading} size="lg" className="w-full">
          Crear cuenta
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-fg-subtle">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/login"
          className={cn(
            'inline-block rounded py-2.5 font-medium text-accent underline-offset-4 hover:underline',
            focusRing
          )}
        >
          Inicia sesión
        </Link>
      </p>
    </Card>
  )
}
