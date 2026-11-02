import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Sliders, Save, Loader2 } from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

export function DefaultsSettingsSection() {
  const { settings, updateSetting, isSaving } = usePlatformSettings();
  const [form, setForm] = useState(settings.defaults);

  useEffect(() => {
    setForm(settings.defaults);
  }, [settings.defaults]);

  const handleSave = () => {
    updateSetting({ key: 'defaults', value: form });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sliders className="h-5 w-5" /> Default Values
        </CardTitle>
        <CardDescription>Set defaults for new schools, classes, and courses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default School Plan</Label>
            <Select value={form.default_school_plan} onValueChange={v => setForm(p => ({ ...p, default_school_plan: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default Class Capacity</Label>
            <Input type="number" min={1} max={200} value={form.default_class_capacity} onChange={e => setForm(p => ({ ...p, default_class_capacity: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default Course Credits</Label>
            <Input type="number" min={1} max={10} value={form.default_course_credits} onChange={e => setForm(p => ({ ...p, default_course_credits: Number(e.target.value) }))} />
          </div>
          <div className="space-y-2">
            <Label>Auto-Archive After (days)</Label>
            <Input type="number" min={0} max={365} value={form.auto_archive_inactive_days} onChange={e => setForm(p => ({ ...p, auto_archive_inactive_days: Number(e.target.value) }))} />
            <p className="text-xs text-muted-foreground">Set to 0 to disable auto-archiving</p>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Allow Self Registration</Label>
            <p className="text-xs text-muted-foreground">Let users create accounts without admin approval</p>
          </div>
          <Switch checked={form.allow_self_registration} onCheckedChange={v => setForm(p => ({ ...p, allow_self_registration: v }))} />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
