import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Building2, Save, Loader2 } from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

export function GeneralSettingsSection() {
  const { settings, updateSetting, isSaving } = usePlatformSettings();
  const [form, setForm] = useState(settings.general);

  useEffect(() => {
    setForm(settings.general);
  }, [settings.general]);

  const handleSave = () => {
    updateSetting({ key: 'general', value: form });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5" /> Platform Configuration
        </CardTitle>
        <CardDescription>Configure global platform settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Platform Name</Label>
            <Input value={form.platform_name} onChange={e => setForm(p => ({ ...p, platform_name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Support Email</Label>
            <Input type="email" value={form.support_email} onChange={e => setForm(p => ({ ...p, support_email: e.target.value }))} placeholder="support@example.com" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default Language</Label>
            <Select value={form.default_language} onValueChange={v => setForm(p => ({ ...p, default_language: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="so">Soomaali</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={form.timezone} onValueChange={v => setForm(p => ({ ...p, timezone: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="Africa/Mogadishu">Africa/Mogadishu (EAT)</SelectItem>
                <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Maintenance Mode</Label>
            <p className="text-xs text-muted-foreground">Temporarily disable platform access for non-admins</p>
          </div>
          <Switch checked={form.maintenance_mode} onCheckedChange={v => setForm(p => ({ ...p, maintenance_mode: v }))} />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save General Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
