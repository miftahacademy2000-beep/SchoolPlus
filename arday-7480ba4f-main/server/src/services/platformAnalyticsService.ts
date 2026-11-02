import { prisma } from '../config/database.js';

const MONTH_COUNT = 12;
const PLAN_COLORS = ['#64748b', '#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777'];

type MonthlyCount = { month: string; count: bigint | number };
type MonthlyRevenue = { month: string; currency: string; amount: string | number };
type CurrencyTotal = { currency: string; amount: string | number };

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - MONTH_COUNT + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const months = Array.from({ length: MONTH_COUNT }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      name: new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' }).format(date),
    };
  });
  return { start, end, months };
}

const asNumber = (value: bigint | number | string | null | undefined) => Number(value ?? 0);

export async function getPlatformAnalytics() {
  const { start, end, months } = getMonthRange();

  const [
    totalSchools,
    schoolsByStatus,
    activeSchools,
    planGroups,
    totalUsers,
    activeUsers,
    totalStudents,
    totalTeachers,
    totalParents,
    totalClasses,
    totalCourses,
    pendingInquiries,
    invoiceStatusGroups,
    invoiceOutstanding,
    invoiceRevenue,
    subscriptionRevenue,
    activeSubscriptions,
    monthlySchools,
    monthlyStudents,
    monthlyInvoiceRevenue,
    monthlySubscriptionRevenue,
    recentSchools,
    recentUsers,
    recentInvoices,
    recentPayments,
    recentSubscriptionPayments,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.school.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.school.count({ where: { status: 'active', is_enabled: true } }),
    prisma.school.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.profile.count(),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT m.user_id) AS count
      FROM memberships m
      INNER JOIN profiles p ON p.id = m.user_id
      INNER JOIN schools s ON s.id = m.school_id
      WHERE m.is_active = 1
    `,
    prisma.student.count({ where: { archived_at: null } }),
    prisma.teacher.count({ where: { archived_at: null } }),
    prisma.parent.count({ where: { archived_at: null } }),
    prisma.class.count(),
    prisma.course.count(),
    prisma.schoolInquiry.count({ where: { status: 'pending' } }),
    prisma.invoice.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.$queryRaw<CurrencyTotal[]>`
      SELECT i.currency AS currency,
             SUM(GREATEST(i.amount - i.amount_paid, 0)) AS amount
      FROM invoices i
      INNER JOIN schools s ON s.id = i.school_id
      WHERE LOWER(i.status) IN ('pending', 'overdue')
      GROUP BY i.currency
    `,
    prisma.$queryRaw<CurrencyTotal[]>`
      SELECT i.currency AS currency, SUM(p.amount) AS amount
      FROM payment_history p
      INNER JOIN invoices i ON i.id = p.invoice_id AND i.school_id = p.school_id
      INNER JOIN schools s ON s.id = p.school_id
      WHERE LOWER(i.status) NOT IN ('cancelled', 'canceled', 'void')
      GROUP BY i.currency
    `,
    prisma.subscriptionPayment.aggregate({
      where: { status: 'paid' },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT sp.school_id) AS count
      FROM subscription_payments sp
      INNER JOIN schools s ON s.id = sp.school_id
      WHERE LOWER(sp.status) = 'paid'
        AND sp.billing_period_start <= CURRENT_DATE()
        AND sp.billing_period_end >= CURRENT_DATE()
    `,
    prisma.$queryRaw<MonthlyCount[]>`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
      FROM schools
      WHERE created_at >= ${start} AND created_at < ${end}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    `,
    prisma.$queryRaw<MonthlyCount[]>`
      SELECT DATE_FORMAT(COALESCE(st.start_date, DATE(st.created_at)), '%Y-%m') AS month,
             COUNT(*) AS count
      FROM students st
      INNER JOIN schools s ON s.id = st.school_id
      WHERE st.archived_at IS NULL
        AND COALESCE(st.start_date, DATE(st.created_at)) >= ${start}
        AND COALESCE(st.start_date, DATE(st.created_at)) < ${end}
      GROUP BY DATE_FORMAT(COALESCE(st.start_date, DATE(st.created_at)), '%Y-%m')
    `,
    prisma.$queryRaw<MonthlyRevenue[]>`
      SELECT DATE_FORMAT(p.created_at, '%Y-%m') AS month,
             i.currency AS currency,
             SUM(p.amount) AS amount
      FROM payment_history p
            INNER JOIN invoices i ON i.id = p.invoice_id AND i.school_id = p.school_id
      INNER JOIN schools s ON s.id = p.school_id
      WHERE LOWER(i.status) NOT IN ('cancelled', 'canceled', 'void')
        AND p.created_at >= ${start} AND p.created_at < ${end}
      GROUP BY DATE_FORMAT(p.created_at, '%Y-%m'), i.currency
    `,
    prisma.$queryRaw<MonthlyRevenue[]>`
      SELECT DATE_FORMAT(COALESCE(sp.paid_date, sp.created_at), '%Y-%m') AS month,
             'USD' AS currency,
             SUM(sp.amount) AS amount
      FROM subscription_payments sp
      INNER JOIN schools s ON s.id = sp.school_id
      WHERE LOWER(sp.status) = 'paid'
        AND COALESCE(sp.paid_date, sp.created_at) >= ${start}
        AND COALESCE(sp.paid_date, sp.created_at) < ${end}
      GROUP BY DATE_FORMAT(COALESCE(sp.paid_date, sp.created_at), '%Y-%m')
    `,
    prisma.school.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        status: true,
        plan: true,
        createdAt: true,
        _count: { select: { students: { where: { archived_at: null } }, teachers: { where: { archived_at: null } } } },
      },
    }),
    prisma.profile.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, fullName: true, email: true, createdAt: true },
    }),
    prisma.invoice.findMany({
      where: { status: { notIn: ['cancelled', 'canceled', 'void'] } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, invoiceNumber: true, status: true, amount: true, currency: true, createdAt: true, schools: { select: { name: true } } },
    }),
    prisma.paymentHistory.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, amount: true, createdAt: true, school_id: true, invoice: { select: { schoolId: true, currency: true } }, schools: { select: { name: true } } },
    }),
    prisma.subscriptionPayment.findMany({
      where: { status: 'paid' },
      take: 10,
      orderBy: { paidDate: 'desc' },
      select: { id: true, amount: true, plan: true, paidDate: true, createdAt: true, schools: { select: { name: true } } },
    }),
  ]);

  const statusCounts = Object.fromEntries(schoolsByStatus.map((entry) => [entry.status.toLowerCase(), entry._count._all]));
  const planDistribution = planGroups.map((entry, index) => ({
    name: entry.plan,
    value: entry._count._all,
    color: PLAN_COLORS[index % PLAN_COLORS.length],
  }));
  const invoiceCounts = Object.fromEntries(invoiceStatusGroups.map((entry) => [entry.status.toLowerCase(), entry._count._all]));
  const excludedInvoices = (invoiceCounts.cancelled ?? 0) + (invoiceCounts.canceled ?? 0) + (invoiceCounts.void ?? 0);
  const monthlyCountMap = (items: MonthlyCount[]) => new Map(items.map((item) => [item.month, asNumber(item.count)]));
  const schoolGrowth = monthlyCountMap(monthlySchools);
  const studentGrowth = monthlyCountMap(monthlyStudents);
  const revenueByMonth = new Map<string, Record<string, number>>();
  for (const item of monthlyInvoiceRevenue) {
    const month = revenueByMonth.get(item.month) ?? {};
    month[item.currency] = (month[item.currency] ?? 0) + asNumber(item.amount);
    revenueByMonth.set(item.month, month);
  }
  for (const item of monthlySubscriptionRevenue) {
    const month = revenueByMonth.get(item.month) ?? {};
    month[item.currency] = (month[item.currency] ?? 0) + asNumber(item.amount);
    revenueByMonth.set(item.month, month);
  }

  const activity = [
    ...recentSchools.map((school) => ({
      id: `school-${school.id}`, type: 'school_registered', title: 'New school registered', description: school.name, createdAt: school.createdAt,
    })),
    ...recentUsers.map((user) => ({
      id: `user-${user.id}`, type: 'user_registered', title: 'New user registered', description: user.fullName || user.email || 'User', createdAt: user.createdAt,
    })),
    ...recentInvoices.map((invoice) => ({
      id: `invoice-${invoice.id}`, type: 'invoice_created', title: 'Invoice created', description: `${invoice.invoiceNumber} · ${invoice.schools.name}`, amount: Number(invoice.amount), currency: invoice.currency, createdAt: invoice.createdAt,
    })),
    ...recentPayments.filter((payment) => payment.school_id === payment.invoice.schoolId).map((payment) => ({
      id: `payment-${payment.id}`, type: 'payment_received', title: 'Payment recorded', description: payment.schools.name, amount: Number(payment.amount), currency: payment.invoice.currency, createdAt: payment.createdAt,
    })),
    ...recentSubscriptionPayments.map((payment) => ({
      id: `subscription-${payment.id}`, type: 'subscription_paid', title: 'Subscription payment received', description: `${payment.schools.name} · ${payment.plan}`, amount: Number(payment.amount), currency: 'USD', createdAt: payment.paidDate ?? payment.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  const currencies = (items: CurrencyTotal[]) => items.map((item) => ({ currency: item.currency, amount: asNumber(item.amount) }));

  return {
    totals: {
      totalSchools,
      activeSchools,
      pendingSchools: statusCounts.pending ?? 0,
      suspendedSchools: statusCounts.suspended ?? 0,
      inactiveSchools: totalSchools - activeSchools,
      totalUsers,
      activeUsers: asNumber(activeUsers[0]?.count),
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses,
      totalCourses,
      totalInvoices: invoiceStatusGroups.reduce((sum, entry) => sum + entry._count._all, 0) - excludedInvoices,
      paidInvoices: invoiceCounts.paid ?? 0,
      unpaidInvoices: (invoiceCounts.pending ?? 0) + (invoiceCounts.overdue ?? 0),
      pendingInvoices: invoiceCounts.pending ?? 0,
      overdueInvoices: invoiceCounts.overdue ?? 0,
      pendingInquiries,
      activeSubscriptions: asNumber(activeSubscriptions[0]?.count),
    },
    planDistribution,
    financials: {
      invoicePaymentsReceived: currencies(invoiceRevenue),
      outstandingBalance: currencies(invoiceOutstanding),
      subscriptionPaymentsReceived: Number(subscriptionRevenue._sum.amount ?? 0),
      subscriptionCurrency: 'USD',
    },
    monthlyStats: months.map(({ key, name }) => ({
      name,
      schools: schoolGrowth.get(key) ?? 0,
      students: studentGrowth.get(key) ?? 0,
      revenue: revenueByMonth.get(key) ?? {},
    })),
    recentSchools: recentSchools.map((school) => ({
      id: school.id,
      name: school.name,
      slug: school.slug,
      email: school.email,
      status: school.status,
      plan: school.plan,
      studentCount: school._count.students,
      teacherCount: school._count.teachers,
      createdAt: school.createdAt,
    })),
    recentActivity: activity,
  };
}
