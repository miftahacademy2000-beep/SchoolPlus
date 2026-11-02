import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellOff, CheckCheck, Trash2, Loader2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';

export default function NotificationsPage() {
  const {
    notifications, loading, unreadCount,
    markAsRead, markAllRead, deleteNotification, clearAll,
  } = useNotifications();
  const [tab, setTab] = useState('all');

  const filtered = tab === 'all'
    ? notifications
    : tab === 'unread'
      ? notifications.filter(n => !n.read)
      : notifications.filter(n => n.type === tab);

  return (
    <DashboardLayout>
      <PageHeader
        title="Notifications"
        description="Stay updated with your latest activity"
        breadcrumbs={[{ label: 'Notifications' }]}
      />

      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </span>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead}>
                <CheckCheck className="h-4 w-4 mr-1.5" /> Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1.5" /> Clear all
              </Button>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread {unreadCount > 0 && <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">{unreadCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="payment_reminder">
              Payment Reminders
            </TabsTrigger>
            <TabsTrigger value="grade">Grades</TabsTrigger>
            <TabsTrigger value="assignment">Assignments</TabsTrigger>
            <TabsTrigger value="invoice">Invoices</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <BellOff className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground font-medium">No notifications</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {tab === 'unread' ? "You're all caught up!" : 'Nothing here yet.'}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-2">
                  {filtered.map(n => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onMarkRead={markAsRead}
                      onDelete={deleteNotification}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
