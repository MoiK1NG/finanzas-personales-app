'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Info, Plus, Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteTemplate, setTemplateActive } from '@/lib/recurring'
import { cn, focusRing } from '@/lib/utils'
import { useConfirm } from '@/hooks/useConfirm'
import Header from '@/components/layout/Header'
import RecurringTemplateForm from '@/components/recurring/RecurringTemplateForm'
import RecurringTemplateRow from '@/components/recurring/RecurringTemplateRow'
import { Card } from '@/components/ui/Card'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Spinner, { LoadingState } from '@/components/ui/Spinner'
import type { BankAccount, Envelope, RecurringTemplate } from '@/types/database'

const linkButtonClass = cn(
  'inline-flex h-9 items-center justify-center rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-fg whitespace-nowrap transition-colors hover:bg-surface-2',
  focusRing
)

type LoadResult =
  | { status: 'session' }
  | { status: 'ok' | 'network'; templates: RecurringTemplate[]; envelopes: Envelope[]; bankAccounts: BankAccount[] }

async function fetchRecurring(): Promise<LoadResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'session' }

  const [{ data: tpls, error: tplsErr }, { data: envs, error: envsErr }, { data: accts, error: acctsErr }] = await Promise.all([
    supabase.from('recurring_templates').select('*').eq('user_id', user.id)
      .order('is_active', { ascending: false }).order('description'),
    supabase.from('envelopes').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
  ])
  return {
    status: tplsErr || envsErr || acctsErr ? 'network' : 'ok',
    templates: tpls ?? [],
    envelopes: envs ?? [],
    bankAccounts: accts ?? [],
  }
}

