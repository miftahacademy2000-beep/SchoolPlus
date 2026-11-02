import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, roles, isLoading, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect to auth page, preserving the intended destination
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }


  // If a specific role is required, check for it
  if (requiredRole) {
    // Super admins can access everything
    if (isSuperAdmin) {
      return <>{children}</>;
    }

    const hasRequiredRole = roles.some(r => r.role === requiredRole);
    if (!hasRequiredRole) {
      // Redirect to home if user doesn't have the required role
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
