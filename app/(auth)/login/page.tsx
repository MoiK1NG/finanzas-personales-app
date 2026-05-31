'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

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

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (err) {
      setError('Correo o contraseña incorrectos')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <Card>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Bienvenido</h1>
      <p className="text-sm text-gray-500 mb-6">Inicia sesión en tu cuenta</p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="••••••••"
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
          Iniciar sesión
        </Button>
      </form>

      <p className="text-sm text-center text-gray-500 mt-4">
        ¿No tienes cuenta?{' '}
        <Link href="/registro" className="text-indigo-600 hover:underline font-medium">
          Regístrate gratis
        </Link>
      </p>
    </Card>
  )
}
