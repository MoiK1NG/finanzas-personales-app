import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content — shifts right on desktop, full-width on mobile */}
      <div className="lg:ml-60 pb-16 lg:pb-0">
        {children}
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  )
}
