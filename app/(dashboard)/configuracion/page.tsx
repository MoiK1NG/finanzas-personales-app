'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getPeriodDate } from '@/lib/utils'
import type { Profile } from '@/types/database'
import { User, Shield } from 'lucide-react'

export default function ConfiguracionPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email ?? '')
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      setFullName(prof?.full_name ?? '')
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <>
      <Header periodDate={getPeriodDate()} onPeriodChange={() => {}} />

      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Configuración</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <User className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">Perfil</h2>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <Input
                  label="Nombre completo"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Tu nombre"
                />
                <Input
                  label="Correo electrónico"
                  value={email}
                  disabled
                />
                <div className="flex items-center gap-3">
                  <Button type="submit" loading={saving}>
                    Guardar cambios
                  </Button>
                  {success && (
                    <p className="text-sm text-green-600 font-medium">¡Guardado!</p>
                  )}
                </div>
              </form>
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">Cuenta</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Moneda</p>
                    <p className="text-xs text-gray-500">Peso colombiano (COP)</p>
                  </div>
                  <span className="text-sm text-gray-500 font-medium">COP</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </>
  )
}
