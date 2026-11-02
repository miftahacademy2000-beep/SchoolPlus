import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <DashboardLayout>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[{ label: title }]}
      />
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
          <Construction className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Coming Soon</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          This feature is currently under development. Check back soon for updates!
        </p>
        <Button variant="outline">Request Early Access</Button>
      </div>
    </DashboardLayout>
  );
}

// AnalyticsPage moved to dedicated file: src/pages/AnalyticsPage.tsx

// UsersPage moved to dedicated file: src/pages/UsersPage.tsx

export const SubscriptionsPage = () => (
  <PlaceholderPage title="Subscriptions" description="Manage subscription plans and billing" />
);

// AuditLogsPage moved to dedicated file: src/pages/AuditLogsPage.tsx

// TeachersPage, StudentsPage, ParentsPage, ClassesPage, CoursesPage moved to dedicated files

// AttendancePage, GradesPage, TimetablePage moved to dedicated files

// BillingPage moved to dedicated file: src/pages/BillingPage.tsx

// InvoicesPage moved to dedicated file: src/pages/InvoicesPage.tsx

// InvoicesPage moved to dedicated file: src/pages/InvoicesPage.tsx

export const NotificationsPage = () => (
  <PlaceholderPage title="Notifications" description="View all notifications" />
);

export const SettingsPage = () => (
  <PlaceholderPage title="Settings" description="Configure your account and preferences" />
);

export const HelpPage = () => (
  <PlaceholderPage title="Help Center" description="Get help and support" />
);

export const ProfilePage = () => (
  <PlaceholderPage title="Profile" description="Manage your profile settings" />
);
