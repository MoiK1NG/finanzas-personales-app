'use client'

import { useEffect, useState, type Ref } from 'react'
import Link from 'next/link'
import { Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { cn, focusRing, formatRecurrence, FREQUENCY_OPTIONS } from '@/lib/utils'
import type { RecurrenceFrequency, RecurringTemplate } from '@/types/database'

interface RecurringFieldsProps {
  recurring: boolean
  frequency: RecurrenceFrequency
  /** 'YYYY-MM-DD' or '' for no end. */
  endDate: string
  /** The movement's date: the recurrence can't end before it. */
  minEndDate?: string
  onChange: (patch: { recurring?: boolean; frequency?: RecurrenceFrequency; end_date?: string }) => void
  endDateError?: string
  endDateRef?: Ref<HTMLInputElement>
}

/** "Hacer recurrente" block of the add form: reveals frequency and an optional end date. */
export default function RecurringFields({
  recurring, frequency, endDate, minEndDate, onChange, endDateError, endDateRef,
}: RecurringFieldsProps) {
  return (
    <div className="space-y-4">
      <label className="flex min-h-10 cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={recurring}
          onChange={e => onChange({ recurring: e.target.checked })}
          className={cn('mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong accent-[var(--primary)]', focusRing)}
        />
        <span className="min-w-0">
          <span className="block text-sm text-fg">Hacer recurrente</span>
          <span className="block text-xs text-fg-subtle">
            Cada mes aparecerá como Proyectado para que lo confirmes. Nunca se ejecuta solo.
          </span>
        </span>
      </label>

      {recurring && (
        <div className="grid gap-4 border-l-2 border-border pl-3 sm:grid-cols-2">
          <Select
            label="Frecuencia"
            options={FREQUENCY_OPTIONS}
            value={frequency}
            onChange={e => onChange({ frequency: e.target.value as RecurrenceFrequency })}
          />
          <Input
            ref={endDateRef}
            label="Hasta (opcional)"
            type="date"
            value={endDate}
            min={minEndDate}
            onChange={e => onChange({ end_date: e.target.value })}
            error={endDateError}
          />
        </div>
      )}
    </div>
  )
}

type TemplateSummary = Pick<RecurringTemplate, 'description' | 'frequency' | 'day_of_month' | 'start_date'>

/**
 * Edit form of a recurring occurrence: "Parte de «Arriendo» · Mensual · día 5" with a link to
 * manage the recurrence. Changes made here only affect this occurrence.
 */
export function RecurringOccurrenceNote({ templateId }: { templateId: string }) {
  const [template, setTemplate] = useState<TemplateSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    createClient()
      .from('recurring_templates')
      .select('description, frequency, day_of_month, start_date')
      .eq('id', templateId)
      .maybeSingle<TemplateSummary>()
      .then(({ data }) => {
        if (!cancelled) setTemplate(data)
      })
    return () => { cancelled = true }
  }, [templateId])

  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-fg-subtle">
      <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0">
        {template
          ? <>Parte de «{template.description}» · {formatRecurrence(template)}.</>
          : 'Parte de una recurrencia.'}{' '}
        Lo que cambies aquí aplica solo a este movimiento.{' '}
        <Link
          href="/transacciones/recurrentes"
          className={cn('rounded-sm font-medium text-accent underline-offset-4 hover:underline', focusRing)}
        >
          Administrar recurrentes
        </Link>
      </p>
    </div>
  )
}
