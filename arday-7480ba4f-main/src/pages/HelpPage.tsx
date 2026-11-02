import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, BookOpen, GraduationCap, Users, CreditCard, Shield, Settings,
  BarChart3, CalendarDays, ClipboardList, FileText, Bell, HelpCircle,
  MessageSquare, School, UserPlus, KeyRound, LayoutDashboard,
} from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
  tags: string[];
}

interface GuideItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  steps: string[];
  role: 'all' | 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';
}

const faqs: FaqItem[] = [
  { q: 'How do I reset a user\'s password?', a: 'Navigate to Users, find the user, click Edit, and use the "Reset Password" option. Alternatively, go to Profile → Manage All Users as a Super Admin.', tags: ['users', 'password', 'admin'] },
  { q: 'How do I add a new school?', a: 'Go to the Schools page and click "Add School". Fill in the school name, contact details, and subscription plan. The school will appear as "Pending" until activated.', tags: ['schools', 'admin'] },
  { q: 'How do I enroll students in a class?', a: 'Navigate to Classes, select a class, and click "Enroll Students". You can search and select multiple students to enroll at once.', tags: ['classes', 'students', 'enrollment'] },
  { q: 'How do I take attendance?', a: 'Go to the Attendance page, select the class and date, then mark each student as Present, Absent, Late, or Excused. Teachers can only edit attendance for the current day.', tags: ['attendance', 'teacher'] },
  { q: 'How do I create assignments?', a: 'Navigate to Assignments, click "Add Assignment", select the course and class, set the due date and maximum score, then publish it for students to see.', tags: ['assignments', 'teacher'] },
  { q: 'How do I view my grades?', a: 'Students can view grades from the Student Portal or the Grades page. Parents can see their children\'s grades through the Parent Portal.', tags: ['grades', 'student', 'parent'] },
  { q: 'How do I generate invoices?', a: 'Go to Invoices, click "Create Invoice", select the student, enter the amount and due date. You can also customize invoice templates from the Invoice Templates page.', tags: ['invoices', 'billing'] },
  { q: 'How do I manage platform settings?', a: 'Super Admins can access Settings from the sidebar. The Settings page has tabs for Platform configuration, Security, Notifications, Defaults, and personal preferences.', tags: ['settings', 'admin'] },
  { q: 'How do I upload learning materials?', a: 'Teachers can upload materials from the Materials page. Click "Upload Material", select the course, add a title and description, then choose the file to upload.', tags: ['materials', 'teacher'] },
  { q: 'How do I view the timetable?', a: 'Navigate to Schedule/Timetable from the sidebar. School admins can create and manage timetable slots. Teachers and students can view their assigned schedules.', tags: ['timetable', 'schedule'] },
  { q: 'How do I link a parent to a student?', a: 'Go to the Parents page, find the parent, and use "Link Student" to associate them. Parents will then be able to view their children\'s grades, attendance, and invoices.', tags: ['parents', 'students'] },
  { q: 'How do I export attendance or grade reports?', a: 'On the Attendance or Grades page, use the Export button to download data as CSV or PDF. You can filter by date range, class, or student before exporting.', tags: ['reports', 'export'] },
  { q: 'What are the different user roles?', a: 'The platform has five roles: Super Admin (platform-wide access), School Admin (manages one school), Teacher (manages classes and grades), Student (views own data), and Parent (views children\'s data).', tags: ['roles', 'users'] },
  { q: 'How do I view audit logs?', a: 'Super Admins and School Admins can access Audit Logs from the sidebar. These logs track all significant actions like user creation, grade changes, and setting modifications.', tags: ['audit', 'admin'] },
  { q: 'How do I change my profile picture?', a: 'Go to your Profile page, click the "Upload" button under your avatar. Select an image file (max 5MB). You can also remove your current avatar.', tags: ['profile', 'avatar'] },
];

const guides: GuideItem[] = [
  {
    title: 'Getting Started as Super Admin',
    description: 'Set up your platform from scratch',
    icon: <Shield className="h-5 w-5" />,
    role: 'super_admin',
    steps: [
      'Log in with your Super Admin credentials',
      'Navigate to Settings → Platform to configure your platform name and defaults',
      'Go to Schools to add your first school',
      'Create School Admin accounts under Users',
      'Configure security and notification settings',
    ],
  },
  {
    title: 'Setting Up a School',
    description: 'Configure classes, courses, and staff',
    icon: <School className="h-5 w-5" />,
    role: 'school_admin',
    steps: [
      'Add teachers from the Teachers page',
      'Create classes with grade levels and sections',
      'Set up courses and assign teachers',
      'Add students and enroll them in classes',
      'Configure the timetable schedule',
    ],
  },
  {
    title: 'Managing Your Classroom',
    description: 'Day-to-day teacher tasks',
    icon: <GraduationCap className="h-5 w-5" />,
    role: 'teacher',
    steps: [
      'Check your assigned classes and courses',
      'Take daily attendance for each class',
      'Create and publish assignments',
      'Upload learning materials for students',
      'Enter and manage student grades',
    ],
  },
  {
    title: 'Student Portal Guide',
    description: 'Navigate your student dashboard',
    icon: <BookOpen className="h-5 w-5" />,
    role: 'student',
    steps: [
      'View your enrolled courses and class schedule',
      'Check assignments and submit completed work',
      'Monitor your grades across all courses',
      'Download learning materials from teachers',
      'View your attendance record',
    ],
  },
  {
    title: 'Parent Portal Guide',
    description: 'Stay informed about your child\'s progress',
    icon: <Users className="h-5 w-5" />,
    role: 'parent',
    steps: [
      'Log in to access the Family Portal',
      'View your children\'s attendance records',
      'Check grades and report cards',
      'Review and pay outstanding invoices',
      'Contact teachers through the platform',
    ],
  },
  {
    title: 'Billing & Invoices',
    description: 'Manage school finances',
    icon: <CreditCard className="h-5 w-5" />,
    role: 'school_admin',
    steps: [
      'Navigate to Invoices to create student invoices',
      'Customize invoice templates with your school branding',
      'Track payment status and overdue invoices',
      'View student balances and payment history',
      'Export payment reports for accounting',
    ],
  },
];

