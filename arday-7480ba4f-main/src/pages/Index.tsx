import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import SuperAdminDashboard from './SuperAdminDashboard';
import SchoolAdminDashboard from './SchoolAdminDashboard';
import StudentPortal from './StudentPortal';
import ParentPortal from './ParentPortal';
import TeacherPortal from './TeacherPortal';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { primaryRole, isSuperAdmin, isLoading, profile } = useAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(false);

  // Check if this is a newly created super admin (first user)
  useEffect(() => {
    if (isSuperAdmin && !isLoading) {
      // Check localStorage to see if we've shown the welcome message
      const hasSeenWelcome = localStorage.getItem('eduflow_admin_welcome_seen');
      if (!hasSeenWelcome) {
        setShowWelcome(true);
      }
    }
  }, [isSuperAdmin, isLoading]);

  const dismissWelcome = () => {
    localStorage.setItem('eduflow_admin_welcome_seen', 'true');
    setShowWelcome(false);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Show welcome message for first-time super admin
  if (showWelcome && isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="max-w-lg">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">
                  Welcome, {profile?.full_name || 'Admin'}!
                </CardTitle>
                <CardDescription className="text-base">
                  You've been assigned as the Super Administrator
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-center text-muted-foreground">
                  As the first user of EduFlow, you have full access to manage all schools, 
                  users, and platform settings. Here's what you can do next:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 mt-0.5 text-primary" />
                    <span>Add your first school to the platform</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 mt-0.5 text-primary" />
                    <span>Invite school administrators to manage their schools</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 mt-0.5 text-primary" />
                    <span>Monitor platform-wide analytics and reports</span>
                  </li>
                </ul>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={dismissWelcome}>
                    Go to Dashboard
                  </Button>
                  <Button className="flex-1 gap-2" onClick={() => {
                    dismissWelcome();
                    navigate('/schools');
                  }}>
                    Add First School
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  // Route to appropriate dashboard based on role
  if (isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  if (primaryRole === 'school_admin') {
    return <SchoolAdminDashboard />;
  }

  if (primaryRole === 'teacher') {
    return <TeacherPortal />;
  }

  if (primaryRole === 'student') {
    return <StudentPortal />;
  }

  if (primaryRole === 'parent') {
    return <ParentPortal />;
  }

  // Default dashboard for users without a specific role
  return <SchoolAdminDashboard />;
};

export default Index;
