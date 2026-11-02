import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { Bell, Palette, Globe, Monitor, Moon, Sun, Save, Loader2, Shield, Building2, Sliders } from 'lucide-react';
import { GeneralSettingsSection } from '@/components/settings/GeneralSettingsSection';
import { SecuritySettingsSection } from '@/components/settings/SecuritySettingsSection';
import { NotificationSettingsSection } from '@/components/settings/NotificationSettingsSection';
import { DefaultsSettingsSection } from '@/components/settings/DefaultsSettingsSection';
import { LoginPageDesigner } from '@/components/settings/LoginPageDesigner';

interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  attendanceAlerts: boolean;
  gradeAlerts: boolean;
  invoiceAlerts: boolean;
  compactMode: boolean;
}

const defaultSettings: UserSettings = {
  theme: 'light',
  language: 'en',
  emailNotifications: true,
  pushNotifications: false,
  attendanceAlerts: true,
  gradeAlerts: true,
  invoiceAlerts: true,
  compactMode: false,
};

function PersonalSettingsTab() {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);

  // Load settings from database on mount
  useEffect(() => {
    if (!user) return;
    api.get<{ settings: any }>('/profiles/me/settings')
      .then((res) => {
        if (res.settings) {
          setSettings({ ...defaultSettings, ...res.settings });
        }
      })
      .catch(() => {});
  }, [user]);

  // Apply theme immediately whenever it changes
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
      const handler = (e: MediaQueryListEvent) => root.classList.toggle('dark', e.matches);
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Apply language immediately when it changes
  useEffect(() => {
    if (settings.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [settings.language, i18n]);

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (user) {
        await api.post('/profiles/me/settings', { settings });
        await api.put('/profiles/me', { preferred_language: settings.language });
      }
      toast({ title: t('settings.settingsSaved'), description: t('settings.settingsSavedDesc') });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-5 w-5" /> {t('settings.appearance')}
          </CardTitle>
          <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.theme')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.themeDesc')}</p>
            </div>
            <Select value={settings.theme} onValueChange={(v) => updateSetting('theme', v as UserSettings['theme'])}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light"><span className="flex items-center gap-2"><Sun className="h-4 w-4" /> {t('settings.light')}</span></SelectItem>
                <SelectItem value="dark"><span className="flex items-center gap-2"><Moon className="h-4 w-4" /> {t('settings.dark')}</span></SelectItem>
                <SelectItem value="system"><span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> {t('settings.system')}</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.compactMode')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.compactModeDesc')}</p>
            </div>
            <Switch checked={settings.compactMode} onCheckedChange={(v) => updateSetting('compactMode', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5" /> {t('settings.languageRegion')}
          </CardTitle>
          <CardDescription>{t('settings.languageRegionDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.displayLanguage')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.displayLanguageDesc')}</p>
            </div>
            <Select value={settings.language} onValueChange={(v) => updateSetting('language', v)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="so">Soomaali</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Personal Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5" /> {t('settings.myNotifications')}
          </CardTitle>
          <CardDescription>{t('settings.myNotificationsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5"><Label>{t('settings.emailNotifications')}</Label><p className="text-xs text-muted-foreground">{t('settings.emailNotificationsDesc')}</p></div>
            <Switch checked={settings.emailNotifications} onCheckedChange={(v) => updateSetting('emailNotifications', v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5"><Label>{t('settings.pushNotifications')}</Label><p className="text-xs text-muted-foreground">{t('settings.pushNotificationsDesc')}</p></div>
            <Switch checked={settings.pushNotifications} onCheckedChange={(v) => updateSetting('pushNotifications', v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5"><Label className="bg-yellow-200 dark:bg-yellow-500/30 px-2 py-0.5 rounded text-foreground font-semibold">{t('settings.attendanceAlerts')}</Label><p className="text-xs text-muted-foreground">{t('settings.attendanceAlertsDesc')}</p></div>
            <Switch checked={settings.attendanceAlerts} onCheckedChange={(v) => updateSetting('attendanceAlerts', v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5"><Label>{t('settings.gradeAlerts')}</Label><p className="text-xs text-muted-foreground">{t('settings.gradeAlertsDesc')}</p></div>
            <Switch checked={settings.gradeAlerts} onCheckedChange={(v) => updateSetting('gradeAlerts', v)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5"><Label>{t('settings.invoiceAlerts')}</Label><p className="text-xs text-muted-foreground">{t('settings.invoiceAlertsDesc')}</p></div>
            <Switch checked={settings.invoiceAlerts} onCheckedChange={(v) => updateSetting('invoiceAlerts', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" /> {t('settings.account')}
          </CardTitle>
          <CardDescription>{t('settings.accountDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="destructive" onClick={signOut}>{t('common.signOut')}</Button>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t('common.savePreferences')}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { isSuperAdmin } = useAuth();
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <PageHeader
        title={t('settings.title')}
        description={isSuperAdmin ? t('settings.descriptionAdmin') : t('settings.descriptionUser')}
        breadcrumbs={[{ label: t('settings.title') }]}
      />

      <div className="max-w-3xl">
        {isSuperAdmin ? (
          <Tabs defaultValue="platform" className="space-y-6">
            <TabsList className="w-full justify-start">
            <TabsTrigger value="platform" className="gap-1.5">
              <Building2 className="h-4 w-4" /> {t('settings.platformTab')}
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5">
              <Shield className="h-4 w-4" /> {t('settings.securityTab')}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5">
              <Bell className="h-4 w-4" /> {t('settings.notificationsTab')}
            </TabsTrigger>
            <TabsTrigger value="defaults" className="gap-1.5">
              <Sliders className="h-4 w-4" /> {t('settings.defaultsTab')}
            </TabsTrigger>
            <TabsTrigger value="loginpage" className="gap-1.5">
              <Monitor className="h-4 w-4" /> Login Page
            </TabsTrigger>
            <TabsTrigger value="personal" className="gap-1.5">
              <Palette className="h-4 w-4" /> {t('settings.myPreferences')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="platform">
            <GeneralSettingsSection />
          </TabsContent>
          <TabsContent value="security">
            <SecuritySettingsSection />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationSettingsSection />
          </TabsContent>
          <TabsContent value="defaults">
            <DefaultsSettingsSection />
          </TabsContent>
          <TabsContent value="loginpage">
            <LoginPageDesigner />
          </TabsContent>
          <TabsContent value="personal">
            <PersonalSettingsTab />
          </TabsContent>
          </Tabs>
        ) : (
          <PersonalSettingsTab />
        )}
      </div>
    </DashboardLayout>
  );
}
