import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { useParents, useDeleteParent, useUnlinkParentFromStudent, type ParentWithProfile } from '@/hooks/useParents';
import { AddParentModal } from '@/components/users/AddParentModal';
import { EditParentModal } from '@/components/users/EditParentModal';
import { LinkStudentModal } from '@/components/users/LinkStudentModal';
import { Search, Users, Loader2, MoreVertical, Mail, Phone, MapPin, Briefcase, Trash2, Edit, GraduationCap, Plus, Link2, Unlink } from 'lucide-react';

export default function ParentsPage() {
  const [search, setSearch] = useState('');
  const [parentToDelete, setParentToDelete] = useState<ParentWithProfile | null>(null);
  const [parentToEdit, setParentToEdit] = useState<ParentWithProfile | null>(null);
  const [parentToLink, setParentToLink] = useState<ParentWithProfile | null>(null);
  const [linkToRemove, setLinkToRemove] = useState<{ id: string; studentName: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const { data: parents, isLoading, error } = useParents();
  const deleteParent = useDeleteParent();
  const unlinkStudent = useUnlinkParentFromStudent();

  const filteredParents = parents?.filter((parent) => {
    const matchesSearch =
      !search ||
      parent.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      parent.profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
      parent.phone?.includes(search);

    return matchesSearch;
  });

  const handleDelete = async () => {
    if (!parentToDelete) return;
    await deleteParent.mutateAsync({
      originalId: parentToDelete.id,
      userId: parentToDelete.user_id,
      schoolId: parentToDelete.school_id,
      userType: 'parent',
      fullName: parentToDelete.profile?.full_name || null,
      email: parentToDelete.profile?.email || null,
      metadata: {
        phone: parentToDelete.phone,
        address: parentToDelete.address,
        occupation: parentToDelete.occupation,
      },
    });
    setParentToDelete(null);
  };

  const handleUnlink = async () => {
    if (!linkToRemove) return;
    await unlinkStudent.mutateAsync(linkToRemove.id);
    setLinkToRemove(null);
  };

  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.[0]?.toUpperCase() || '?';
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Parents"
        description="Manage school parents and guardians"
        breadcrumbs={[{ label: 'Parents' }]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parents by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Parent
        </Button>
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
          <h2 className="text-lg font-semibold text-foreground mb-1">Error loading parents</h2>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      ) : filteredParents?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No parents found</h2>
          <p className="text-sm text-muted-foreground">
            {search ? 'Try adjusting your search' : 'Parents will appear here once added'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredParents?.map((parent) => (
            <Card key={parent.id} className="overflow-hidden transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border-2 border-border">
                    <AvatarImage src={parent.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(parent.profile?.full_name, parent.profile?.email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-foreground truncate">
                        {parent.profile?.full_name || 'Unnamed Parent'}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="gap-2"
                            onClick={() => setParentToLink(parent)}
                          >
                            <Link2 className="h-4 w-4" /> Link Student
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2"
                            onClick={() => setParentToEdit(parent)}
                          >
                            <Edit className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="gap-2 text-destructive"
                            onClick={() => setParentToDelete(parent)}
                          >
                            <Trash2 className="h-4 w-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {parent.profile?.email && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{parent.profile.email}</span>
                      </div>
                    )}

                    {parent.phone && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{parent.phone}</span>
                      </div>
                    )}

                    {parent.occupation && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>{parent.occupation}</span>
                      </div>
                    )}

                    {parent.address && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{parent.address}</span>
                      </div>
                    )}

                    {parent.children && parent.children.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <span className="text-xs text-muted-foreground">Children:</span>
                        {parent.children.map((child) => (
                          <Badge 
                            key={child.id} 
                            variant="secondary" 
                            className="text-xs cursor-pointer hover:bg-destructive/10 group"
                            onClick={() => setLinkToRemove({ id: child.id, studentName: child.student_name || 'Unknown' })}
                          >
                            <GraduationCap className="h-3 w-3 mr-1" />
                            {child.student_name || 'Unknown'}
                            <Unlink className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!parentToDelete} onOpenChange={() => setParentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Parent</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove <strong>{parentToDelete?.profile?.full_name}</strong>? Their record will be archived and can be restored later.
                </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!linkToRemove} onOpenChange={() => setLinkToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink <strong>{linkToRemove?.studentName}</strong> from this parent?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddParentModal open={showAddModal} onOpenChange={setShowAddModal} />
      
      {parentToLink && (
        <LinkStudentModal 
          open={!!parentToLink} 
          onOpenChange={(open) => !open && setParentToLink(null)} 
          parent={parentToLink}
        />
      )}

      {parentToEdit && (
        <EditParentModal 
          open={!!parentToEdit} 
          onOpenChange={(open) => !open && setParentToEdit(null)} 
          parent={parentToEdit}
        />
      )}
    </DashboardLayout>
  );
}
