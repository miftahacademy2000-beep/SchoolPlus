import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { SchoolContextBanner } from './SchoolContextBanner';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen } = useAppStore();
  const { primaryRole } = useAuth();
  const isMobile = useIsMobile();
  
  const hidesSidebar = primaryRole === 'student';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar as Sheet overlay */}
      {!hidesSidebar && isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
            <AppSidebar />
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop sidebar - hidden below lg */}
      {!hidesSidebar && !isMobile && <AppSidebar />}

      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          hidesSidebar || isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        <TopBar />
        <SchoolContextBanner />
        <main className="p-3 sm:p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
