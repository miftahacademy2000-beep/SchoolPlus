import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSchools, useAddRole, type AppRole } from '@/hooks/useUsers';
import { Loader2 } from 'lucide-react';

interface AddRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  existingRoles: { role: AppRole; school_id: string | null }[];
}

const roleOptions: { value: AppRole; label: string; requiresSchool: boolean }[] = [
  { value: 'super_admin', label: 'Super Admin', requiresSchool: false },
  { value: 'school_admin', label: 'School Admin', requiresSchool: true },
  { value: 'teacher', label: 'Teacher', requiresSchool: true },
  { value: 'student', label: 'Student', requiresSchool: true },
  { value: 'parent', label: 'Parent', requiresSchool: false },
];

export function AddRoleDialog({
  open,
  onOpenChange,
  userId,
  userName,
  existingRoles,
}: AddRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  
  const { data: schools, isLoading: schoolsLoading } = useSchools();
  const addRole = useAddRole();

  const selectedRoleConfig = roleOptions.find(r => r.value === selectedRole);
  const requiresSchool = selectedRoleConfig?.requiresSchool ?? false;

  const handleSubmit = async () => {
    if (!selectedRole) return;
    
    const schoolId = requiresSchool ? selectedSchool : null;
    if (requiresSchool && !schoolId) return;

    await addRole.mutateAsync({
      userId,
      role: selectedRole,
      schoolId,
    });

    setSelectedRole('');
    setSelectedSchool('');
    onOpenChange(false);
  };

  const isRoleAlreadyAssigned = (role: AppRole, schoolId: string | null) => {
    return existingRoles.some(
      r => r.role === role && r.school_id === schoolId
    );
  };

  const canSubmit = selectedRole && (!requiresSchool || selectedSchool);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Role</DialogTitle>
          <DialogDescription>
            Assign a new role to {userName || 'this user'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => {
                setSelectedRole(value as AppRole);
                setSelectedSchool('');
              }}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresSchool && (
            <div className="grid gap-2">
              <Label htmlFor="school">School</Label>
              {schoolsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading schools...
                </div>
              ) : (
                <Select
                  value={selectedSchool}
                  onValueChange={setSelectedSchool}
                >
                  <SelectTrigger id="school">
                    <SelectValue placeholder="Select a school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools?.map((school) => {
                      const alreadyAssigned = isRoleAlreadyAssigned(
                        selectedRole as AppRole,
                        school.id
                      );
                      return (
                        <SelectItem
                          key={school.id}
                          value={school.id}
                          disabled={alreadyAssigned}
                        >
                          {school.name}
                          {alreadyAssigned && ' (already assigned)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || addRole.isPending}
          >
            {addRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
