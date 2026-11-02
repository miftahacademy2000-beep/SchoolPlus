import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Trash2, Clock, GraduationCap, ClipboardList, CreditCard, BookOpen, AlertCircle, Info, Bell, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Notification, NotificationType } from '@/hooks/useNotifications';

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  grade: { icon: GraduationCap, color: 'text-emerald-600 bg-emerald-50' },
  attendance: { icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
  invoice: { icon: CreditCard, color: 'text-amber-600 bg-amber-50' },
  assignment: { icon: BookOpen, color: 'text-violet-600 bg-violet-50' },
  system: { icon: AlertCircle, color: 'text-red-600 bg-red-50' },
  general: { icon: Info, color: 'text-muted-foreground bg-muted' },
  payment_reminder: { icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
};

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export function NotificationItem({ notification: n, onMarkRead, onDelete }: NotificationItemProps) {
  const cfg = typeConfig[n.type] || typeConfig.general;
  const Icon = cfg.icon;

  return (
    <Card className={`transition-colors ${!n.read ? 'border-primary/30 bg-primary/[0.02]' : ''}`}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
              {n.title}
            </p>
            {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
          <div className="flex items-center gap-1 mt-1.5">
            <Clock className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground/60">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!n.read && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMarkRead(n.id)} title="Mark as read">
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(n.id)} title="Dismiss">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
