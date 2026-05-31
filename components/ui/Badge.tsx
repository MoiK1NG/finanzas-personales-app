import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'red' | 'yellow' | 'blue' | 'gray'
  className?: string
}

export default function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        {
          'bg-green-100 text-green-800': variant === 'green',
          'bg-red-100 text-red-800': variant === 'red',
          'bg-yellow-100 text-yellow-800': variant === 'yellow',
          'bg-blue-100 text-blue-800': variant === 'blue',
          'bg-gray-100 text-gray-700': variant === 'gray',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
