'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP, formatDate } from '@/lib/utils'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { cn, getPeriodDate } from '@/lib/utils'
import type { Goal, Envelope } from '@/types/database'
import { Target, Plus, Pencil, Trash2, CheckCircle, X } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const STATUS_VARIANT: Record<string, 'gray' | 'blue' | 'green' | 'red'> = {
  pending: 'gray',
  in_progress: 'blue',
  completed: 'green',
  cancelled: 'red',
}

const PRIORITY_LABELS = ['', 'Urgente', 'Alta', 'Media', 'Baja', 'Sin prisa']

interface GoalFormData {
  name: string
  description: string
  estimated_cost: string
  saved_amount: string
  target_date: string
  priority: string
  envelope_id: string
  status: string
}

const INITIAL_FORM: GoalFormData = {
  name: '', description: '', estimated_cost: '',
  saved_amount: '0', target_date: '', priority: '3',
  envelope_id: '', status: 'pending',
}

export default function MetasPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [form, setForm] = useState<GoalFormData>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: g }, { data: e }] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).order('priority').order('created_at'),
      supabase.from('envelopes').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_savings', true),
    ])

    setGoals(g ?? [])
    setEnvelopes(e ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditingGoal(null)
    setForm(INITIAL_FORM)
    setError(null)
    setShowForm(true)
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal)
    setForm({
      name: goal.name,
      description: goal.description ?? '',
      estimated_cost: goal.estimated_cost.toString(),
      saved_amount: goal.saved_amount.toString(),
      target_date: goal.target_date ?? '',
      priority: goal.priority.toString(),
      envelope_id: goal.envelope_id ?? '',
      status: goal.status,
    })
    setError(null)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cost = parseFloat(form.estimated_cost)
    const saved = parseFloat(form.saved_amount) || 0

    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    if (!cost || cost <= 0) { setError('Ingresa un costo válido'); return }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      estimated_cost: cost,
      saved_amount: saved,
      target_date: form.target_date || null,
      priority: parseInt(form.priority),
      envelope_id: form.envelope_id || null,
      status: form.status,
    }

    if (editingGoal) {
      const { error: err } = await supabase.from('goals').update(payload).eq('id', editingGoal.id)
      if (err) { setError('Error al actualizar'); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('goals').insert({ ...payload, user_id: user!.id })
      if (err) { setError('Error al crear'); setSaving(false); return }
    }

    setSaving(false)
    setShowForm(false)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta meta?')) return
    const supabase = createClient()
    await supabase.from('goals').delete().eq('id', id)
    loadData()
  }

  async function markComplete(goal: Goal) {
    const supabase = createClient()
    await supabase.from('goals')
      .update({ status: 'completed', saved_amount: goal.estimated_cost })
      .eq('id', goal.id)
    loadData()
  }

  const active = goals.filter(g => g.status !== 'completed' && g.status !== 'cancelled')
  const done = goals.filter(g => g.status === 'completed')

  const envelopeOptions = envelopes.map(e => ({ value: e.id, label: e.name }))
  const priorityOptions = [1, 2, 3, 4, 5].map(p => ({ value: p.toString(), label: PRIORITY_LABELS[p] }))
  const statusOptions = Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

  return (
    <>
      <Header periodDate={getPeriodDate()} onPeriodChange={() => {}} />

      <main className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Metas financieras</h1>
            <p className="text-sm text-gray-500 mt-0.5">Cosas próximas por comprar y objetivos de ahorro</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nueva meta
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Active goals */}
            {active.length === 0 ? (
              <div className="text-center py-16">
                <Target className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">Sin metas activas</p>
                <p className="text-sm text-gray-400 mt-1">Agrega lo que quieres comprar o ahorrar</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {active.map(goal => {
                  const pct = goal.estimated_cost > 0
                    ? Math.min((goal.saved_amount / goal.estimated_cost) * 100, 100)
                    : 0
                  return (
                    <Card key={goal.id} className="hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{goal.name}</p>
                          <div className="flex gap-1.5 mt-1">
                            <Badge variant={STATUS_VARIANT[goal.status]}>
                              {STATUS_LABELS[goal.status]}
                            </Badge>
                            <Badge variant="gray">{PRIORITY_LABELS[goal.priority]}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <button onClick={() => openEdit(goal)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(goal.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {goal.description && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{goal.description}</p>
                      )}

                      <div className="space-y-1.5 text-sm my-3">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Costo estimado</span>
                          <span className="font-semibold">{formatCOP(goal.estimated_cost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Ahorrado</span>
                          <span className="font-semibold text-indigo-600">{formatCOP(goal.saved_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Falta</span>
                          <span className={cn('font-bold', (goal.estimated_cost - goal.saved_amount) <= 0 ? 'text-green-600' : 'text-gray-800')}>
                            {formatCOP(Math.max(0, goal.estimated_cost - goal.saved_amount))}
                          </span>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{Math.round(pct)}% ahorrado</span>
                        {goal.target_date && (
                          <span className="text-xs text-gray-400">Meta: {formatDate(goal.target_date)}</span>
                        )}
                      </div>

                      {pct >= 100 && (
                        <button
                          onClick={() => markComplete(goal)}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Marcar como completada
                        </button>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Completed */}
            {done.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Metas completadas ({done.length})
                </h2>
                <div className="space-y-2">
                  {done.map(goal => (
                    <div key={goal.id} className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-600 line-through">{goal.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-500">{formatCOP(goal.estimated_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Goal form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-gray-800">
                {editingGoal ? 'Editar meta' : 'Nueva meta'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Input
                label="Nombre"
                placeholder="Ej: iPhone 16, Viaje a Cartagena..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Descripción (opcional)"
                placeholder="Detalles de la meta..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Costo estimado"
                  prefix="$"
                  type="number"
                  placeholder="0"
                  value={form.estimated_cost}
                  onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))}
                  min="0"
                />
                <Input
                  label="Ya ahorrado"
                  prefix="$"
                  type="number"
                  placeholder="0"
                  value={form.saved_amount}
                  onChange={e => setForm(f => ({ ...f, saved_amount: e.target.value }))}
                  min="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Fecha objetivo"
                  type="date"
                  value={form.target_date}
                  onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                />
                <Select
                  label="Prioridad"
                  options={priorityOptions}
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                />
              </div>
              {editingGoal && (
                <Select
                  label="Estado"
                  options={statusOptions}
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                />
              )}
              {envelopes.length > 0 && (
                <Select
                  label="Bolsillo de ahorro vinculado"
                  options={envelopeOptions}
                  placeholder="Sin vincular"
                  value={form.envelope_id}
                  onChange={e => setForm(f => ({ ...f, envelope_id: e.target.value }))}
                />
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2 pt-1">
                <Button type="submit" loading={saving} className="flex-1">
                  {editingGoal ? 'Guardar cambios' : 'Crear meta'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
