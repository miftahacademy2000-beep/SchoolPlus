import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Shield, Save, Loader2 } from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

export function SecuritySettingsSection() {
  const { settings, updateSetting, isSaving } = usePlatformSettings();
  const [form, setForm] = useState(settings.security);

  useEffect(() => {
    setForm(settings.security);
  }, [settings.security]);

  const handleSave = () => {
    updateSetting({ key: 'security', value: form });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5" /> Security & Authentication
        </CardTitle>
        <CardDescription>Configure security policies across the platform</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Min Password Length</Label>
            <Input type="number" min={4} max={32} value={form.min_password_length} onChange={e => setForm(p => ({ ...p, min_password_length: Number(e.target.value) }))} />
          </div>
          <div className="space-y-2">
            <Label>Max Login Attempts</Label>
            <Input type="number" min={1} max={20} value={form.max_login_attempts} onChange={e => setForm(p => ({ ...p, max_login_attempts: Number(e.target.value) }))} />
          </div>
          <div className="space-y-2">
            <Label>Lockout Duration (min)</Label>
            <Input type="number" min={1} max={120} value={form.lockout_duration_minutes} onChange={e => setForm(p => ({ ...p, lockout_duration_minutes: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Session Timeout (hours)</Label>
          <Input type="number" min={1} max={168} value={form.session_timeout_hours} onChange={e => setForm(p => ({ ...p, session_timeout_hours: Number(e.target.value) }))} className="max-w-[200px]" />
          <p className="text-xs text-muted-foreground">How long before idle users are logged out</p>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Require Email Verification</Label>
            <p className="text-xs text-muted-foreground">Users must verify email before signing in</p>
          </div>
          <Switch checked={form.require_email_verification} onCheckedChange={v => setForm(p => ({ ...p, require_email_verification: v }))} />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Security Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
