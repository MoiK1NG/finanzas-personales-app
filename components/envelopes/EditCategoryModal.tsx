'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Alert from '@/components/ui/Alert'
import ColorSwatches from './ColorSwatches'

export interface EditableCategory {
  id: string
  name: string
  color: string
  isSavings: boolean
}

interface EditCategoryModalProps {
  category: EditableCategory
  onClose: () => void
  /** Called with the saved values after the update went through. */
  onSaved: (saved: EditableCategory) => void
}

/** Edits a category's name, color and savings flag. Applies to every month. */
export default function EditCategoryModal({ category, onClose, onSaved }: EditCategoryModalProps) {
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)
  const [isSavings, setIsSavings] = useState(category.isSavings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()
  const changed =
    trimmed !== category.name ||
    color.toLowerCase() !== category.color.toLowerCase() ||
    isSavings !== category.isSavings

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving || !changed || !trimmed) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('envelopes')
      .update({ name: trimmed, color, is_savings: isSavings })
      .eq('id', category.id)
    setSaving(false)
    if (err) {
      setError('No se pudieron guardar los cambios. Intenta de nuevo.')
      return
    }
    onSaved({ id: category.id, name: trimmed, color, isSavings })
  }

  return (
    <Modal
      size="sm"
      title="Editar categoría"
      description="Los cambios se ven en todos los meses."
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!changed || !trimmed} className="flex-1 sm:flex-none">
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nombre"
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="off"
          autoFocus
          error={!trimmed ? 'Escribe un nombre' : undefined}
        />

        <ColorSwatches value={color} onChange={setColor} />

        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-fg-muted">
          <input
            type="checkbox"
            checked={isSavings}
            onChange={e => setIsSavings(e.target.checked)}
            className="h-4 w-4 rounded border-border-strong accent-[var(--primary)]"
          />
          Categoría de ahorro
        </label>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  )
}
