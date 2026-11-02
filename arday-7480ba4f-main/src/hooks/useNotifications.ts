import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';

export type NotificationType = 'grade' | 'attendance' | 'invoice' | 'assignment' | 'system' | 'general' | 'payment_reminder';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const READ_STORAGE_KEY = 'read_notifications';

function getReadIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistRead(ids: string[]) {
  const merged = [...new Set([...getReadIds(), ...ids])];
  localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(merged));
}

export function useNotifications() {
  const { user, roles } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    api.get<Notification[]>('/notifications')
      .then(({ data }) => {
        const readIds = getReadIds();
        setNotifications((data || []).map(n => ({ ...n, read: n.read || readIds.includes(n.id) })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, roles]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    persistRead([id]);
    api.put('/notifications/read', { ids: [id] }).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const ids = prev.map(n => n.id);
      persistRead(ids);
      return prev.map(n => ({ ...n, read: true }));
    });
    api.put('/notifications/read-all').catch(() => {});
    toast({ title: 'All marked as read' });
  }, [toast]);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    toast({ title: 'Notifications cleared' });
  }, [toast]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllRead,
    deleteNotification,
    clearAll,
  };
}
