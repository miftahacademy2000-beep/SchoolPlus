import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { UserCard } from '@/components/users';
import { Input } from '@/components/ui/input';
import { useUsers } from '@/hooks/useUsers';
import { Search, Users, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AppRole } from '@/hooks/useUsers';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all');
  
  const { data: users, isLoading, error } = useUsers();

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      !search ||
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      roleFilter === 'all' ||
      user.roles.some((r) => r.role === roleFilter);

    return matchesSearch && matchesRole;
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Users"
        description="Manage all platform users and their roles"
        breadcrumbs={[{ label: 'Users' }]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value) => setRoleFilter(value as AppRole | 'all')}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="school_admin">School Admin</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="parent">Parent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <Users className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Error loading users</h2>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      ) : filteredUsers?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No users found</h2>
          <p className="text-sm text-muted-foreground">
            {search || roleFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Users will appear here once they sign up'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredUsers?.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
