'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPeriodLabel, getPeriodDate } from '@/lib/utils'
import { addMonths, subMonths, format } from 'date-fns'

interface HeaderProps {
  periodDate: string
  onPeriodChange: (date: string) => void
  userName?: string | null
}

export default function Header({ periodDate, onPeriodChange, userName }: HeaderProps) {
  function navigate(direction: 'prev' | 'next') {
    const current = new Date(periodDate + 'T12:00:00')
    const next = direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1)
    onPeriodChange(format(next, 'yyyy-MM-01'))
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      {/* Period navigator */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('prev')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold text-gray-800 capitalize min-w-36 text-center">
          {formatPeriodLabel(periodDate)}
        </h2>
        <button
          onClick={() => navigate('next')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* User */}
      {userName && (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold uppercase">
              {userName.charAt(0)}
            </span>
          </div>
          <span className="text-sm text-gray-600 hidden sm:block">{userName}</span>
        </div>
      )}
    </header>
  )
}
