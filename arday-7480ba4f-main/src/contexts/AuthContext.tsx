import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { isEmail } from '@/lib/validations/auth';

type AppRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  must_change_password: boolean;
  preferred_language?: string;
}

interface UserRole {
  id: string;
  role: AppRole;
  school_id: string | null;
}

interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  must_change_password: boolean;
  user: AuthUser;
  roles: UserRole[];
}

interface MeResponse {
  user: AuthUser;
  roles: UserRole[];
}

interface AuthContextType {
  user: AuthUser | null;
  session: { token: string } | null;
  profile: Profile | null;
  roles: UserRole[];
  primaryRole: AppRole | null;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<{ token: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.get<MeResponse>('/auth/me');
      setUser(response.user ?? null);
      setProfile(response.user as Profile);
      setRoles(response.roles);
    } catch {
      setUser(null);
      setProfile(null);
      setRoles([]);
    }
  }, []);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      setSession({ token });
      fetchProfile().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const credentials = isEmail(email)
        ? { email, password }
        : { login_id: email, password };
      const response = await api.post<LoginResponse>('/auth/login', credentials);

      api.setToken(response.access_token);
      api.setRefreshToken(response.refresh_token);
      setSession({ token: response.access_token });
      setUser(response.user);

      setProfile(response.user as Profile);
      setRoles(response.roles || []);
      return { error: null };
    } catch (e) {
      return { error: e as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      await api.post('/auth/register', { email, password, fullName });
      return { error: null };
    } catch (e) {
      return { error: e as Error };
    }
  };

  const signOut = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    api.clearToken();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
  };

  const getPrimaryRole = (): AppRole | null => {
    if (roles.length === 0) return null;
    const priority: AppRole[] = ['super_admin', 'school_admin', 'teacher', 'student', 'parent'];
    for (const role of priority) {
      if (roles.some(r => r.role === role)) {
        return role;
      }
    }
    return null;
  };

  const isSuperAdmin = roles.some(r => r.role === 'super_admin');

  const refetchProfile = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        primaryRole: getPrimaryRole(),
        isLoading,
        signUp,
        signIn,
        signOut,
        isSuperAdmin,
        refetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
