import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { School } from '@/types';

interface SchoolCardProps {
  school: School;
  onClick?: () => void;
  className?: string;
  delay?: number;
}

export function SchoolCard({ school, onClick, className, delay = 0 }: SchoolCardProps) {
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
      transition={{ duration: 0.3, delay }}
      onClick={onClick}
      className={cn(
        'bg-card rounded-xl border border-border p-5 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
        className
      )}
    >
      <div className="flex items-start gap-4">
        {/* School logo */}
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary text-lg font-bold">
          {school.name.charAt(0)}
        </div>

        {/* School info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground truncate">{school.name}</h3>
            <Badge className={cn('shrink-0', statusColors[school.status])}>
              {school.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {school.email}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Students</p>
          <p className="text-lg font-semibold text-foreground">
            {school.studentCount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Teachers</p>
          <p className="text-lg font-semibold text-foreground">
            {school.teacherCount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Plan</p>
          <Badge className={cn('mt-0.5', planColors[school.plan])}>
            {school.plan}
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}
