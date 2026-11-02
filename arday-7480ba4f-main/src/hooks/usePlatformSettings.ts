import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface PlatformSettings {
  general: {
    platform_name: string;
    support_email: string;
    default_language: string;
    timezone: string;
    maintenance_mode: boolean;
  };
  security: {
    min_password_length: number;
    max_login_attempts: number;
    lockout_duration_minutes: number;
    require_email_verification: boolean;
    session_timeout_hours: number;
  };
  notifications: {
    enable_email_notifications: boolean;
    enable_system_alerts: boolean;
    digest_frequency: string;
    admin_alert_on_new_school: boolean;
    admin_alert_on_new_user: boolean;
    admin_alert_on_attendance: boolean;
  };
  defaults: {
    default_school_plan: string;
    default_class_capacity: number;
    default_course_credits: number;
    auto_archive_inactive_days: number;
    allow_self_registration: boolean;
  };
  login_page: LoginPageSettings;
}

export interface LoginPageSettings {
  background_image: string | null;
  background_position: string;
  background_fit: string;
  overlay_strength: number;
  left_side_width: number;
  show_left_side: boolean;
  use_gradient: boolean;
  gradient_start: string;
  gradient_end: string;
  show_logo: boolean;
  brand_name: string;
  brand_tagline: string;
}

const defaultSettings: PlatformSettings = {
  general: { platform_name: 'EduFlow', support_email: '', default_language: 'en', timezone: 'UTC', maintenance_mode: false },
  security: { min_password_length: 6, max_login_attempts: 5, lockout_duration_minutes: 15, require_email_verification: true, session_timeout_hours: 24 },
  notifications: { enable_email_notifications: true, enable_system_alerts: true, digest_frequency: 'daily', admin_alert_on_new_school: true, admin_alert_on_new_user: true, admin_alert_on_attendance: true },
  defaults: { default_school_plan: 'free', default_class_capacity: 30, default_course_credits: 3, auto_archive_inactive_days: 0, allow_self_registration: false },
  login_page: { background_image: null, background_position: 'center', background_fit: 'cover', overlay_strength: 40, left_side_width: 50, show_left_side: true, use_gradient: true, gradient_start: '#1e3a8a', gradient_end: '#3b82f6', show_logo: true, brand_name: 'SchoolPlus', brand_tagline: 'Modern School Management' },
};

function parseSettingValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function usePlatformSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data } = await api.get<Record<string, any>[]>('/platform-settings');
      const settings = { ...defaultSettings };
      data?.forEach((row: any) => {
        if (!(row?.key in settings)) return;

        const value = parseSettingValue(row.value);
        const current = (settings as any)[row.key];
        (settings as any)[row.key] = {
          ...(typeof current === 'object' && current !== null ? current : {}),
          ...(typeof value === 'object' && value !== null ? value : {}),
        };
      });
      return settings;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      await api.put(`/platform-settings/${key}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast({ title: 'Settings saved', description: 'Platform settings have been updated.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return {
    settings: query.data || defaultSettings,
    isLoading: query.isLoading,
    updateSetting: updateMutation.mutate,
    isSaving: updateMutation.isPending,
  };
}
