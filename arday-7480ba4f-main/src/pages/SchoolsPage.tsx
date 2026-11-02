import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  Loader2,
  PlayCircle,
} from 'lucide-react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { DataTable } from '@/components/dashboard';
import { AddSchoolModal, EditSchoolModal, ViewSchoolDialog } from '@/components/schools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { School } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type DbSchool = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: 'active' | 'suspended' | 'pending';
  plan: 'free' | 'pro' | 'enterprise';
  created_by: string | null;
  monthly_fee: string | null;
  created_at: string;
  updated_at: string;
};
type SchoolStatus = 'active' | 'suspended' | 'pending';

interface DbSchoolWithCounts extends DbSchool {
  _count?: {
    students: number;
    teachers: number;
  };
  students?: { count: number }[];
  teachers?: { count: number }[];
}

function transformSchool(dbSchool: DbSchoolWithCounts): School {
  return {
    id: dbSchool.id,
    name: dbSchool.name,
    slug: dbSchool.slug,
    email: dbSchool.email || undefined,
    phone: dbSchool.phone || undefined,
    address: dbSchool.address || undefined,
    website: dbSchool.website || undefined,
    logo: dbSchool.logo_url || undefined,
    status: dbSchool.status.toUpperCase() as 'ACTIVE' | 'PENDING' | 'SUSPENDED',
    plan: dbSchool.plan.toUpperCase() as 'FREE' | 'PRO' | 'ENTERPRISE',
    studentCount: dbSchool.students?.[0]?.count ?? 0,
    teacherCount: dbSchool.teachers?.[0]?.count ?? 0,
    createdAt: new Date(dbSchool.created_at),
    updatedAt: new Date(dbSchool.updated_at),
  };
}

// Reusable actions dropdown
interface SchoolActionsMenuProps {
  school: School;
  onView: (school: School) => void;
  onEdit: (school: School) => void;
  onStatusChange: (schoolId: string, status: SchoolStatus) => void;
  onDelete: (school: School) => void;
  isUpdating: boolean;
}

