import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  Save,
  Upload,
  Globe,
  Mail,
  Phone,
  MapPin,
  Loader2,
  Palette,
  X,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { MonthlyFeeSection } from '@/components/settings/MonthlyFeeSection';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SchoolProfile {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  logo_url: string | null;
  monthly_fee: number | null;
}

export default function SchoolSettingsPage() {
  const { currentSchoolId, isSuperAdmin, setOverrideSchoolId } = useSchoolContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  
  // Fetch all schools for super admin selector
  const { data: allSchools } = useQuery({
    queryKey: ['all-schools-list'],
    queryFn: async () => {
      const { data } = await api.get<{ id: string; name: string }[]>('/schools', { params: { select: 'id,name', order: 'name' } });
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Admin account state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNewEmail, setAdminNewEmail] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  // Fetch school profile
  const { data: school, isLoading } = useQuery({
    queryKey: ['school-profile', currentSchoolId],
    queryFn: async (): Promise<SchoolProfile | null> => {
      if (!currentSchoolId) return null;

      const { data } = await api.get<SchoolProfile>(`/schools/${currentSchoolId}`);
      return data || null;
    },
    enabled: !!currentSchoolId,
  });

  // Form state
  const [formData, setFormData] = useState<Partial<SchoolProfile>>({});
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update form when school data loads
  useEffect(() => {
    if (school) {
      setFormData(school);
    }
  }, [school]);

  // Fetch current admin info
  const { data: adminInfo } = useQuery({
    queryKey: ['school-admin-info', currentSchoolId],
    queryFn: async () => {
      if (!currentSchoolId || !user?.id) return null;
      const { data: profile } = await api.get<{ email: string; full_name: string }>(`/profiles/me`);
      return profile;
    },
    enabled: !!currentSchoolId && !!user?.id,
  });

  useEffect(() => {
    if (adminInfo?.email) {
      setAdminEmail(adminInfo.email);
      setAdminNewEmail(adminInfo.email);
    }
  }, [adminInfo]);

  const handleSaveCredentials = async () => {
    if (!user?.id || !currentSchoolId) return;

    const emailChanged = adminNewEmail && adminNewEmail !== adminEmail;
    const passwordChanged = adminNewPassword.length >= 6;

    if (!emailChanged && !passwordChanged) {
      toast({ title: 'No changes', description: 'Nothing to update.' });
      return;
    }

    setIsSavingCredentials(true);
    try {
      const body: Record<string, unknown> = {
        user_id: user.id,
        school_id: currentSchoolId,
        role: 'school_admin',
      };
      if (emailChanged) body.new_email = adminNewEmail;
      if (passwordChanged) body.new_password = adminNewPassword;

      const result = await api.post<{ error?: string }>('/admin/update-user-credentials', body);

      if (result?.error) throw new Error(result.error);

      toast({ title: 'Credentials updated', description: 'Your account credentials have been saved.' });
      setAdminNewPassword('');
      setAdminEmail(adminNewEmail);
      queryClient.invalidateQueries({ queryKey: ['school-admin-info'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSavingCredentials(false);
    }
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SchoolProfile>) => {
      if (!currentSchoolId) throw new Error('No school selected');

      await api.put(`/schools/${currentSchoolId}`, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        website: data.website,
        logo_url: data.logo_url,
        monthly_fee: data.monthly_fee ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-profile'] });
      queryClient.invalidateQueries({ queryKey: ['school-dashboard'] });
      toast({
        title: 'Settings saved',
        description: 'Your school profile has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentSchoolId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 2MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingLogo(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentSchoolId}/logo.${fileExt}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', filePath);

      const { data: uploadResult } = await api.upload<{ url: string }>('/files/upload/school-assets', formData);
      const logoUrl = uploadResult?.url || String(uploadResult);

      await api.put(`/schools/${currentSchoolId}`, { logo_url: logoUrl });

      setFormData((prev) => ({ ...prev, logo_url: logoUrl }));
      queryClient.invalidateQueries({ queryKey: ['school-profile'] });
      
      toast({
        title: 'Logo uploaded',
        description: 'Your school logo has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error uploading logo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle logo removal
  const handleRemoveLogo = async () => {
    if (!currentSchoolId) return;

    setIsUploadingLogo(true);

    try {
      // Update school to remove logo URL
      await api.put(`/schools/${currentSchoolId}`, { logo_url: null });

      setFormData((prev) => ({ ...prev, logo_url: null }));
      queryClient.invalidateQueries({ queryKey: ['school-profile'] });
      
      toast({
        title: 'Logo removed',
        description: 'Your school logo has been removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Error removing logo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleInputChange = (field: keyof SchoolProfile, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (!currentSchoolId) {
    return (
      <DashboardLayout>
        <PageHeader
          title="School Settings"
          description="Select a school to manage its settings"
          breadcrumbs={[{ label: 'Settings' }, { label: 'School Profile' }]}
        />
        {isSuperAdmin && allSchools && allSchools.length > 0 ? (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5" />
                Select a School
              </CardTitle>
              <CardDescription>
                Choose a school to manage its settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select onValueChange={(v) => setOverrideSchoolId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a school..." />
                </SelectTrigger>
                <SelectContent>
                  {allSchools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center min-h-[50vh]">
            <p className="text-muted-foreground">No school context available</p>
          </div>
        )}
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }
  const selectedSchoolName = isSuperAdmin && allSchools
    ? allSchools.find(s => s.id === currentSchoolId)?.name
    : null;

  const displayData = { ...school, ...formData };

  return (
    <DashboardLayout>
      <PageHeader
        title={selectedSchoolName ? `School Settings — ${selectedSchoolName}` : "School Settings"}
        description="Manage your school profile and branding"
        breadcrumbs={[{ label: 'Settings' }, { label: selectedSchoolName || 'School Profile' }]}
      />

      {/* Super Admin school switcher */}
      {isSuperAdmin && allSchools && allSchools.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <Label className="text-sm font-medium whitespace-nowrap">Managing school:</Label>
          <Select value={currentSchoolId || ''} onValueChange={(v) => setOverrideSchoolId(v)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a school" />
            </SelectTrigger>
            <SelectContent>
              {allSchools.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <KeyRound className="h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <form onSubmit={handleSubmit}>
              <div className="grid gap-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>
                      Update your school's basic information and contact details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">School Name</Label>
                        <Input
                          id="name"
                          value={displayData.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Enter school name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slug">School Slug</Label>
                        <Input
                          id="slug"
                          value={displayData.slug || ''}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                          The slug cannot be changed after creation
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={displayData.email || ''}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="school@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          value={displayData.phone || ''}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Website
                      </Label>
                      <Input
                        id="website"
                        type="url"
                        value={displayData.website || ''}
                        onChange={(e) => handleInputChange('website', e.target.value)}
                        placeholder="https://www.school.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address" className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Address
                      </Label>
                      <Textarea
                        id="address"
                        value={displayData.address || ''}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        placeholder="Enter school address"
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Fee Management */}
                {currentSchoolId && (
                  <MonthlyFeeSection
                    schoolId={currentSchoolId}
                    schoolFee={displayData.monthly_fee ?? null}
                    onSchoolFeeChange={(fee) => setFormData((prev) => ({ ...prev, monthly_fee: fee }))}
                  />
                )}

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </TabsContent>

        <TabsContent value="branding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid gap-6">
              {/* Logo */}
              <Card>
                <CardHeader>
                  <CardTitle>School Logo</CardTitle>
                  <CardDescription>
                    Upload your school's logo to personalize the platform and invoices
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={displayData.logo_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                          {displayData.name?.charAt(0) || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      {displayData.logo_url && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={handleRemoveLogo}
                          disabled={isUploadingLogo}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        className="gap-2" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingLogo}
                      >
                        {isUploadingLogo ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            Upload Logo
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Recommended: 256x256px, PNG or JPG format (max 2MB)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Colors Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Brand Preview</CardTitle>
                  <CardDescription>
                    See how your school branding appears in the platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={displayData.logo_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {displayData.name?.charAt(0) || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-lg">{displayData.name || 'School Name'}</h3>
                        <p className="text-sm text-muted-foreground">
                          {displayData.email || 'school@example.com'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded bg-primary" title="Primary Color" />
                      <div className="h-8 w-8 rounded bg-secondary" title="Secondary Color" />
                      <div className="h-8 w-8 rounded bg-accent" title="Accent Color" />
                      <div className="h-8 w-8 rounded bg-success" title="Success Color" />
                      <div className="h-8 w-8 rounded bg-warning" title="Warning Color" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Custom color themes will be available in a future update
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="account">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Admin Account</CardTitle>
                  <CardDescription>
                    Manage your login email and password
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {adminInfo && (
                    <p className="text-sm text-muted-foreground">
                      Signed in as <span className="font-medium text-foreground">{adminInfo.full_name || 'Admin'}</span>
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="admin-email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Login Email
                    </Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={adminNewEmail}
                      onChange={(e) => setAdminNewEmail(e.target.value)}
                      placeholder="admin@school.edu"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-password" className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="admin-password"
                        type={showPassword ? 'text' : 'password'}
                        value={adminNewPassword}
                        onChange={(e) => setAdminNewPassword(e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Minimum 6 characters. Leave blank to keep your current password.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveCredentials}
                  disabled={isSavingCredentials}
                  className="gap-2"
                >
                  {isSavingCredentials ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Credentials
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
