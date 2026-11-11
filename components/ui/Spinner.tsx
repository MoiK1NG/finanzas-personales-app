import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

/** Inherits the current text color, so it works inside buttons and on any surface. */
export default function Spinner({ size = 'md', label = 'Cargando', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent',
        {
          'h-4 w-4': size === 'sm',
          'h-6 w-6': size === 'md',
          'h-8 w-8': size === 'lg',
        },
        className
      )}
    />
  )
}

/** Centered spinner for a page or card that is loading its data. */
export function LoadingState({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex justify-center py-12 text-accent', className)}>
      <Spinner size="md" label={label} />
    </div>
  )
}
