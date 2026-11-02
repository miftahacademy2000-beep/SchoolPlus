import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  CreditCard,
  Check,
  Sparkles,
  Building2,
  Crown,
  Loader2,
  ArrowRight,
  Receipt,
  TrendingUp,
  DollarSign,
  Search,
  MoreHorizontal,
  Plus,
  FileText,
  Download,
} from 'lucide-react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateSubscriptionInvoicePdf } from '@/lib/generateSubscriptionInvoicePdf';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

interface SchoolRecord {
  id: string;
  name: string;
  plan: SubscriptionPlan;
  status: string;
  email: string | null;
  created_at: string;
}

const planConfig = {
  free: {
    label: 'Free', price: 0, icon: Building2,
    color: 'text-muted-foreground', bgColor: 'bg-muted/50', borderColor: 'border-muted',
    chartColor: 'hsl(var(--muted-foreground))', badgeClass: 'bg-muted text-muted-foreground',
  },
  pro: {
    label: 'Pro', price: 49, icon: Sparkles,
    color: 'text-primary', bgColor: 'bg-primary/10', borderColor: 'border-primary',
    chartColor: 'hsl(var(--primary))', badgeClass: 'bg-primary/10 text-primary border-primary/20',
  },
  enterprise: {
    label: 'Enterprise', price: 199, icon: Crown,
    color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500',
    chartColor: 'hsl(40, 96%, 50%)', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
};

const planPrices: Record<SubscriptionPlan, number> = { free: 0, pro: 49, enterprise: 199 };

export default function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [changePlanDialog, setChangePlanDialog] = useState<{ school: SchoolRecord; newPlan: SubscriptionPlan } | null>(null);
  const [generateInvoiceDialog, setGenerateInvoiceDialog] = useState(false);
  const [invoiceSchoolId, setInvoiceSchoolId] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');

  // Fetch all schools
  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['admin-billing-schools'],
    queryFn: async (): Promise<SchoolRecord[]> => {
      const { data } = await api.get<SchoolRecord[]>('/schools', { params: { order: 'created_at desc' } });
      return data || [];
    },
  });

  // Fetch subscription payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['subscription-payments'],
    queryFn: async () => {
      const { data } = await api.get<any[]>('/subscription-payments', { params: { order: 'created_at desc' } });
      return data || [];
    },
  });

  // Change plan mutation
  const changePlanMutation = useMutation({
    mutationFn: async ({ schoolId, plan }: { schoolId: string; plan: SubscriptionPlan }) => {
      await api.put(`/schools/${schoolId}`, { plan });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-billing-schools'] });
      setChangePlanDialog(null);
      toast({ title: 'Plan updated', description: 'The school subscription has been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Generate invoice mutation
  const generateInvoiceMutation = useMutation({
    mutationFn: async () => {
      const school = schools.find(s => s.id === invoiceSchoolId);
      if (!school) throw new Error('Select a school');
      if (school.plan === 'free') throw new Error('Cannot generate invoice for free plan');

      const now = new Date();
      const periodStart = startOfMonth(now);
      const periodEnd = endOfMonth(now);
      const amount = planPrices[school.plan] || 0;
      const invoiceNumber = `SUB-${format(now, 'yyyyMM')}-${school.name.replace(/\s/g, '').substring(0, 5).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      await api.post('/subscription-payments', {
        school_id: school.id,
        invoice_number: invoiceNumber,
        plan: school.plan,
        amount,
        billing_period_start: format(periodStart, 'yyyy-MM-dd'),
        billing_period_end: format(periodEnd, 'yyyy-MM-dd'),
        status: 'pending',
        notes: invoiceNotes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] });
      setGenerateInvoiceDialog(false);
      setInvoiceSchoolId('');
      setInvoiceNotes('');
      toast({ title: 'Invoice generated', description: 'Subscription invoice has been created.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Mark as paid
  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      await api.put(`/subscription-payments/${paymentId}`, { status: 'paid', paid_date: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-payments'] });
      toast({ title: 'Marked as paid' });
    },
  });

  const handleDownloadPdf = (payment: any) => {
    const school = schools.find(s => s.id === payment.school_id);
    generateSubscriptionInvoicePdf({
      ...payment,
      school: school ? { name: school.name, email: school.email, phone: null, address: null } : null,
    });
  };

  // Stats
  const freeCt = schools.filter(s => s.plan === 'free').length;
  const proCt = schools.filter(s => s.plan === 'pro').length;
  const entCt = schools.filter(s => s.plan === 'enterprise').length;
  const mrr = proCt * 49 + entCt * 199;
  const arr = mrr * 12;

  const pieData = [
    { name: 'Free', value: freeCt, color: planConfig.free.chartColor },
    { name: 'Pro', value: proCt, color: planConfig.pro.chartColor },
    { name: 'Enterprise', value: entCt, color: planConfig.enterprise.chartColor },
  ].filter(d => d.value > 0);

  const revenueData = [
    { plan: 'Free', revenue: 0, schools: freeCt },
    { plan: 'Pro', revenue: proCt * 49, schools: proCt },
    { plan: 'Enterprise', revenue: entCt * 199, schools: entCt },
  ];

  const filteredSchools = schools.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPlan = planFilter === 'all' || s.plan === planFilter;
    return matchSearch && matchPlan;
  });

  const filteredPayments = payments.filter((p: any) => {
    const school = schools.find(s => s.id === p.school_id);
    const matchSearch = school?.name.toLowerCase().includes(paymentSearchQuery.toLowerCase()) ||
      p.invoice_number.toLowerCase().includes(paymentSearchQuery.toLowerCase());
    const matchStatus = paymentStatusFilter === 'all' || p.status === paymentStatusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Platform Billing"
        description="Manage school subscriptions and track platform revenue"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Billing' }]}
      />

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Total Schools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{schools.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{schools.filter(s => s.status === 'active').length} active</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Monthly Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">${mrr.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">MRR from {proCt + entCt} paid schools</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Annual Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">${arr.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Projected ARR</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Paid Conversion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {schools.length > 0 ? Math.round(((proCt + entCt) / schools.length) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">{proCt + entCt} of {schools.length} schools</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="schools" className="gap-2">
            <Building2 className="h-4 w-4" /> School Plans
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <Receipt className="h-4 w-4" /> Payment History
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Plan Distribution</CardTitle>
                  <CardDescription>Schools by subscription plan</CardDescription>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="w-48 h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value: number, name: string) => [`${value} schools`, name]}
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-4 flex-1">
                        {([
                          { plan: 'free' as const, count: freeCt },
                          { plan: 'pro' as const, count: proCt },
                          { plan: 'enterprise' as const, count: entCt },
                        ]).map(({ plan, count }) => {
                          const cfg = planConfig[plan];
                          const Icon = cfg.icon;
                          return (
                            <div key={plan} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', cfg.bgColor)}>
                                  <Icon className={cn('h-4 w-4', cfg.color)} />
                                </div>
                                <div>
                                  <p className="font-medium">{cfg.label}</p>
                                  <p className="text-xs text-muted-foreground">${cfg.price}/mo per school</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">{count}</p>
                                <p className="text-xs text-muted-foreground">
                                  {schools.length > 0 ? Math.round((count / schools.length) * 100) : 0}%
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      No schools registered yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Revenue by Plan</CardTitle>
                  <CardDescription>Monthly revenue breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tickFormatter={(v) => `$${v}`} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis dataKey="plan" type="category" width={80} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <RechartsTooltip
                          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        />
                        <Bar dataKey="revenue" radius={[0, 6, 6, 0]} fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Monthly Revenue</span>
                      <span className="text-lg font-bold text-primary">${mrr.toLocaleString()}/mo</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* School Plans Tab */}
        <TabsContent value="schools">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>School Subscriptions</CardTitle>
                    <CardDescription>Manage subscription plans for all schools</CardDescription>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                  </div>
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="All Plans" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>School</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Monthly Cost</TableHead>
                        <TableHead>Member Since</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSchools.length > 0 ? (
                        filteredSchools.map((school) => {
                          const cfg = planConfig[school.plan] || planConfig.free;
                          const Icon = cfg.icon;
                          return (
                            <TableRow key={school.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{school.name}</p>
                                  {school.email && <p className="text-xs text-muted-foreground">{school.email}</p>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={cn('gap-1', cfg.badgeClass)}>
                                  <Icon className="h-3 w-3" />{cfg.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn(
                                  school.status === 'active' && 'bg-success/10 text-success border-success/20',
                                  school.status === 'suspended' && 'bg-destructive/10 text-destructive border-destructive/20',
                                  school.status === 'pending' && 'bg-warning/10 text-warning border-warning/20'
                                )}>
                                  {school.status.charAt(0).toUpperCase() + school.status.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="font-semibold">
                                  {planPrices[school.plan] === 0 ? 'Free' : `$${planPrices[school.plan]}`}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {format(new Date(school.created_at), 'MMM yyyy')}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">Change Plan</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {(['free', 'pro', 'enterprise'] as SubscriptionPlan[])
                                      .filter(p => p !== school.plan)
                                      .map(p => {
                                        const pcfg = planConfig[p];
                                        const PIcon = pcfg.icon;
                                        return (
                                          <DropdownMenuItem key={p} className="gap-2" onClick={() => setChangePlanDialog({ school, newPlan: p })}>
                                            <PIcon className={cn('h-4 w-4', pcfg.color)} />
                                            Switch to {pcfg.label}
                                          </DropdownMenuItem>
                                        );
                                      })}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                            {searchQuery || planFilter !== 'all' ? 'No schools match your filters' : 'No schools registered yet'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Payment History Tab */}
        <TabsContent value="payments">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Payment History</CardTitle>
                    <CardDescription>View and manage subscription invoices</CardDescription>
                  </div>
                  <Button className="gap-2" onClick={() => setGenerateInvoiceDialog(true)}>
                    <Plus className="h-4 w-4" />
                    Generate Invoice
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search by school or invoice number..." value={paymentSearchQuery} onChange={(e) => setPaymentSearchQuery(e.target.value)} className="pl-9" />
                  </div>
                  <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>School</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Billing Period</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.length > 0 ? (
                          filteredPayments.map((payment: any) => {
                            const school = schools.find(s => s.id === payment.school_id);
                            const cfg = planConfig[payment.plan as SubscriptionPlan] || planConfig.free;
                            const Icon = cfg.icon;
                            return (
                              <TableRow key={payment.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-mono text-sm">{payment.invoice_number}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <p className="font-medium">{school?.name || 'Unknown'}</p>
                                </TableCell>
                                <TableCell>
                                  <Badge className={cn('gap-1', cfg.badgeClass)}>
                                    <Icon className="h-3 w-3" />{cfg.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(payment.billing_period_start), 'MMM dd')} — {format(new Date(payment.billing_period_end), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>
                                  <span className="font-semibold">${Number(payment.amount).toLocaleString()}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={cn(
                                    payment.status === 'paid' && 'bg-success/10 text-success border-success/20',
                                    payment.status === 'pending' && 'bg-warning/10 text-warning border-warning/20',
                                    payment.status === 'overdue' && 'bg-destructive/10 text-destructive border-destructive/20',
                                  )}>
                                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(payment.created_at), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem className="gap-2" onClick={() => handleDownloadPdf(payment)}>
                                        <Download className="h-4 w-4" />
                                        Download PDF
                                      </DropdownMenuItem>
                                      {payment.status === 'pending' && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="gap-2" onClick={() => markPaidMutation.mutate(payment.id)}>
                                            <Check className="h-4 w-4" />
                                            Mark as Paid
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                              {paymentSearchQuery || paymentStatusFilter !== 'all'
                                ? 'No payments match your filters'
                                : 'No subscription invoices yet. Click "Generate Invoice" to create one.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Change Plan Dialog */}
      <Dialog open={!!changePlanDialog} onOpenChange={(open) => !open && setChangePlanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Update <strong>{changePlanDialog?.school.name}</strong>'s plan from{' '}
              <strong>{planConfig[changePlanDialog?.school.plan || 'free'].label}</strong> to{' '}
              <strong>{planConfig[changePlanDialog?.newPlan || 'free'].label}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                {changePlanDialog && (() => {
                  const OldIcon = planConfig[changePlanDialog.school.plan].icon;
                  return <OldIcon className={cn('h-5 w-5', planConfig[changePlanDialog.school.plan].color)} />;
                })()}
                <span className="text-muted-foreground">${planPrices[changePlanDialog?.school.plan || 'free']}/mo</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-3">
                {changePlanDialog && (() => {
                  const NewIcon = planConfig[changePlanDialog.newPlan].icon;
                  return <NewIcon className={cn('h-5 w-5', planConfig[changePlanDialog.newPlan].color)} />;
                })()}
                <span className="font-semibold">${planPrices[changePlanDialog?.newPlan || 'free']}/mo</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanDialog(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (changePlanDialog) changePlanMutation.mutate({ schoolId: changePlanDialog.school.id, plan: changePlanDialog.newPlan });
              }}
              disabled={changePlanMutation.isPending}
            >
              {changePlanMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : 'Confirm Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Invoice Dialog */}
      <Dialog open={generateInvoiceDialog} onOpenChange={setGenerateInvoiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Subscription Invoice</DialogTitle>
            <DialogDescription>
              Create a subscription invoice for a paid school for the current billing period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>School *</Label>
              <Select value={invoiceSchoolId} onValueChange={setInvoiceSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a school..." />
                </SelectTrigger>
                <SelectContent>
                  {schools.filter(s => s.plan !== 'free').map(s => {
                    const cfg = planConfig[s.plan];
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          {s.name}
                          <Badge className={cn('text-xs ml-1', cfg.badgeClass)}>{cfg.label}</Badge>
                        </span>
                      </SelectItem>
                    );
                  })}
                  {schools.filter(s => s.plan !== 'free').length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No paid schools available</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            {invoiceSchoolId && (() => {
              const school = schools.find(s => s.id === invoiceSchoolId);
              if (!school) return null;
              const now = new Date();
              return (
                <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">{planConfig[school.plan].label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-bold text-primary">${planPrices[school.plan]}.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing Period</span>
                    <span>{format(startOfMonth(now), 'MMM dd')} — {format(endOfMonth(now), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Additional notes for this invoice..."
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateInvoiceDialog(false)}>Cancel</Button>
            <Button
              onClick={() => generateInvoiceMutation.mutate()}
              disabled={!invoiceSchoolId || generateInvoiceMutation.isPending}
              className="gap-2"
            >
              {generateInvoiceMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Receipt className="h-4 w-4" /> Generate Invoice</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
