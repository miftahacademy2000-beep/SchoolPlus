import { format } from 'date-fns';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Calendar,
  Users,
  GraduationCap,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { School } from '@/types';

interface ViewSchoolDialogProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewSchoolDialog({ school, open, onOpenChange }: ViewSchoolDialogProps) {
  if (!school) return null;

  const statusStyles = {
    ACTIVE: 'bg-success/10 text-success border-success/20',
    PENDING: 'bg-warning/10 text-warning border-warning/20',
    SUSPENDED: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  const planStyles = {
    FREE: 'bg-muted text-muted-foreground',
    PRO: 'bg-primary/10 text-primary',
    ENTERPRISE: 'bg-super-admin/10 text-super-admin',
  };

  const infoItems = [
    { icon: Mail, label: 'Email', value: school.email },
    { icon: Phone, label: 'Phone', value: school.phone },
    { icon: MapPin, label: 'Address', value: school.address },
    { icon: Globe, label: 'Website', value: school.website },
  ].filter((item) => item.value);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary text-2xl font-bold">
              {school.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="truncate">{school.name}</SheetTitle>
              <SheetDescription className="truncate">/{school.slug}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status & Plan */}
          <div className="flex items-center gap-3">
            <Badge className={cn(statusStyles[school.status])}>{school.status}</Badge>
            <Badge className={cn(planStyles[school.plan])}>{school.plan} Plan</Badge>
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <GraduationCap className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold text-foreground">{school.studentCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Students</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold text-foreground">{school.teacherCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Teachers</p>
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          {infoItems.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Contact Information</h4>
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm text-foreground">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Dates */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Timeline</h4>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm text-foreground">{format(school.createdAt, 'PPP')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm text-foreground">{format(school.updatedAt, 'PPP')}</p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