function SchoolActionsMenu({ school, onView, onEdit, onStatusChange, onDelete, isUpdating }: SchoolActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isUpdating}>
          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="gap-2" onClick={() => onView(school)}>
          <Eye className="h-4 w-4" /> View Details
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => onEdit(school)}>
          <Edit className="h-4 w-4" /> Edit School
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {school.status === 'PENDING' && (
          <DropdownMenuItem className="gap-2 text-success" onClick={() => onStatusChange(school.id, 'active')}>
            <PlayCircle className="h-4 w-4" /> Activate
          </DropdownMenuItem>
        )}
        {school.status === 'ACTIVE' && (
          <DropdownMenuItem className="gap-2 text-warning" onClick={() => onStatusChange(school.id, 'suspended')}>
            <Ban className="h-4 w-4" /> Suspend
          </DropdownMenuItem>
        )}
        {school.status === 'SUSPENDED' && (
          <DropdownMenuItem className="gap-2 text-success" onClick={() => onStatusChange(school.id, 'active')}>
            <CheckCircle className="h-4 w-4" /> Reactivate
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDelete(school)}>
          <Trash2 className="h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Grid card with actions
interface SchoolGridCardProps {
  school: School;
  index: number;
  onView: (school: School) => void;
  onEdit: (school: School) => void;
  onStatusChange: (schoolId: string, status: SchoolStatus) => void;
  onDelete: (school: School) => void;
  isUpdating: boolean;
}

function SchoolGridCard({ school, index, onView, onEdit, onStatusChange, onDelete, isUpdating }: SchoolGridCardProps) {
  const statusColors = {
    ACTIVE: 'bg-success/10 text-success border-success/20',
    SUSPENDED: 'bg-destructive/10 text-destructive border-destructive/20',
    PENDING: 'bg-warning/10 text-warning border-warning/20',
  };
  const planColors = {
    FREE: 'bg-muted text-muted-foreground',
    PRO: 'bg-primary/10 text-primary',
    ENTERPRISE: 'bg-super-admin/10 text-super-admin',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="bg-card rounded-xl border border-border p-5 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary text-lg font-bold cursor-pointer"
          onClick={() => onView(school)}
        >
          {school.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
              onClick={() => onView(school)}
            >
              {school.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              <Badge className={cn(statusColors[school.status])}>{school.status}</Badge>
              <SchoolActionsMenu
                school={school}
                onView={onView}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                isUpdating={isUpdating}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{school.email || school.slug}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Students</p>
          <p className="text-lg font-semibold text-foreground">{school.studentCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Teachers</p>
          <p className="text-lg font-semibold text-foreground">{school.teacherCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Plan</p>
          <Badge className={cn('mt-0.5', planColors[school.plan])}>{school.plan}</Badge>
        </div>
      </div>
    </motion.div>
  );
}

export default function SchoolsPage() {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);
  const [schoolToEdit, setSchoolToEdit] = useState<School | null>(null);
  const [schoolToView, setSchoolToView] = useState<School | null>(null);
  const [updatingSchoolId, setUpdatingSchoolId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: async () => {
      const { data } = await api.get<DbSchoolWithCounts[]>('/schools', {
        params: { select: '*,students(count),teachers(count)' }
      });
      return (data || []).map((s) => transformSchool(s));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ schoolId, status }: { schoolId: string; status: SchoolStatus }) => {
      await api.put(`/schools/${schoolId}`, { status });
    },
    onMutate: ({ schoolId }) => setUpdatingSchoolId(schoolId),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      const msgs: Record<SchoolStatus, string> = {
        active: 'School activated successfully!',
        suspended: 'School suspended successfully!',
        pending: 'School set to pending!',
      };
      toast.success(msgs[status]);
    },
    onError: (error: Error) => toast.error(`Failed to update school: ${error.message}`),
    onSettled: () => setUpdatingSchoolId(null),
  });

  const deleteSchoolMutation = useMutation({
    mutationFn: async (schoolId: string) => {
      await api.delete(`/schools/${schoolId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      toast.success('School deleted successfully!');
      setSchoolToDelete(null);
    },
    onError: (error: Error) => toast.error(`Failed to delete school: ${error.message}`),
  });

  const handleStatusChange = (schoolId: string, status: SchoolStatus) => {
    updateStatusMutation.mutate({ schoolId, status });
  };

  const schoolColumns = [
    {
      key: 'name',
      header: 'School',
      cell: (school: School) => (
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSchoolToView(school)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
            {school.name.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-foreground hover:text-primary transition-colors">{school.name}</p>
            <p className="text-xs text-muted-foreground">{school.email || school.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (school: School) => {
        const styles = {
          ACTIVE: 'bg-success/10 text-success border-success/20',
          PENDING: 'bg-warning/10 text-warning border-warning/20',
          SUSPENDED: 'bg-destructive/10 text-destructive border-destructive/20',
        };
        return <Badge className={styles[school.status]}>{school.status}</Badge>;
      },
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (school: School) => {
        const styles = {
          FREE: 'bg-muted text-muted-foreground',
          PRO: 'bg-primary/10 text-primary',
          ENTERPRISE: 'bg-super-admin/10 text-super-admin',
        };
        return <Badge className={styles[school.plan]}>{school.plan}</Badge>;
      },
    },
    {
      key: 'createdAt',
      header: 'Joined',
      cell: (school: School) => (
        <span className="text-muted-foreground">{school.createdAt.toLocaleDateString()}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (school: School) => (
        <SchoolActionsMenu
          school={school}
          onView={setSchoolToView}
          onEdit={setSchoolToEdit}
          onStatusChange={handleStatusChange}
          onDelete={setSchoolToDelete}
          isUpdating={updatingSchoolId === school.id}
        />
      ),
      className: 'w-12',
    },
  ];

  const filteredSchools = schools.filter((school) => {
    const matchesSearch =
      school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (school.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'all' || school.status === statusFilter;
    const matchesPlan = planFilter === 'all' || school.plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Schools"
        description="Manage all schools on the platform"
        breadcrumbs={[{ label: 'Schools' }]}
        actions={
          <Button className="gap-2" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add School
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search schools..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="FREE">Free</SelectItem>
            <SelectItem value="PRO">Pro</SelectItem>
            <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* View Toggle */}
      <Tabs value={view} onValueChange={(v) => setView(v as 'grid' | 'table')} className="mb-6">
        <TabsList>
          <TabsTrigger value="grid">Grid View</TabsTrigger>
          <TabsTrigger value="table">Table View</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && view === 'grid' && filteredSchools.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchools.map((school, index) => (
            <SchoolGridCard
              key={school.id}
              school={school}
              index={index}
              onView={setSchoolToView}
              onEdit={setSchoolToEdit}
              onStatusChange={handleStatusChange}
              onDelete={setSchoolToDelete}
              isUpdating={updatingSchoolId === school.id}
            />
          ))}
        </div>
      )}

      {!isLoading && view === 'table' && filteredSchools.length > 0 && (
        <DataTable columns={schoolColumns} data={filteredSchools} />
      )}

      {!isLoading && filteredSchools.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {schools.length === 0 ? 'No schools yet' : 'No schools found'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {schools.length === 0 ? 'Get started by adding your first school' : 'Try adjusting your search or filters'}
          </p>
          {schools.length === 0 ? (
            <Button onClick={() => setIsAddModalOpen(true)} className="gap-2"><Plus className="h-4 w-4" />Add School</Button>
          ) : (
            <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPlanFilter('all'); }}>Clear filters</Button>
          )}
        </motion.div>
      )}

      {/* Modals */}
      <AddSchoolModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['schools'] })} />
      <EditSchoolModal school={schoolToEdit} open={!!schoolToEdit} onOpenChange={(o) => !o && setSchoolToEdit(null)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['schools'] })} />
      <ViewSchoolDialog school={schoolToView} open={!!schoolToView} onOpenChange={(o) => !o && setSchoolToView(null)} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!schoolToDelete} onOpenChange={(open) => !open && setSchoolToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete School</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{schoolToDelete?.name}"? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => schoolToDelete && deleteSchoolMutation.mutate(schoolToDelete.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteSchoolMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
