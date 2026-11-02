import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";

import SchoolsPage from "./pages/SchoolsPage";
import UsersPage from "./pages/UsersPage";
import TeachersPage from "./pages/TeachersPage";
import StudentsPage from "./pages/StudentsPage";
import StudentProfilePage from "./pages/StudentProfilePage";
import ParentsPage from "./pages/ParentsPage";
import ClassesPage from "./pages/ClassesPage";
import AttendancePage from "./pages/AttendancePage";
import GradesPage from "./pages/GradesPage";
import TimetablePage from "./pages/TimetablePage";
import CoursesPage from "./pages/CoursesPage";
import CourseDetailsPage from "./pages/CourseDetailsPage";
import StudentPortal from "./pages/StudentPortal";
import ParentPortal from "./pages/ParentPortal";
import TeacherPortal from "./pages/TeacherPortal";
import AnalyticsPage from "./pages/AnalyticsPage";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceTemplatesPage from "./pages/InvoiceTemplatesPage";
import SchoolSettingsPage from "./pages/SchoolSettingsPage";
import BillingPage from "./pages/BillingPage";
import AssignmentsPage from "./pages/AssignmentsPage";
import MaterialsPage from "./pages/MaterialsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import ArchivedUsersPage from "./pages/ArchivedUsersPage";
import ReportCardPage from "./pages/ReportCardPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import NotificationsPage from "./pages/NotificationsPage";
import HelpPage from "./pages/HelpPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<AuthPage />} />
            
            
            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            
            {/* Super Admin Routes */}
            <Route path="/schools" element={<ProtectedRoute><SchoolsPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute requiredRole="super_admin"><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path="/subscriptions" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute><AuditLogsPage /></ProtectedRoute>} />
            <Route path="/archived-users" element={<ProtectedRoute><ArchivedUsersPage /></ProtectedRoute>} />
            
            {/* School Admin Routes */}
            <Route path="/teachers" element={<ProtectedRoute><TeachersPage /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
            <Route path="/students/:id" element={<ProtectedRoute><StudentProfilePage /></ProtectedRoute>} />
            <Route path="/parents" element={<ProtectedRoute><ParentsPage /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><ClassesPage /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
            <Route path="/courses/:id" element={<ProtectedRoute><CourseDetailsPage /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
            <Route path="/grades" element={<ProtectedRoute><GradesPage /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute><TimetablePage /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
            <Route path="/invoice-templates" element={<ProtectedRoute><InvoiceTemplatesPage /></ProtectedRoute>} />
            <Route path="/school-settings" element={<ProtectedRoute><SchoolSettingsPage /></ProtectedRoute>} />
            <Route path="/assignments" element={<ProtectedRoute><AssignmentsPage /></ProtectedRoute>} />
            <Route path="/materials" element={<ProtectedRoute><MaterialsPage /></ProtectedRoute>} />
            <Route path="/report-card" element={<ProtectedRoute><ReportCardPage /></ProtectedRoute>} />
            <Route path="/students/:studentId/report-cards" element={<ProtectedRoute><ReportCardPage /></ProtectedRoute>} />
            
            {/* Common Routes */}
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            
            {/* Student Portal */}
            <Route path="/my-portal" element={<ProtectedRoute><StudentPortal /></ProtectedRoute>} />
            
            {/* Parent Portal */}
            <Route path="/family-portal" element={<ProtectedRoute><ParentPortal /></ProtectedRoute>} />
            
            {/* Teacher Portal */}
            <Route path="/teacher-portal" element={<ProtectedRoute><TeacherPortal /></ProtectedRoute>} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
