import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CreditCard,
  Settings,
  BarChart3,
  FileText,
  Bell,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  School,
  UserCog,
  Wallet,
  Shield,
  UserPlus,
  ClipboardCheck,
  TrendingUp,
  MessageSquare,
  FolderOpen,
  Archive,
  Check,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';

type AppRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ReactNode;
  roles: AppRole[];
  badge?: number;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    titleKey: 'nav.overview',
    items: [
      { labelKey: 'nav.dashboard', href: '/', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['super_admin', 'school_admin'] },
      { labelKey: 'nav.teacherPortal', href: '/teacher-portal', icon: <Users className="h-5 w-5" />, roles: ['teacher'] },
      { labelKey: 'nav.myPortal', href: '/my-portal', icon: <GraduationCap className="h-5 w-5" />, roles: ['student'] },
      { labelKey: 'nav.familyPortal', href: '/family-portal', icon: <UserPlus className="h-5 w-5" />, roles: ['parent'] },
      { labelKey: 'nav.analytics', href: '/analytics', icon: <BarChart3 className="h-5 w-5" />, roles: ['super_admin'] },
    ],
  },
  {
    titleKey: 'nav.platform',
    items: [
      { labelKey: 'nav.schools', href: '/schools', icon: <Building2 className="h-5 w-5" />, roles: ['super_admin'] },
      { labelKey: 'nav.allUsers', href: '/users', icon: <UserCog className="h-5 w-5" />, roles: ['super_admin'] },
      { labelKey: 'nav.subscriptions', href: '/subscriptions', icon: <Wallet className="h-5 w-5" />, roles: ['super_admin'] },
      { labelKey: 'nav.auditLogs', href: '/audit-logs', icon: <Shield className="h-5 w-5" />, roles: ['super_admin'] },
    ],
  },
  {
    titleKey: 'nav.schoolManagement',
    items: [
      { labelKey: 'nav.schoolSettings', href: '/school-settings', icon: <Building2 className="h-5 w-5" />, roles: ['school_admin'] },
      { labelKey: 'nav.teachers', href: '/teachers', icon: <Users className="h-5 w-5" />, roles: ['school_admin'] },
      { labelKey: 'nav.students', href: '/students', icon: <GraduationCap className="h-5 w-5" />, roles: ['school_admin'] },
      { labelKey: 'nav.parents', href: '/parents', icon: <UserPlus className="h-5 w-5" />, roles: ['school_admin'] },
      { labelKey: 'nav.archivedUsers', href: '/archived-users', icon: <Archive className="h-5 w-5" />, roles: ['school_admin'] },
      { labelKey: 'nav.classes', href: '/classes', icon: <School className="h-5 w-5" />, roles: ['school_admin'] },
      { labelKey: 'nav.courses', href: '/courses', icon: <BookOpen className="h-5 w-5" />, roles: ['school_admin'] },
      { labelKey: 'nav.attendance', href: '/attendance', icon: <ClipboardCheck className="h-5 w-5" />, roles: ['school_admin'] },
      { labelKey: 'nav.grades', href: '/grades', icon: <TrendingUp className="h-5 w-5" />, roles: ['school_admin'] },
      { labelKey: 'nav.reportCard', href: '/report-card', icon: <GraduationCap className="h-5 w-5" />, roles: ['school_admin'] },
      { labelKey: 'nav.schedule', href: '/schedule', icon: <Calendar className="h-5 w-5" />, roles: ['school_admin'] },
    ],
  },
  {
    titleKey: 'nav.teaching',
    items: [
      { labelKey: 'nav.myClasses', href: '/classes', icon: <School className="h-5 w-5" />, roles: ['teacher'] },
      { labelKey: 'nav.myCourses', href: '/courses', icon: <BookOpen className="h-5 w-5" />, roles: ['teacher'] },
      { labelKey: 'nav.myStudents', href: '/students', icon: <GraduationCap className="h-5 w-5" />, roles: ['teacher'] },
    ],
  },
  {
    titleKey: 'nav.assessments',
    items: [
      { labelKey: 'nav.assignments', href: '/assignments', icon: <FileText className="h-5 w-5" />, roles: ['teacher'] },
      { labelKey: 'nav.materials', href: '/materials', icon: <FolderOpen className="h-5 w-5" />, roles: ['teacher'] },
      { labelKey: 'nav.attendance', href: '/attendance', icon: <ClipboardCheck className="h-5 w-5" />, roles: ['teacher'] },
      { labelKey: 'nav.grades', href: '/grades', icon: <TrendingUp className="h-5 w-5" />, roles: ['teacher'] },
      { labelKey: 'nav.reportCard', href: '/report-card', icon: <GraduationCap className="h-5 w-5" />, roles: ['teacher'] },
    ],
  },
  {
    titleKey: 'nav.communication',
    items: [
      { labelKey: 'nav.messages', href: '/messages', icon: <MessageSquare className="h-5 w-5" />, roles: ['teacher'] },
      { labelKey: 'nav.notifications', href: '/notifications', icon: <Bell className="h-5 w-5" />, roles: ['teacher'] },
    ],
  },
  {
    titleKey: 'nav.finance',
    items: [
      { labelKey: 'nav.billing', href: '/billing', icon: <CreditCard className="h-5 w-5" />, roles: ['super_admin'] },
      { labelKey: 'nav.invoices', href: '/invoices', icon: <FileText className="h-5 w-5" />, roles: ['school_admin', 'parent'] },
      { labelKey: 'nav.invoiceTemplates', href: '/invoice-templates', icon: <FileText className="h-5 w-5" />, roles: ['school_admin'] },
    ],
  },
  {
    titleKey: 'nav.system',
    items: [
      { labelKey: 'nav.notifications', href: '/notifications', icon: <Bell className="h-5 w-5" />, roles: ['super_admin', 'school_admin', 'teacher'], badge: 5 },
      { labelKey: 'nav.profile', href: '/profile', icon: <Users className="h-5 w-5" />, roles: ['super_admin', 'school_admin', 'teacher'] },
      { labelKey: 'nav.settings', href: '/settings', icon: <Settings className="h-5 w-5" />, roles: ['super_admin', 'school_admin', 'teacher'] },
      { labelKey: 'nav.helpCenter', href: '/help', icon: <HelpCircle className="h-5 w-5" />, roles: ['super_admin', 'school_admin', 'teacher'] },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, setSidebarOpen } = useAppStore();
  const { profile, primaryRole, roles, isSuperAdmin } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  
  const userRole = primaryRole || 'student';
  const currentSchoolId = useAppStore((s) => s.currentSchoolId);
  const setCurrentSchoolId = useAppStore((s) => s.setCurrentSchoolId);

  // Fetch all schools for super admin switcher
  const { data: allSchools = [] } = useQuery({
    queryKey: ['sidebar-schools-list'],
    queryFn: async () => {
      const response = await api.get<{ data: { id: string; name: string; logo_url: string | null }[] }>('/schools', { params: { status: 'active', sort: 'name' } });
      return response.data || [];
    },
    enabled: isSuperAdmin,
  });

  // For super admins, derive school name/logo from the selected school
  const selectedSchool = isSuperAdmin
    ? allSchools.find((s) => s.id === currentSchoolId) || null
    : null;

  useEffect(() => {
    if (!isSuperAdmin) {
      const schoolRole = roles.find(r => r.school_id !== null);
      if (schoolRole?.school_id) {
        api.get<{ data: { name: string; logo_url: string | null } }>(`/schools/${schoolRole.school_id}`)
          .then((response) => {
            if (response.data) {
              setSchoolName(response.data.name);
              setSchoolLogo(response.data.logo_url);
            }
          });
      } else {
        setSchoolName(null);
        setSchoolLogo(null);
      }
    }
  }, [roles, isSuperAdmin]);

  const displaySchoolName = isSuperAdmin
    ? (selectedSchool?.name || 'EduFlow Platform')
    : (schoolName || 'EduFlow Platform');
  const displaySchoolLogo = isSuperAdmin
    ? (selectedSchool?.logo_url || null)
    : schoolLogo;

  const displayName = profile?.full_name || t('common.user');
  const displayRole = primaryRole 
    ? t(`roles.${primaryRole}`)
    : t('common.user');

  const portalOnlyRoutes = ['/my-portal', '/family-portal', '/teacher-portal'];
  
  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (isSuperAdmin) {
          return !portalOnlyRoutes.includes(item.href);
        }
        if (userRole === 'student') {
          return item.href === '/my-portal';
        }
        return item.roles.includes(userRole);
      }),
    }))
    .filter((section) => section.items.length > 0);

  const getRoleBadgeClass = (role: string | null) => {
    switch (role) {
      case 'super_admin': return 'bg-super-admin/15 text-super-admin border-super-admin/25';
      case 'school_admin': return 'bg-school-admin/15 text-school-admin border-school-admin/25';
      case 'teacher': return 'bg-teacher/15 text-teacher border-teacher/25';
      case 'student': return 'bg-student/15 text-student border-student/25';
      case 'parent': return 'bg-parent/15 text-parent border-parent/25';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border"
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            {!sidebarCollapsed && !['student', 'parent'].includes(userRole) && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-lg font-bold text-sidebar-foreground"
              >
                EduFlow
              </motion.span>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* School & Role Section */}
        {!sidebarCollapsed && profile && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            {isSuperAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 w-full rounded-lg p-1 hover:bg-sidebar-accent transition-colors text-left">
                    <Avatar className="h-9 w-9 border-2 border-primary/20">
                      {displaySchoolLogo && <AvatarImage src={displaySchoolLogo} alt={displaySchoolName} />}
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                        {displaySchoolName[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
                        {displaySchoolName}
                      </p>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "mt-1 h-5 text-[10px] font-medium px-1.5 border",
                          getRoleBadgeClass(primaryRole)
                        )}
                      >
                        {displayRole}
                      </Badge>
                    </div>
                    <ChevronDown className="h-4 w-4 text-sidebar-muted flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[220px]">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Switch School</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setCurrentSchoolId(null)}
                    className="gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="flex-1 truncate">All Schools (Platform)</span>
                    {!currentSchoolId && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {allSchools.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => setCurrentSchoolId(s.id)}
                      className="gap-2"
                    >
                      <Avatar className="h-5 w-5">
                        {s.logo_url && <AvatarImage src={s.logo_url} />}
                        <AvatarFallback className="text-[10px] bg-muted">{s.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{s.name}</span>
                      {currentSchoolId === s.id && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border-2 border-primary/20">
                  {displaySchoolLogo && <AvatarImage src={displaySchoolLogo} alt={displaySchoolName} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                    {displaySchoolName[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
                    {displaySchoolName}
                  </p>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "mt-1 h-5 text-[10px] font-medium px-1.5 border",
                      getRoleBadgeClass(primaryRole)
                    )}
                  >
                    {displayRole}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-6">
            {filteredSections.map((section) => (
              <div key={section.titleKey}>
                {!sidebarCollapsed && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-muted">
                    {t(section.titleKey)}
                  </h3>
                )}
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    const label = t(item.labelKey);
                    const NavContent = (
                      <Link
                        to={item.href}
                        onClick={() => { if (isMobile) setSidebarOpen(false); }}
                        className={cn(
                          'sidebar-item',
                          isActive && 'sidebar-item-active'
                        )}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1 truncate">{label}</span>
                            {item.badge && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    );

                    if (sidebarCollapsed) {
                      return (
                        <li key={item.href}>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>{NavContent}</TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                              {label}
                            </TooltipContent>
                          </Tooltip>
                        </li>
                      );
                    }

                    return <li key={item.href}>{NavContent}</li>;
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* User section */}
        {!sidebarCollapsed && profile && (
          <div className="border-t border-sidebar-border p-4">
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent transition-colors"
            >
              <Avatar className="h-9 w-9">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {(profile.full_name || profile.email || '?')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {displayName}
                </p>
                <p className="text-xs text-sidebar-muted truncate">
                  {displayRole}
                </p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
