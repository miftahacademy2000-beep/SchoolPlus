import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Bell, Save, Loader2 } from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

export function NotificationSettingsSection() {
  const { settings, updateSetting, isSaving } = usePlatformSettings();
  const [form, setForm] = useState(settings.notifications);

  useEffect(() => {
    setForm(settings.notifications);
  }, [settings.notifications]);

  const handleSave = () => {
    updateSetting({ key: 'notifications', value: form });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5" /> Notification Settings
        </CardTitle>
        <CardDescription>Configure platform-wide notification behavior</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Email Notifications</Label>
            <p className="text-xs text-muted-foreground">Enable email notifications platform-wide</p>
          </div>
          <Switch checked={form.enable_email_notifications} onCheckedChange={v => setForm(p => ({ ...p, enable_email_notifications: v }))} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>System Alerts</Label>
            <p className="text-xs text-muted-foreground">Show in-app system alerts and banners</p>
          </div>
          <Switch checked={form.enable_system_alerts} onCheckedChange={v => setForm(p => ({ ...p, enable_system_alerts: v }))} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Digest Frequency</Label>
            <p className="text-xs text-muted-foreground">How often to send notification digests</p>
          </div>
          <Select value={form.digest_frequency} onValueChange={v => setForm(p => ({ ...p, digest_frequency: v }))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="realtime">Real-time</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Alert on New School Registration</Label>
            <p className="text-xs text-muted-foreground">Notify admins when a new school signs up</p>
          </div>
          <Switch checked={form.admin_alert_on_new_school} onCheckedChange={v => setForm(p => ({ ...p, admin_alert_on_new_school: v }))} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Alert on New User Creation</Label>
            <p className="text-xs text-muted-foreground">Notify admins when new users are created</p>
          </div>
          <Switch checked={form.admin_alert_on_new_user} onCheckedChange={v => setForm(p => ({ ...p, admin_alert_on_new_user: v }))} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="bg-yellow-200 dark:bg-yellow-500/30 px-2 py-0.5 rounded text-foreground font-semibold">Attendance Alerts</Label>
            <p className="text-xs text-muted-foreground">Notify when attendance is recorded</p>
          </div>
          <Switch checked={form.admin_alert_on_attendance} onCheckedChange={v => setForm(p => ({ ...p, admin_alert_on_attendance: v }))} />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Notification Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
