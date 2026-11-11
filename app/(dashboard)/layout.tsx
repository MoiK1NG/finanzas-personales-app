import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content — shifts right on desktop, clears the bottom nav (+ iPhone safe area) on mobile */}
      <div className="lg:ml-60 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  )
}
