'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/Spinner'
import { useSignOut } from '@/hooks/useSignOut'
import type { Profile } from '@/types/database'
import { Coins, Lock, LogOut, RefreshCw, User } from 'lucide-react'

const LOAD_ERROR = 'No pudimos cargar tu perfil. Revisa tu conexión e intenta de nuevo.'

export default function ConfiguracionPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** getUser() returned no user: there is nothing to edit until the profile loads. */
  const [noUser, setNoUser] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const { signOut, signingOut, signOutError } = useSignOut()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setNoUser(true)
        setLoadError(LOAD_ERROR)
        setLoading(false)
        return
      }

      setEmail(user.email ?? '')
      const { data: prof, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      setFullName(prof?.full_name ?? '')
      if (error) setLoadError(LOAD_ERROR)
      setLoading(false)
    }
    load()
  }, [reloadKey])

  function retryLoad() {
    setLoading(true)
    setLoadError(null)
    setNoUser(false)
    setReloadKey(k => k + 1)
  }

  const savedName = profile?.full_name ?? ''
  const hasChanges = fullName.trim() !== savedName.trim()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSuccess(false)

    if (!fullName.trim()) {
      setNameError('Ingresa tu nombre.')
      // Move focus to the field so its error (linked through aria-describedby) is read out.
      nameRef.current?.focus()
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSaveError('No pudimos verificar tu sesión. Revisa tu conexión o vuelve a iniciar sesión.')
        return
      }

      const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
      if (error) {
        setSaveError('No pudimos guardar los cambios. Intenta de nuevo.')
        return
      }

      setProfile(prev => (prev ? { ...prev, full_name: fullName.trim() } : prev))
      setSuccess(true)
    } catch {
      setSaveError('No pudimos guardar los cambios. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Header userName={profile?.full_name} />

      <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6 space-y-5 sm:space-y-6">
        <PageHeader title="Configuración" />

        <div className="max-w-2xl space-y-4 sm:space-y-5">
          {loadError && (
            <Alert
              tone="danger"
              action={
                <Button variant="secondary" size="sm" onClick={retryLoad}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Reintentar
                </Button>
              }
            >
              {loadError}
            </Alert>
          )}

          {/* Perfil */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" aria-hidden="true" />
                Perfil
              </CardTitle>
            </CardHeader>

            {loading ? (
              <LoadingState className="py-8" label="Cargando perfil" />
            ) : noUser ? (
              <p className="text-sm text-fg-subtle">
                Cuando se cargue tu perfil podrás cambiar tu nombre aquí.
              </p>
            ) : (
              <form onSubmit={handleSave} noValidate className="space-y-4">
                <Input
                  ref={nameRef}
                  label="Nombre completo"
                  autoComplete="name"
                  autoCapitalize="words"
                  value={fullName}
                  onChange={e => {
                    setFullName(e.target.value)
                    if (nameError) setNameError(null)
                    if (success) setSuccess(false)
                  }}
                  placeholder="Tu nombre"
                  error={nameError ?? undefined}
                />

                <dl className="flex flex-col gap-1.5">
                  <dt className="text-sm font-medium text-fg-muted">Correo electrónico</dt>
                  <dd className="flex min-h-11 items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-base text-fg-muted sm:min-h-10 sm:text-sm">
                    <Lock className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                    <span className="min-w-0 break-all">{email || '—'}</span>
                  </dd>
                  <dd className="text-xs text-fg-subtle">No se puede cambiar</dd>
                </dl>

                {saveError && <Alert tone="danger">{saveError}</Alert>}
                {success && <Alert tone="success">Guardamos tu nombre.</Alert>}

                <Button
                  type="submit"
                  loading={saving}
                  disabled={!hasChanges}
                  className="w-full sm:w-auto"
                >
                  Guardar cambios
                </Button>
              </form>
            )}
          </Card>

          {/* Preferencias */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-4 w-4" aria-hidden="true" />
                Preferencias
              </CardTitle>
            </CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">Moneda</p>
                <p className="text-sm text-fg-subtle">Peso colombiano (COP)</p>
              </div>
              <Badge variant="gray">Fija</Badge>
            </div>
          </Card>

          {/* Sesión — the only way to sign out on phones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sesión
              </CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-fg-muted">Cierra la sesión en este dispositivo.</p>
                <Button
                  variant="secondary"
                  loading={signingOut}
                  onClick={signOut}
                  className="w-full text-expense sm:w-auto"
                >
                  {!signingOut && <LogOut className="h-4 w-4" aria-hidden="true" />}
                  Cerrar sesión
                </Button>
              </div>
              {signOutError && <Alert tone="danger">{signOutError}</Alert>}
            </div>
          </Card>
        </div>
      </main>
    </>
  )
}
