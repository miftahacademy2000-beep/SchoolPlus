import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/hooks/useUsers';

interface UserRoleBadgeProps {
  role: AppRole;
  schoolName?: string;
  onRemove?: () => void;
  removable?: boolean;
}

const roleConfig: Record<AppRole, { label: string; className: string }> = {
  super_admin: {
    label: 'Super Admin',
    className: 'bg-super-admin/10 text-super-admin border-super-admin/20',
  },
  school_admin: {
    label: 'School Admin',
    className: 'bg-school-admin/10 text-school-admin border-school-admin/20',
  },
  teacher: {
    label: 'Teacher',
    className: 'bg-teacher/10 text-teacher border-teacher/20',
  },
  student: {
    label: 'Student',
    className: 'bg-student/10 text-student border-student/20',
  },
  parent: {
    label: 'Parent',
    className: 'bg-parent/10 text-parent border-parent/20',
  },
};

export function UserRoleBadge({ role, schoolName, onRemove, removable = false }: UserRoleBadgeProps) {
  const config = roleConfig[role];

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 pr-1.5 font-medium',
        config.className,
        removable && 'pr-1'
      )}
    >
      <span>{config.label}</span>
      {schoolName && (
        <span className="text-muted-foreground font-normal">@ {schoolName}</span>
      )}
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
          aria-label="Remove role"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}
