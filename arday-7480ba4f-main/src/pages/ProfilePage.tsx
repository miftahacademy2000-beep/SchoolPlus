import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminUserManagement } from '@/components/profile/AdminUserManagement';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Shield, KeyRound, Loader2, Save, Eye, EyeOff, Camera, Trash2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, roles, primaryRole, signOut, isSuperAdmin, refetchProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when profile changes
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: t('profile.invalidFile'), description: t('profile.selectImage'), variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t('profile.fileTooLarge'), description: t('profile.avatarSizeLimit'), variant: 'destructive' });
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${user.id}/avatar.${ext}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', filePath);

      const { data: uploadResult } = await api.upload<{ url: string }>('/files/upload/avatars', formData);
      const newUrl = uploadResult?.url || `${uploadResult}?t=${Date.now()}`;

      await api.put('/profiles/me', { avatar_url: newUrl });

      setAvatarUrl(newUrl);
      await refetchProfile();
      toast({ title: t('profile.avatarUpdated'), description: t('profile.avatarUpdatedDesc') });
    } catch (err: any) {
      toast({ title: t('profile.uploadFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      await api.delete(`/files/avatars/${user.id}`);

      await api.put('/profiles/me', { avatar_url: null });

      setAvatarUrl('');
      await refetchProfile();
      toast({ title: t('profile.avatarRemoved') });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const initials = (profile?.full_name || user?.email || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await api.put('/profiles/me', { full_name: fullName.trim(), phone: phone.trim() || null });

      toast({ title: t('profile.profileUpdated'), description: t('profile.profileSaved') });
      await refetchProfile();
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: t('profile.validationError'), description: t('profile.passwordMinLength'), variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t('profile.validationError'), description: t('profile.passwordsNoMatch'), variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    try {
      await api.post('/auth/update-password', { password: newPassword });

      toast({ title: t('profile.passwordChanged'), description: t('profile.passwordUpdated') });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const myProfileContent = (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Profile Overview Card */}
      <Card className="md:col-span-1">
        <CardHeader className="items-center text-center">
          <div className="relative group">
            <Avatar className="h-24 w-24 mb-1">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            {uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              <Camera className="h-3.5 w-3.5 mr-1.5" /> {t('common.upload')}
            </Button>
            {avatarUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {t('common.remove')}
              </Button>
            )}
          </div>
          <CardTitle className="text-lg mt-2">{profile?.full_name || t('common.user')}</CardTitle>
          <CardDescription>{profile?.email || user?.email}</CardDescription>
          <div className="flex flex-wrap justify-center gap-1.5 mt-2">
            {roles.map((r) => (
              <Badge key={r.id} variant="secondary" className="text-xs">
                {t(`roles.${r.role}`)}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>{t('profile.primaryRole')}: <span className="font-medium text-foreground">{primaryRole ? t(`roles.${primaryRole}`) : 'None'}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="truncate">{profile?.email || user?.email}</span>
          </div>
          {profile?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>{profile.phone}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Forms */}
      <div className="md:col-span-2 space-y-6">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5" /> {t('profile.personalInfo')}
            </CardTitle>
            <CardDescription>{t('profile.personalInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('profile.fullName')}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('profile.fullNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input id="email" value={profile?.email || user?.email || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">{t('profile.emailCannotChange')}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">{t('profile.phoneNumber')}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('profile.phonePlaceholder')}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {t('common.saveChanges')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-5 w-5" /> {t('profile.changePassword')}
            </CardTitle>
            <CardDescription>{t('profile.changePasswordDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('profile.newPasswordPlaceholder')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNew(!showNew)}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('profile.confirmPlaceholder')}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword || !confirmPassword}
                variant="outline"
              >
                {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                {t('profile.updatePassword')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <PageHeader
        title={t('profile.title')}
        description={isSuperAdmin ? t('profile.descriptionAdmin') : t('profile.descriptionUser')}
        breadcrumbs={[{ label: t('profile.title') }]}
      />

      {isSuperAdmin ? (
        <Tabs defaultValue="my-profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="my-profile" className="gap-1.5">
              <User className="h-4 w-4" /> {t('profile.myProfile')}
            </TabsTrigger>
            <TabsTrigger value="manage-users" className="gap-1.5">
              <Shield className="h-4 w-4" /> {t('profile.manageAllUsers')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="my-profile">
            {myProfileContent}
          </TabsContent>
          <TabsContent value="manage-users">
            <AdminUserManagement />
          </TabsContent>
        </Tabs>
      ) : (
        myProfileContent
      )}
    </DashboardLayout>
  );
}
