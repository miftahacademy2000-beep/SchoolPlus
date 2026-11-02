import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Menu,
  Moon,
  Sun,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function TopBar() {
  const { unreadNotifications, theme, setTheme, setSidebarOpen } = useAppStore();
  const { user, profile, primaryRole, signOut, isLoading } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const navigate = useNavigate();

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'super_admin':
        return 'role-badge-super-admin';
      case 'school_admin':
        return 'role-badge-school-admin';
      case 'teacher':
        return 'role-badge-teacher';
      case 'student':
        return 'role-badge-student';
      case 'parent':
        return 'role-badge-parent';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatRole = (role: string | null) => {
    if (!role) return 'User';
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    navigate('/auth');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const handleMobileMenu = () => {
    setSidebarOpen(true);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-3 sm:px-4 md:px-6">
      {/* Left section */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMobileMenu}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className={cn(
            "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
            searchFocused ? "text-primary" : "text-muted-foreground"
          )} />
          <Input
            placeholder="Search anything..."
            className={cn(
              "w-64 lg:w-80 pl-9 transition-all",
              searchFocused && "w-80 lg:w-96 ring-2 ring-primary/20"
            )}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="text-muted-foreground hover:text-foreground"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                  {unreadNotifications}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              <Badge variant="secondary" className="text-xs">
                {unreadNotifications} new
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-64 overflow-auto">
              <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                <span className="font-medium">New school registration</span>
                <span className="text-xs text-muted-foreground">
                  Westfield Academy has requested to join the platform
                </span>
                <span className="text-xs text-muted-foreground">2 minutes ago</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                <span className="font-medium">Payment received</span>
                <span className="text-xs text-muted-foreground">
                  Lincoln High upgraded to Pro plan
                </span>
                <span className="text-xs text-muted-foreground">1 hour ago</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                <span className="font-medium">System update</span>
                <span className="text-xs text-muted-foreground">
                  New features are now available
                </span>
                <span className="text-xs text-muted-foreground">3 hours ago</span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/notifications" className="w-full text-center text-primary">
                View all notifications
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {displayInitial}
              </div>
              <div className="hidden lg:flex flex-col items-start">
                <span className="text-sm font-medium">{displayName}</span>
                {primaryRole && (
                  <Badge className={cn("h-4 text-[10px] px-1.5", getRoleBadgeColor(primaryRole))}>
                    {formatRole(primaryRole)}
                  </Badge>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{displayName}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {displayEmail}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
