import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
}

interface AppState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  
  // User session (mock for now)
  user: User | null;
  setUser: (user: User | null) => void;
  
  // Current school context
  currentSchoolId: string | null;
  setCurrentSchoolId: (id: string | null) => void;
  
  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Notifications
  unreadNotifications: number;
  setUnreadNotifications: (count: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarOpen: false,
      sidebarCollapsed: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      
      // User - Demo super admin by default
      user: {
        id: '1',
        name: 'John Administrator',
        email: 'admin@eduflow.com',
        role: 'SUPER_ADMIN',
        avatar: undefined,
      },
      setUser: (user) => set({ user }),
      
      // Current school
      currentSchoolId: null,
      setCurrentSchoolId: (id) => set({ currentSchoolId: id }),
      
      // Theme
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      
      // Notifications
      unreadNotifications: 5,
      setUnreadNotifications: (count) => set({ unreadNotifications: count }),
    }),
    {
      name: 'eduflow-app-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);