export default function RecurrentesPage() {
  const [templates, setTemplates]       = useState<RecurringTemplate[]>([])
  const [envelopes, setEnvelopes]       = useState<Envelope[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading]           = useState(true)
  const [loaded, setLoaded]             = useState(false)
  const [loadError, setLoadError]       = useState<'session' | 'network' | null>(null)
  /** null = closed; 'new' = create; a template = edit. */
  const [formTarget, setFormTarget]     = useState<RecurringTemplate | 'new' | null>(null)
  const [busy, setBusy]                 = useState<{ id: string; kind: 'toggling' | 'deleting' } | null>(null)
  const [notice, setNotice]             = useState<string | null>(null)
  const { confirm, confirmDialog }      = useConfirm()

  /** Applies a fetch result. Always called from a promise callback, never synchronously in an effect. */
  const apply = useCallback((result: LoadResult) => {
    if (result.status === 'session') {
      setLoadError('session')
    } else {
      setTemplates(result.templates)
      setEnvelopes(result.envelopes)
      setBankAccounts(result.bankAccounts)
      setLoadError(result.status === 'network' ? 'network' : null)
      setLoaded(true)
    }
    setLoading(false)
  }, [])

  // loading starts as true, so the first load doesn't need to set it.
  useEffect(() => {
    let cancelled = false
    fetchRecurring().then(result => { if (!cancelled) apply(result) })
    return () => { cancelled = true }
  }, [apply])

  const loadData = useCallback(async () => {
    setLoading(true)
    apply(await fetchRecurring())
  }, [apply])

  const accountNames = new Map(bankAccounts.map(a => [a.id, a.name]))
  const envelopeNames = new Map(envelopes.map(e => [e.id, e.name]))

  async function handleToggle(t: RecurringTemplate) {
    setNotice(null)
    setBusy({ id: t.id, kind: 'toggling' })
    const { error } = await setTemplateActive(createClient(), t.id, !t.is_active)
    setBusy(null)
    if (error) {
      setNotice(t.is_active
        ? `No se pudo pausar «${t.description}». Intenta de nuevo.`
        : `No se pudo reanudar «${t.description}». Intenta de nuevo.`)
    }
    loadData()
  }

  async function handleDelete(t: RecurringTemplate) {
    const ok = await confirm({
      title: `¿Eliminar «${t.description}»?`,
      description: 'Se quitan sus movimientos proyectados pendientes. Los ya confirmados se conservan.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return

    setNotice(null)
    setBusy({ id: t.id, kind: 'deleting' })
    const { error } = await deleteTemplate(createClient(), t.id)
    setBusy(null)
    if (error) setNotice(`No se pudo eliminar «${t.description}». Intenta de nuevo.`)
    loadData()
  }

  const showLoader = loading && !loaded
  const refreshing = loading && loaded
  const canAdd = loaded && !loadError
  const rowsLocked = refreshing || busy !== null

  const addButton = (className?: string) => (
    <Button className={className} onClick={() => setFormTarget('new')}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      Nueva recurrencia
    </Button>
  )

  return (
    <>
      <Header />

      <main
        className={cn(
          'mx-auto w-full max-w-5xl space-y-5 px-4 pt-5 sm:space-y-6 sm:px-6 sm:pt-6',
          // Room for the FAB on phones and tablets, so it never covers the last row.
          canAdd ? 'pb-24 lg:pb-6' : 'pb-5 sm:pb-6'
        )}
      >
        <PageHeader
          title="Recurrentes"
          subtitle={
            <span className="inline-flex items-center gap-2">
              Ingresos, gastos y transferencias que se repiten
              {refreshing && <Spinner size="sm" label="Actualizando" className="text-fg-faint" />}
            </span>
          }
          actions={canAdd ? addButton('hidden lg:inline-flex') : undefined}
        />

        <p className="flex items-start gap-2 text-sm text-fg-subtle">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Cada mes aparecen como Proyectado en Movimientos y tú los confirmas. Nunca se ejecutan solos.
        </p>

        {notice && (
          <Alert
            tone="danger"
            action={
              <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
                Cerrar
              </Button>
            }
          >
            {notice}
          </Alert>
        )}

        {showLoader ? (
          <Card padding="none">
            <LoadingState label="Cargando recurrentes" />
          </Card>
        ) : loadError === 'session' ? (
          <Alert
            tone="danger"
            title="Tu sesión expiró"
            action={<Link href="/login" className={linkButtonClass}>Iniciar sesión</Link>}
          >
            Vuelve a iniciar sesión para ver tus recurrentes.
          </Alert>
        ) : loadError ? (
          <Alert
            tone="danger"
            title="No se pudieron cargar los recurrentes"
            action={
              <Button size="sm" variant="secondary" loading={loading} onClick={() => loadData()}>
                Reintentar
              </Button>
            }
          >
            Revisa tu conexión e intenta de nuevo.
          </Alert>
        ) : (
          <Card padding="none">
            {templates.length === 0 ? (
              <EmptyState
                icon={Repeat}
                title="Aún no tienes recurrentes"
                description="Agrega el arriendo, tu salario o una suscripción para no registrarlos cada mes."
                action={addButton()}
              />
            ) : (
              <ul className="divide-y divide-border" aria-busy={rowsLocked || undefined}>
                {templates.map(t => (
                  <RecurringTemplateRow
                    key={t.id}
                    template={t}
                    accountNames={accountNames}
                    envelopeNames={envelopeNames}
                    onEdit={() => setFormTarget(t)}
                    onToggleActive={() => handleToggle(t)}
                    onDelete={() => handleDelete(t)}
                    busy={busy?.id === t.id ? busy.kind : null}
                    locked={rowsLocked}
                  />
                ))}
              </ul>
            )}
          </Card>
        )}
      </main>

      {/* Mobile / tablet FAB: opens the create form directly */}
      {canAdd && (
        <button
          type="button"
          onClick={() => setFormTarget('new')}
          aria-label="Nueva recurrencia"
          title="Nueva recurrencia"
          className={cn(
            'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg transition-colors hover:bg-primary-hover lg:hidden',
            focusRing
          )}
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {formTarget && (
        <RecurringTemplateForm
          template={formTarget === 'new' ? null : formTarget}
          envelopes={envelopes}
          bankAccounts={bankAccounts}
          onSaved={() => { setFormTarget(null); loadData() }}
          onClose={() => setFormTarget(null)}
        />
      )}

      {confirmDialog}
    </>
  )
}
