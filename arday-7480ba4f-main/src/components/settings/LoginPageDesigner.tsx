import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, Save, Upload, X, Monitor, Maximize2, RotateCcw } from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { normalizeAssetUrl } from '@/lib/platformAssets';

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

const defaultLoginPage: LoginPageSettings = {
  background_image: null,
  background_position: 'center',
  background_fit: 'cover',
  overlay_strength: 40,
  left_side_width: 50,
  show_left_side: true,
  use_gradient: true,
  gradient_start: '#1e3a8a',
  gradient_end: '#3b82f6',
  show_logo: true,
  brand_name: 'SchoolPlus',
  brand_tagline: 'Modern School Management',
};

export function LoginPageDesigner() {
  const { settings, updateSetting, isSaving } = usePlatformSettings();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<LoginPageSettings>(defaultLoginPage);
  const [saved, setSaved] = useState<LoginPageSettings>(defaultLoginPage);
  const [uploading, setUploading] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    const sp = (settings as any).login_page;
    if (sp) {
      const merged = { ...defaultLoginPage, ...sp };
      setForm(merged);
      setSaved(merged);
    } else {
      setForm(defaultLoginPage);
      setSaved(defaultLoginPage);
    }
  }, [settings]);

  const update = (patch: Partial<LoginPageSettings>) => setForm((p) => ({ ...p, ...patch }));

  const handleReplaceImage = async (file: File) => {
    const isAllowedType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
    if (!isAllowedType || file.type === 'image/svg+xml') {
      toast({ title: 'Invalid file', description: 'Please select a JPG, PNG, WebP, or GIF image. SVG is not allowed.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum size is 5MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload('/files/upload/platform-assets', formData);
      const url = normalizeAssetUrl((res as any)?.data?.url || (res as any)?.data?.path || '');
      if (url) {
        update({ background_image: url });
        toast({ title: 'Image uploaded', description: 'Background image updated.' });
      } else {
        throw new Error('Upload succeeded but no usable image URL was returned.');
      }
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || 'Could not upload image.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    update({ background_image: null });
  };

  const handleSave = () => {
    const finalValue = {
      ...form,
      background_image: form.background_image ? normalizeAssetUrl(form.background_image) : null,
    };

    updateSetting(
      { key: 'login_page', value: finalValue },
      { onSuccess: () => {
        setSaved(finalValue);
        setForm(finalValue);
      }, onError: (error: any) => {
        toast({ title: 'Save failed', description: error?.message || 'Could not save login page settings.', variant: 'destructive' });
      } }
    );
  };

  const handleCancel = () => {
    setForm(saved);
  };

  const handleReset = () => {
    if (confirm('Reset login page to default settings?')) {
      setForm(defaultLoginPage);
    }
  };

  const PreviewPanel = ({ full = false }: { full?: boolean }) => (
    <div
      className={`relative rounded-lg overflow-hidden border ${full ? 'w-full h-screen' : 'w-full h-64'}`}
      style={{
        background: form.use_gradient
          ? `linear-gradient(135deg, ${form.gradient_start}, ${form.gradient_end})`
          : '#1e293b',
      }}
    >
      {form.background_image && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${form.background_image})`,
            backgroundPosition: form.background_position,
            backgroundSize: form.background_fit,
            backgroundRepeat: 'no-repeat',
            opacity: 1 - form.overlay_strength / 100,
          }}
        />
      )}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: form.overlay_strength / 100 }}
      />
      {form.show_left_side && (
        <div
          className="absolute left-0 top-0 h-full flex items-center justify-center"
          style={{ width: `${form.left_side_width}%` }}
        >
          <div className="text-white text-center p-4">
            {form.show_logo && (
              <div className="mb-2 text-2xl font-bold">{form.brand_name}</div>
            )}
            <p className="text-sm opacity-80">{form.brand_tagline}</p>
          </div>
        </div>
      )}
      <div
        className="absolute right-0 top-0 h-full flex items-center justify-center bg-white/10 backdrop-blur-sm"
        style={{ width: `${100 - form.left_side_width}%` }}
      >
        <div className="bg-white rounded-lg p-6 shadow-lg w-3/4 max-w-xs">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Login</h3>
          <p className="text-xs text-gray-500">Username / Password</p>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">Login Page Designer</CardTitle>
        <CardDescription>Customize the public login page appearance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">Live Preview</Label>
            <Button variant="outline" size="sm" onClick={() => setFullScreen(true)}>
              <Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Preview Full Screen
            </Button>
          </div>
          <PreviewPanel />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Background Image</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                Replace Image
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReplaceImage(f); e.target.value = ''; }} />
              {form.background_image && (
                <Button variant="outline" size="sm" onClick={handleRemoveImage}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Remove Image
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Background Position</Label>
                <Select value={form.background_position} onValueChange={(v) => update({ background_position: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Background Fit</Label>
                <Select value={form.background_fit} onValueChange={(v) => update({ background_fit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="contain">Contain</SelectItem>
                    <SelectItem value="fill">Fill</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Overlay Strength: {form.overlay_strength}%</Label>
              <Slider value={[form.overlay_strength]} onValueChange={([v]) => update({ overlay_strength: v })} min={0} max={100} step={1} />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Layout</h3>
            <div className="space-y-2">
              <Label>Left Side Width: {form.left_side_width}%</Label>
              <Slider value={[form.left_side_width]} onValueChange={([v]) => update({ left_side_width: v })} min={20} max={80} step={1} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Left Side</Label>
              <Switch checked={form.show_left_side} onCheckedChange={(v) => update({ show_left_side: v })} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Gradient</h3>
            <div className="flex items-center justify-between">
              <Label>Use Gradient</Label>
              <Switch checked={form.use_gradient} onCheckedChange={(v) => update({ use_gradient: v })} />
            </div>
            {form.use_gradient && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Gradient Start</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.gradient_start} onChange={(e) => update({ gradient_start: e.target.value })} className="h-9 w-12 rounded border cursor-pointer" />
                    <Input value={form.gradient_start} onChange={(e) => update({ gradient_start: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Gradient End</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.gradient_end} onChange={(e) => update({ gradient_end: e.target.value })} className="h-9 w-12 rounded border cursor-pointer" />
                    <Input value={form.gradient_end} onChange={(e) => update({ gradient_end: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Branding</h3>
            <div className="flex items-center justify-between">
              <Label>Show Logo</Label>
              <Switch checked={form.show_logo} onCheckedChange={(v) => update({ show_logo: v })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Brand Name</Label>
                <Input value={form.brand_name} onChange={(e) => update({ brand_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Brand Tagline</Label>
                <Input value={form.brand_tagline} onChange={(e) => update({ brand_tagline: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to Default
          </Button>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </CardContent>

      {fullScreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="h-full w-full max-w-6xl">
            <div className="mb-2 flex justify-end">
              <Button variant="secondary" onClick={() => setFullScreen(false)}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Close
              </Button>
            </div>
            <PreviewPanel full />
          </div>
        </div>
      )}
    </Card>
  );
}