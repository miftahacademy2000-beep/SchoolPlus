import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSuperAdminDashboard } from '@/hooks/useSuperAdminDashboard';
import { api } from '@/lib/api';

function DashboardDataProbe() {
  const { data, isError } = useSuperAdminDashboard();
  if (isError) return <p>Dashboard request failed</p>;
  if (!data) return <p>Loading platform metrics</p>;
  return <>
    <span>{data.totals.totalSchools} schools</span>
    <span>{data.financials.invoicePaymentsReceived[0]?.amount ?? 'no revenue'}</span>
    <span>{data.monthlyStats.length} monthly points</span>
    <span>{data.recentActivity.length} activities</span>
  </>;
}

describe('Super Admin dashboard data contract', () => {
  it('unwraps and exposes platform-wide metrics returned by the API', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        totals: { totalSchools: 14, totalUsers: 80, totalStudents: 51 },
        financials: { invoicePaymentsReceived: [{ currency: 'USD', amount: 725 }], outstandingBalance: [], subscriptionPaymentsReceived: 0, subscriptionCurrency: 'USD' },
        planDistribution: [{ name: 'free', value: 14, color: '#64748b' }],
        recentSchools: [],
        monthlyStats: [{ name: 'Sep 26', schools: 1, students: 2, revenue: { USD: 25 } }],
        recentActivity: [{ id: 'payment-1', type: 'payment_received', title: 'Payment recorded', description: 'School A', createdAt: '2026-09-01T00:00:00.000Z', amount: 25, currency: 'USD' }],
      },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(<QueryClientProvider client={queryClient}><DashboardDataProbe /></QueryClientProvider>);

    await waitFor(() => expect(screen.getByText('14 schools')).toBeInTheDocument());
    expect(screen.getByText('725')).toBeInTheDocument();
    expect(screen.getByText('1 monthly points')).toBeInTheDocument();
    expect(screen.getByText('1 activities')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/analytics/platform');
  });
});
