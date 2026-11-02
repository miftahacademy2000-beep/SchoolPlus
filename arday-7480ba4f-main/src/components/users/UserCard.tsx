import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus, Mail, Calendar } from 'lucide-react';
import { UserRoleBadge } from './UserRoleBadge';
import { AddRoleDialog } from './AddRoleDialog';
import { useRemoveRole, type UserWithRoles } from '@/hooks/useUsers';
import { format } from 'date-fns';
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

interface UserCardProps {
  user: UserWithRoles;
}

export function UserCard({ user }: UserCardProps) {
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState<{
    id: string;
    role: string;
    schoolName?: string;
  } | null>(null);
  
  const removeRole = useRemoveRole();

  const initials = user.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user.email?.[0]?.toUpperCase() || '?';

  const handleRemoveRole = async () => {
    if (!roleToRemove) return;
    await removeRole.mutateAsync(roleToRemove.id);
    setRoleToRemove(null);
  };

  return (
    <>
      <Card className="overflow-hidden transition-all hover:shadow-md">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 border-2 border-border">
              <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || ''} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {user.full_name || 'Unnamed User'}
              </h3>
              
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{user.email}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                <span>Joined {format(new Date(user.created_at), 'MMM d, yyyy')}</span>
              </div>

              {/* Roles */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {user.roles.length === 0 ? (
                  <span className="text-sm text-muted-foreground italic">No roles assigned</span>
                ) : (
                  user.roles.map((role) => (
                    <UserRoleBadge
                      key={role.id}
                      role={role.role}
                      schoolName={role.school_name}
                      removable
                      onRemove={() =>
                        setRoleToRemove({
                          id: role.id,
                          role: role.role,
                          schoolName: role.school_name,
                        })
                      }
                    />
                  ))
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setAddRoleOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Add Role
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddRoleDialog
        open={addRoleOpen}
        onOpenChange={setAddRoleOpen}
        userId={user.id}
        userName={user.full_name || 'this user'}
        existingRoles={user.roles}
      />

      <AlertDialog open={!!roleToRemove} onOpenChange={() => setRoleToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the{' '}
              <strong>{roleToRemove?.role.replace('_', ' ')}</strong> role
              {roleToRemove?.schoolName && (
                <> for <strong>{roleToRemove.schoolName}</strong></>
              )}
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
