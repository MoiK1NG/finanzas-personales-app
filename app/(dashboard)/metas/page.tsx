'use client'

import { useEffect, useState, useCallback, useId } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { cn, focusRing, formatMoneyInput, formatPercent, parseMoneyInput } from '@/lib/utils'
import Header from '@/components/layout/Header'
import Alert from '@/components/ui/Alert'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import IconButton from '@/components/ui/IconButton'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Money from '@/components/ui/Money'
import MoneyInput from '@/components/ui/MoneyInput'
import PageHeader from '@/components/ui/PageHeader'
import ProgressBar from '@/components/ui/ProgressBar'
import Select from '@/components/ui/Select'
import { LoadingState } from '@/components/ui/Spinner'
import { useConfirm } from '@/hooks/useConfirm'
import type { Goal, Envelope } from '@/types/database'
import {
  CalendarDays, ChevronDown, CircleCheck, CircleSlash, Pencil, PiggyBank, Plus, Target, Trash2,
} from 'lucide-react'

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

/** Only the high priorities get a badge on the card; the list is already sorted by priority. */
const PRIORITY_BADGE: Record<number, string> = {
  1: 'Urgente',
  2: 'Prioridad alta',
}

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

/** "15 de mar", or "15 de mar 2027" when the date is not in the current year. */
function formatTargetDate(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return format(d, sameYear ? "d 'de' MMM" : "d 'de' MMM yyyy", { locale: es })
}