const categoryIcons: Record<string, React.ReactNode> = {
  'Getting Started': <LayoutDashboard className="h-4 w-4" />,
  'User Management': <UserPlus className="h-4 w-4" />,
  'Academic': <GraduationCap className="h-4 w-4" />,
  'Billing': <CreditCard className="h-4 w-4" />,
  'Reports': <BarChart3 className="h-4 w-4" />,
};

export default function HelpPage() {
  const { primaryRole } = useAuth();
  const [search, setSearch] = useState('');

  const filteredFaqs = faqs.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q) || f.tags.some(t => t.includes(q));
  });

  const relevantGuides = guides.filter(
    (g) => g.role === 'all' || g.role === primaryRole || primaryRole === 'super_admin'
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Help Center"
        description="Find answers, guides, and support resources"
        breadcrumbs={[{ label: 'Help Center' }]}
      />

      <div className="max-w-4xl space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            className="pl-10 h-12 text-base"
            placeholder="Search for help topics, guides, or questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Tabs defaultValue="guides" className="space-y-6">
          <TabsList>
            <TabsTrigger value="guides" className="gap-1.5">
              <BookOpen className="h-4 w-4" /> Guides
            </TabsTrigger>
            <TabsTrigger value="faq" className="gap-1.5">
              <HelpCircle className="h-4 w-4" /> FAQ
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="gap-1.5">
              <KeyRound className="h-4 w-4" /> Quick Reference
            </TabsTrigger>
          </TabsList>

          {/* Guides Tab */}
          <TabsContent value="guides">
            <div className="grid gap-4 sm:grid-cols-2">
              {relevantGuides.map((guide, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary">
                        {guide.icon}
                        <CardTitle className="text-sm">{guide.title}</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {guide.role === 'all' ? 'Everyone' : guide.role.replace('_', ' ')}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">{guide.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      {guide.steps.map((step, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5">
                            {j + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-5 w-5" /> Frequently Asked Questions
                </CardTitle>
                <CardDescription>{filteredFaqs.length} question{filteredFaqs.length !== 1 ? 's' : ''} found</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredFaqs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No matching questions found. Try a different search term.</p>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {filteredFaqs.map((faq, i) => (
                      <AccordionItem key={i} value={`faq-${i}`}>
                        <AccordionTrigger className="text-sm text-left">{faq.q}</AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-muted-foreground mb-2">{faq.a}</p>
                          <div className="flex gap-1 flex-wrap">
                            {faq.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] capitalize">{tag}</Badge>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quick Reference Tab */}
          <TabsContent value="shortcuts">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <LayoutDashboard className="h-4 w-4" /> Navigation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    { icon: <School className="h-4 w-4" />, label: 'Schools', path: '/schools', role: 'Super Admin' },
                    { icon: <Users className="h-4 w-4" />, label: 'Users & Roles', path: '/users', role: 'Super Admin' },
                    { icon: <GraduationCap className="h-4 w-4" />, label: 'Students', path: '/students', role: 'School Admin' },
                    { icon: <ClipboardList className="h-4 w-4" />, label: 'Attendance', path: '/attendance', role: 'Teacher+' },
                    { icon: <BarChart3 className="h-4 w-4" />, label: 'Grades', path: '/grades', role: 'Teacher+' },
                    { icon: <CalendarDays className="h-4 w-4" />, label: 'Timetable', path: '/schedule', role: 'All' },
                    { icon: <FileText className="h-4 w-4" />, label: 'Invoices', path: '/invoices', role: 'School Admin' },
                    { icon: <Bell className="h-4 w-4" />, label: 'Notifications', path: '/notifications', role: 'All' },
                    { icon: <Settings className="h-4 w-4" />, label: 'Settings', path: '/settings', role: 'All' },
                  ].map((item) => (
                    <div key={item.path} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{item.role}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4" /> Role Permissions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    { role: 'Super Admin', desc: 'Full platform access, manage all schools and users', variant: 'destructive' as const },
                    { role: 'School Admin', desc: 'Manage one school — staff, students, billing, settings', variant: 'default' as const },
                    { role: 'Teacher', desc: 'Attendance, grades, assignments, materials for assigned classes', variant: 'secondary' as const },
                    { role: 'Student', desc: 'View own grades, attendance, assignments, and timetable', variant: 'secondary' as const },
                    { role: 'Parent', desc: 'View children\'s academic progress and invoices', variant: 'secondary' as const },
                  ].map((r) => (
                    <div key={r.role} className="flex items-start gap-2">
                      <Badge variant={r.variant} className="text-[10px] shrink-0 mt-0.5">{r.role}</Badge>
                      <span className="text-muted-foreground text-xs">{r.desc}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
