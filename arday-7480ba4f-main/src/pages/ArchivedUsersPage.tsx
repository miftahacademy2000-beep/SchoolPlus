import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  useArchivedUsers,
  useRestoreUser,
  usePermanentlyDeleteArchived,
  type ArchivedUser,
} from '@/hooks/useArchivedUsers';
import {
  Search,
  Archive,
  Loader2,
  RotateCcw,
  Trash2,
  GraduationCap,
  Users,
  UserPlus,
  Mail,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

const userTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  student: { label: 'Student', icon: <GraduationCap className="h-3 w-3" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  teacher: { label: 'Teacher', icon: <Users className="h-3 w-3" />, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  parent: { label: 'Parent', icon: <UserPlus className="h-3 w-3" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

export default function ArchivedUsersPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [userToRestore, setUserToRestore] = useState<ArchivedUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<ArchivedUser | null>(null);

  const { data: archivedUsers, isLoading, error } = useArchivedUsers();
  const restoreUser = useRestoreUser();
  const permanentlyDelete = usePermanentlyDeleteArchived();

  const filteredUsers = archivedUsers?.filter((user) => {
    const matchesSearch =
      !search ||
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'all' || user.user_type === typeFilter;

    return matchesSearch && matchesType;
  });

  const handleRestore = async () => {
    if (!userToRestore) return;
    await restoreUser.mutateAsync(userToRestore);
    setUserToRestore(null);
  };

  const handlePermanentDelete = async () => {
    if (!userToDelete) return;
    await permanentlyDelete.mutateAsync(userToDelete.id);
    setUserToDelete(null);
  };

  const getInitials = (name: string | null | undefined) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return '?';
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Archived Users"
        description="View and restore previously removed users"
        breadcrumbs={[{ label: 'Archived Users' }]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search archived users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="student">Students</SelectItem>
            <SelectItem value="teacher">Teachers</SelectItem>
            <SelectItem value="parent">Parents</SelectItem>
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
            <Archive className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Error loading archives</h2>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      ) : filteredUsers?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Archive className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No archived users</h2>
          <p className="text-sm text-muted-foreground">
            {search || typeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Removed users will appear here for review and restoration'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredUsers?.map((user) => {
            const config = userTypeConfig[user.user_type] || userTypeConfig.student;
            return (
              <Card key={user.id} className="overflow-hidden transition-all hover:shadow-md border-dashed">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 border-2 border-border opacity-75">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {user.full_name || 'Unnamed User'}
                      </h3>

                      {user.email && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge className={`text-xs ${config.color}`}>
                          {config.icon}
                          <span className="ml-1">{config.label}</span>
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                        <Calendar className="h-3 w-3" />
                        <span>Archived: {format(new Date(user.archived_at), 'dd/MM/yyyy')}</span>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={() => setUserToRestore(user)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-xs text-destructive hover:text-destructive"
                          onClick={() => setUserToDelete(user)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Restore Dialog */}
      <AlertDialog open={!!userToRestore} onOpenChange={() => setUserToRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore <strong>{userToRestore?.full_name}</strong> as a {userToRestore?.user_type}? They will be added back to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{userToDelete?.full_name}</strong>'s archived record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
