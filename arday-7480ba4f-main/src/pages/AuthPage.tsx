import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  User,
  BookOpen,
  School,
  Globe2,
  Languages,
  ArrowRightLeft,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isEmail } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { normalizeAssetUrl } from '@/lib/platformAssets';

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'ID or email is required'),
  password: z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSettings, setLoginSettings] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/platform-settings/public')
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res?.data) {
          setLoginSettings({
            ...res.data,
            background_image: res.data?.background_image ? normalizeAssetUrl(res.data.background_image) : null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setLoginSettings(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const { signIn, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && !isLoading) {
      const from = (location.state as { from?: string })?.from || '/';
      navigate(from, { replace: true });
    }
  }, [user, isLoading, navigate, location]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const handleLogin = async (data: LoginFormData) => {
    setError(null);
    setIsSubmitting(true);

    const trimmed = data.identifier.trim();

    // Email-based login (admins, etc.)
    if (isEmail(trimmed)) {
      const { error: signInError } = await signIn(trimmed, data.password);
      if (signInError) {
        setError(
          signInError.message.includes('Invalid login credentials')
            ? 'Invalid ID or password. Please try again.'
            : signInError.message.includes('Email not confirmed')
              ? 'Your account is not yet active. Contact your administrator.'
              : signInError.message
        );
      }
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await signIn(trimmed, data.password);
    if (signInError) {
      setError('Invalid ID or password. Please try again.');
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const ls = loginSettings || {};
  const showLeft = ls.show_left_side !== false;
  const leftWidth = ls.left_side_width || 50;
  const bgImage = normalizeAssetUrl(ls.background_image);
  const hasCustomBackground = Boolean(bgImage);
  const bgPosition = ls.background_position || 'center';
  const bgFit = ls.background_fit || 'cover';
  const overlay = (ls.overlay_strength ?? 40) / 100;
  const useGradient = ls.use_gradient !== false;
  const gradStart = ls.gradient_start || '#1e3a8a';
  const gradEnd = ls.gradient_end || '#3b82f6';
  const showLogo = ls.show_logo !== false;
  const brandName = ls.brand_name || 'EduFlow';
  const brandTagline = ls.brand_tagline || 'Modern School Management';

  const leftBgStyle: CSSProperties = bgImage
    ? {
        backgroundImage: `url(${bgImage})`,
        backgroundPosition: bgPosition,
        backgroundSize: bgFit,
        backgroundRepeat: 'no-repeat',
      }
    : useGradient
      ? { background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})` }
      : { backgroundColor: gradStart };

  const decorativePanels = [
    {
      key: 'community',
      title: 'Ardayda &\nMacaliminta',
      icon: Users,
      accent: 'from-[#020e37] via-[#0a2a6d] to-[#052b5a]',
      image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    },
    {
      key: 'quran',
      title: 'Qaybta\nQuraanka',
      icon: BookOpen,
      accent: 'from-[#0a5b3b] via-[#0f7f59] to-[#0f5f4c]',
      image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80',
    },
    {
      key: 'school',
      title: 'Schoolka',
      icon: School,
      accent: 'from-[#0d3d8a] via-[#0f53c4] to-[#0b2c67]',
      image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
    },
    {
      key: 'languages',
      title: 'Luqadaha',
      icon: Globe2,
      accent: 'from-[#102d6f] via-[#0a4e8f] to-[#1d2b6a]',
      image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    },
    {
      key: 'translate',
      title: 'Turjumaadda',
      icon: ArrowRightLeft,
      accent: 'from-[#e8922b] via-[#d97706] to-[#b45309]',
      image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    },
  ];

  const defaultMapStyle: CSSProperties = {
    backgroundImage:
      'radial-gradient(circle, rgba(255,255,255,0.7) 0.8px, transparent 1.2px), radial-gradient(circle at 60% 30%, rgba(94,144,255,0.7) 1.2px, transparent 1.5px), linear-gradient(180deg, rgba(2, 11, 32, 0.98), rgba(4, 18, 41, 0.96))',
    backgroundSize: '20px 20px, 18px 18px, 100% 100%',
    backgroundPosition: 'center',
  };

  const renderBrandCard = () => (
    <div className="hidden lg:flex flex-col justify-between relative overflow-hidden p-12" style={{ width: `${leftWidth}%`, ...leftBgStyle }}>
      <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
      <div className="relative z-10">
        {showLogo && (
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">{brandName}</span>
          </div>
        )}
      </div>

      <div className="relative z-10 space-y-6">
        <h1 className="text-4xl font-bold text-white leading-tight">{brandTagline}</h1>
      </div>

      <div className="relative z-10 text-sm text-white/50">
        © {new Date().getFullYear()} {brandName}. All rights reserved.
      </div>
    </div>
  );

  const renderDecorativePanels = () => (
    <div className="relative z-10 grid min-h-screen w-full grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr]">
      {decorativePanels.map(({ key, title, icon: Icon, accent, image }, index) => (
        <div
          key={key}
          className={`relative flex min-h-[260px] flex-col justify-between overflow-hidden border-r border-white/10 bg-gradient-to-br ${accent} ${index === 0 ? 'lg:min-h-[620px]' : 'lg:min-h-[620px]'}`}
        >
          <div className="absolute inset-0 opacity-35" style={{ backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
          <div className="relative z-10 flex items-center justify-center pt-10">
            <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm">
              <Icon className="h-9 w-9 text-white" />
            </span>
          </div>
          <div className="relative z-10 px-4 pb-10 text-center text-2xl font-bold text-white leading-tight sm:text-3xl">
            {title}
          </div>
        </div>
      ))}
    </div>
  );

  const renderLoginCard = () => (
    <div className="relative z-10 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-md sm:p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="border-0 bg-background/95 shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
              <CardDescription>Enter your credentials to access your account</CardDescription>
            </CardHeader>

            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or ID</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="email@example.com or your ID"
                      autoComplete="username"
                      className={cn('pl-10', form.formState.errors.identifier && 'border-destructive')}
                      {...form.register('identifier')}
                    />
                  </div>
                  {form.formState.errors.identifier && (
                    <p className="text-sm text-destructive">{form.formState.errors.identifier.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className={cn('pl-10 pr-10', form.formState.errors.password && 'border-destructive')}
                      {...form.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground space-y-1">
                <p>Forgot your password? <span className="font-medium text-foreground">Contact your Admin</span></p>
                <p className="text-xs">Only administrators can manage credentials.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#020d2d] text-white">
      <div className="absolute inset-0" style={defaultMapStyle} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(41,98,255,0.32),_rgba(2,8,23,0)_55%)]" />
      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {showLeft && !loginSettings ? renderDecorativePanels() : null}
        {!showLeft ? renderLoginCard() : null}

        {showLeft && loginSettings ? renderBrandCard() : null}

        {showLeft && loginSettings ? (
          <div className="flex flex-1 items-center justify-center bg-background/95 p-4 md:p-8" style={{ width: `${100 - leftWidth}%` }}>
            {renderLoginCard()}
          </div>
        ) : null}

        {!loginSettings && showLeft ? (
          <div className="relative flex flex-1 items-center justify-center bg-[linear-gradient(135deg,#ffbf7a,#dc6d18)] p-4 md:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.25),transparent_18%),radial-gradient(circle_at_75%_35%,rgba(255,255,255,0.18),transparent_20%),radial-gradient(circle_at_40%_80%,rgba(0,0,0,0.08),transparent_22%)]" />
            <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center justify-center gap-6">
              <div className="rounded-[26px] border border-white/15 bg-[#f7f3ef] px-8 py-5 text-center text-3xl font-medium text-[#1b1b1b] shadow-[0_25px_80px_rgba(249,128,32,0.35)]">
                <div className="text-4xl font-bold leading-tight">Hello</div>
                <div className="mt-1 text-4xl font-bold leading-tight">مرحبا</div>
                <div className="mt-1 text-4xl font-bold leading-tight">Salaam</div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-[#3f7af7] px-5 py-2 text-lg font-semibold text-white shadow-lg shadow-blue-500/30">
                  English
                </div>
                <div className="rounded-full bg-[#21a06d] px-5 py-2 text-lg font-semibold text-white shadow-lg shadow-green-500/20">
                  العربية
                </div>
                <div className="rounded-full bg-[#8d5eea] px-5 py-2 text-lg font-semibold text-white shadow-lg shadow-violet-500/20">
                  Soomaali
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
