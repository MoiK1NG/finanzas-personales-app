'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <Card>
        <div className="text-center py-4">
          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">¡Cuenta creada!</h2>
          <p className="text-sm text-gray-500">
            Revisa tu correo <strong>{email}</strong> para confirmar tu cuenta.
          </p>
          <Link href="/login" className="block mt-4 text-sm text-indigo-600 hover:underline">
            Ir al login
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Crear cuenta</h1>
      <p className="text-sm text-gray-500 mb-6">Empieza a controlar tus finanzas hoy</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre completo"
          type="text"
          placeholder="Juan Pérez"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
        />
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <Input
          label="Contraseña"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} size="lg" className="w-full">
          Crear cuenta
        </Button>
      </form>

      <p className="text-sm text-center text-gray-500 mt-4">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-indigo-600 hover:underline font-medium">
          Inicia sesión
        </Link>
      </p>
    </Card>
  )
}