export default function MetasPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  // Only true on the first load: refreshes after a change keep the lists on screen.
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<'goals' | 'envelopes' | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [form, setForm] = useState<GoalFormData>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; cost?: string }>({})
  const { confirm, confirmDialog } = useConfirm()
  const cancelledListId = useId()

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: g, error: gErr }, { data: e, error: eErr }] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).order('priority').order('created_at'),
      supabase.from('envelopes').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_savings', true),
    ])

    setLoadError(gErr ? 'goals' : eErr ? 'envelopes' : null)
    setGoals(g ?? [])
    setEnvelopes(e ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function retryLoad() {
    setRetrying(true)
    await loadData()
    setRetrying(false)
  }

  function openCreate() {
    setEditingGoal(null)
    setForm(INITIAL_FORM)
    setError(null)
    setFieldErrors({})
    setShowForm(true)
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal)
    setForm({
      name: goal.name,
      description: goal.description ?? '',
      estimated_cost: formatMoneyInput(goal.estimated_cost),
      saved_amount: formatMoneyInput(goal.saved_amount),
      target_date: goal.target_date ?? '',
      priority: goal.priority.toString(),
      envelope_id: goal.envelope_id ?? '',
      status: goal.status,
    })
    setError(null)
    setFieldErrors({})
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cost = parseMoneyInput(form.estimated_cost)
    const saved = parseMoneyInput(form.saved_amount)

    const errors: { name?: string; cost?: string } = {}
    if (!form.name.trim()) errors.name = 'El nombre es obligatorio'
    if (form.estimated_cost === '') errors.cost = 'Ingresa un valor válido'
    else if (cost <= 0) errors.cost = 'El costo debe ser mayor a 0'
    setFieldErrors(errors)
    if (errors.name || errors.cost) return

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
      if (err) { setError('No se pudo guardar la meta. Intenta de nuevo.'); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('goals').insert({ ...payload, user_id: user!.id })
      if (err) { setError('No se pudo crear la meta. Intenta de nuevo.'); setSaving(false); return }
    }

    setSaving(false)
    setShowForm(false)
    loadData()
  }

  async function handleDelete(goal: Goal) {
    const ok = await confirm({
      title: `¿Eliminar la meta “${goal.name}”?`,
      description: 'Se borrará de forma permanente. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    setActionError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from('goals').delete().eq('id', goal.id)
    if (err) { setActionError(`No se pudo eliminar la meta “${goal.name}”. Intenta de nuevo.`); return }
    loadData()
  }

  async function markComplete(goal: Goal) {
    setActionError(null)
    setCompletingId(goal.id)
    const supabase = createClient()
    const { error: err } = await supabase.from('goals')
      .update({ status: 'completed', saved_amount: goal.estimated_cost })
      .eq('id', goal.id)
    if (err) {
      setCompletingId(null)
      setActionError(`No se pudo marcar “${goal.name}” como completada. Intenta de nuevo.`)
      return
    }
    await loadData()
    setCompletingId(null)
  }

  const active = goals.filter(g => g.status !== 'completed' && g.status !== 'cancelled')
  const done = goals.filter(g => g.status === 'completed')
  const cancelled = goals.filter(g => g.status === 'cancelled')

  const envelopeNames = new Map(envelopes.map(e => [e.id, e.name]))
  const today = format(new Date(), 'yyyy-MM-dd')

  const envelopeOptions = envelopes.map(e => ({ value: e.id, label: e.name }))
  const priorityOptions = [1, 2, 3, 4, 5].map(p => ({ value: p.toString(), label: PRIORITY_LABELS[p] }))
  const statusOptions = Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))

  const newGoalButton = (
    <Button onClick={openCreate}>
      <Plus className="h-4 w-4" aria-hidden="true" /> Nueva meta
    </Button>
  )

  return (
    <>
      <Header />

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6">
        <PageHeader
          title="Metas"
          subtitle="Cosas próximas por comprar y objetivos de ahorro"
          actions={newGoalButton}
        />

        {actionError && (
          <Alert
            tone="danger"
            action={
              <Button variant="ghost" size="sm" onClick={() => setActionError(null)}>
                Cerrar
              </Button>
            }
          >
            {actionError}
          </Alert>
        )}

        {loadError && (
          <Alert
            tone="danger"
            title={loadError === 'goals' ? 'No se pudieron cargar tus metas.' : 'No se pudieron cargar las categorías de ahorro.'}
            action={
              <Button variant="secondary" size="sm" loading={retrying} onClick={retryLoad}>
                Reintentar
              </Button>
            }
          >
            Revisa tu conexión e intenta de nuevo.
          </Alert>
        )}

        {loading ? (
          <LoadingState label="Cargando metas" />
        ) : loadError === 'goals' ? null : goals.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={Target}
              title="Aún no tienes metas"
              description="Agrega lo que quieres comprar o ahorrar y sigue cuánto llevas."
              action={newGoalButton}
            />
          </Card>
        ) : (
          <>
            {/* Active goals */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-fg">
                Activas <span className="font-normal tabular-nums text-fg-subtle">({active.length})</span>
              </h2>
              {active.length === 0 ? (
                <Card padding="none">
                  <EmptyState
                    icon={Target}
                    title="Sin metas activas"
                    description={
                      done.length > 0 && cancelled.length > 0
                        ? 'Tus metas completadas y canceladas están más abajo.'
                        : done.length > 0
                          ? 'Tus metas completadas están más abajo.'
                          : 'Tus metas canceladas están más abajo.'
                    }
                    action={newGoalButton}
                  />
                </Card>
              ) : (
                <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                  {active.map(goal => (
                    <li key={goal.id}>
                      <GoalCard
                        goal={goal}
                        envelopeName={goal.envelope_id ? envelopeNames.get(goal.envelope_id) : undefined}
                        today={today}
                        completing={completingId === goal.id}
                        onEdit={() => openEdit(goal)}
                        onDelete={() => handleDelete(goal)}
                        onComplete={() => markComplete(goal)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Completed */}
            {done.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-fg">
                  Completadas <span className="font-normal tabular-nums text-fg-subtle">({done.length})</span>
                </h2>
                <Card padding="none">
                  <ul role="list" className="divide-y divide-border">
                    {done.map(goal => (
                      <GoalRow
                        key={goal.id}
                        goal={goal}
                        kind="completed"
                        onEdit={() => openEdit(goal)}
                        onDelete={() => handleDelete(goal)}
                      />
                    ))}
                  </ul>
                </Card>
              </section>
            )}

            {/* Cancelled (collapsed by default) */}
            {cancelled.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setShowCancelled(v => !v)}
                    aria-expanded={showCancelled}
                    aria-controls={cancelledListId}
                    className={cn(
                      '-mx-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-fg-muted transition-colors hover:bg-muted hover:text-fg',
                      focusRing
                    )}
                  >
                    Canceladas <span className="font-normal tabular-nums text-fg-subtle">({cancelled.length})</span>
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', showCancelled && 'rotate-180')}
                      aria-hidden="true"
                    />
                  </button>
                </h2>
                <div id={cancelledListId} hidden={!showCancelled} className="space-y-2">
                  <p className="text-xs text-fg-subtle">
                    Para reactivar una meta, edítala y cambia su estado.
                  </p>
                  <Card padding="none">
                    <ul role="list" className="divide-y divide-border">
                      {cancelled.map(goal => (
                        <GoalRow
                          key={goal.id}
                          goal={goal}
                          kind="cancelled"
                          onEdit={() => openEdit(goal)}
                          onDelete={() => handleDelete(goal)}
                        />
                      ))}
                    </ul>
                  </Card>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Goal form */}
      {showForm && (
        <Modal
          title={editingGoal ? 'Editar meta' : 'Nueva meta'}
          onClose={() => setShowForm(false)}
          onSubmit={handleSubmit}
          footer={
            <>
              <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving} className="flex-1 sm:flex-none">
                {editingGoal ? 'Guardar cambios' : 'Crear meta'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="Nombre"
              placeholder="Ej: iPhone 16, Viaje a Cartagena..."
              value={form.name}
              onChange={e => {
                const name = e.target.value
                setForm(f => ({ ...f, name }))
                setFieldErrors(fe => ({ ...fe, name: undefined }))
              }}
              error={fieldErrors.name}
              autoComplete="off"
            />
            <Input
              label="Descripción (opcional)"
              placeholder="Detalles de la meta..."
              value={form.description}
              onChange={e => {
                const description = e.target.value
                setForm(f => ({ ...f, description }))
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput
                label="Costo estimado"
                value={form.estimated_cost}
                onValueChange={v => {
                  setForm(f => ({ ...f, estimated_cost: v }))
                  setFieldErrors(fe => ({ ...fe, cost: undefined }))
                }}
                error={fieldErrors.cost}
              />
              <MoneyInput
                label="Ya ahorrado"
                value={form.saved_amount}
                onValueChange={v => setForm(f => ({ ...f, saved_amount: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Fecha objetivo"
                type="date"
                value={form.target_date}
                onChange={e => {
                  const target_date = e.target.value
                  setForm(f => ({ ...f, target_date }))
                }}
              />
              <Select
                label="Prioridad"
                options={priorityOptions}
                value={form.priority}
                onChange={e => {
                  const priority = e.target.value
                  setForm(f => ({ ...f, priority }))
                }}
              />
            </div>
            {editingGoal && (
              <Select
                label="Estado"
                options={statusOptions}
                value={form.status}
                onChange={e => {
                  const status = e.target.value
                  setForm(f => ({ ...f, status }))
                }}
                hint={form.status === 'cancelled' ? 'Elige Pendiente o En progreso para reactivarla.' : undefined}
              />
            )}
            {envelopes.length > 0 && (
              <Select
                label="Categoría de ahorro vinculada"
                options={envelopeOptions}
                placeholder="Sin vincular"
                value={form.envelope_id}
                onChange={e => {
                  const envelope_id = e.target.value
                  setForm(f => ({ ...f, envelope_id }))
                }}
              />
            )}

            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Modal>
      )}

      {confirmDialog}
    </>
  )
}

interface GoalCardProps {
  goal: Goal
  envelopeName?: string
  /** Today as yyyy-MM-dd, to flag past target dates. */
  today: string
  completing: boolean
  onEdit: () => void
  onDelete: () => void
  onComplete: () => void
}

function GoalCard({ goal, envelopeName, today, completing, onEdit, onDelete, onComplete }: GoalCardProps) {
  const pct = goal.estimated_cost > 0
    ? Math.min((goal.saved_amount / goal.estimated_cost) * 100, 100)
    : 0
  const remaining = Math.max(0, goal.estimated_cost - goal.saved_amount)
  const priorityBadge = PRIORITY_BADGE[goal.priority]
  // A goal that already reached its amount is not late, even if the date passed.
  const overdue = !!goal.target_date && goal.target_date < today && remaining > 0

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate text-base font-semibold text-fg">{goal.name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant={STATUS_VARIANT[goal.status]}>{STATUS_LABELS[goal.status]}</Badge>
            {priorityBadge && <Badge variant="indigo">{priorityBadge}</Badge>}
          </div>
        </div>
        <div className="-mr-2 -mt-1.5 flex shrink-0 items-center gap-2">
          <IconButton label={`Editar ${goal.name}`} tone="primary" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <IconButton label={`Eliminar ${goal.name}`} tone="danger" onClick={onDelete}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {goal.description && (
        <p className="mt-2 line-clamp-2 text-sm text-fg-subtle">{goal.description}</p>
      )}

      <div className="mt-4">
        <p className="text-xs text-fg-subtle">Ahorrado</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-fg">
          <Money value={goal.saved_amount} className="text-xl font-bold tracking-tight" />
          <span className="text-sm text-fg-subtle">
            de <Money value={goal.estimated_cost} className="font-medium text-fg-muted" />
          </span>
        </p>
      </div>

      <ProgressBar value={pct} tone="primary" className="mt-3" />
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium tabular-nums text-fg-muted">{formatPercent(pct)} ahorrado</span>
        {remaining > 0 ? (
          <span className="text-fg-subtle">
            Falta <Money value={remaining} className="font-semibold text-fg" />
          </span>
        ) : (
          <span className="font-medium text-income">Meta alcanzada</span>
        )}
      </div>

      {(goal.target_date || envelopeName) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {goal.target_date && (
            <span className={cn('inline-flex items-center gap-1', overdue ? 'font-medium text-warning' : 'text-fg-subtle')}>
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {overdue ? 'Vencida:' : 'Meta:'} {formatTargetDate(goal.target_date)}
            </span>
          )}
          {envelopeName && (
            <span className="inline-flex min-w-0 items-center gap-1 text-fg-subtle">
              <PiggyBank className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">Categoría vinculada: </span>
              <span className="truncate">{envelopeName}</span>
            </span>
          )}
        </div>
      )}

      {pct >= 100 && (
        <div className="mt-auto pt-4">
          <Button
            variant="soft"
            className="w-full bg-income-soft text-income hover:bg-income-soft/70"
            loading={completing}
            onClick={onComplete}
          >
            {!completing && <CircleCheck className="h-4 w-4" aria-hidden="true" />}
            Marcar como completada
          </Button>
        </div>
      )}
    </Card>
  )
}

interface GoalRowProps {
  goal: Goal
  kind: 'completed' | 'cancelled'
  onEdit: () => void
  onDelete: () => void
}

function GoalRow({ goal, kind, onEdit, onDelete }: GoalRowProps) {
  const Icon = kind === 'completed' ? CircleCheck : CircleSlash

  return (
    <li className="group flex items-center gap-3 py-2 pl-4 pr-2">
      <Icon
        className={cn('h-5 w-5 shrink-0', kind === 'completed' ? 'text-income' : 'text-fg-faint')}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', kind === 'completed' ? 'text-fg' : 'text-fg-muted')}>
          {goal.name}
        </p>
        <p className="text-xs text-fg-subtle">
          {kind === 'completed' ? (
            <Money value={goal.estimated_cost} />
          ) : (
            <>Ahorrado <Money value={goal.saved_amount} /> de <Money value={goal.estimated_cost} /></>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
        <IconButton size="sm" label={`Editar ${goal.name}`} tone="primary" onClick={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <IconButton size="sm" label={`Eliminar ${goal.name}`} tone="danger" onClick={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>
    </li>
  )
}
