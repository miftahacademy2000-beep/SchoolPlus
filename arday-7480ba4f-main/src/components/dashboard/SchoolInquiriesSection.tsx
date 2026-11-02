import { useState } from 'react';
import { format } from 'date-fns';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useSchoolInquiries, type SchoolInquiry, type InquiryStatus } from '@/hooks/useSchoolInquiries';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const statusConfig: Record<InquiryStatus, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: typeof Clock }> = {
  pending: { label: 'Pending', variant: 'secondary', icon: Clock },
  approved: { label: 'Approved', variant: 'default', icon: CheckCircle2 },
  rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
};

function InquiryCard({ inquiry }: { inquiry: SchoolInquiry }) {
  const { updateInquiryStatus, deleteInquiry } = useSchoolInquiries();
  const [expanded, setExpanded] = useState(false);
  const [adminNotes, setAdminNotes] = useState(inquiry.admin_notes || '');

  const config = statusConfig[inquiry.status];
  const StatusIcon = config.icon;

  const handleStatusUpdate = (status: InquiryStatus) => {
    updateInquiryStatus.mutate({ id: inquiry.id, status, admin_notes: adminNotes });
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{inquiry.school_name}</h3>
            <Badge variant={config.variant} className="gap-1 shrink-0">
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{inquiry.contact_name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Submitted {format(new Date(inquiry.created_at), 'MMM d, yyyy · h:mm a')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Contact details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <a href={`mailto:${inquiry.email}`} className="text-primary hover:underline truncate">
                {inquiry.email}
              </a>
            </div>
            {inquiry.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{inquiry.phone}</span>
              </div>
            )}
            {inquiry.address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{inquiry.address}</span>
              </div>
            )}
          </div>

          {inquiry.message && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                <MessageSquare className="h-3 w-3" />
                Message
              </div>
              <p className="text-sm text-foreground">{inquiry.message}</p>
            </div>
          )}

          {/* Admin notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Admin Notes</label>
            <Textarea
              placeholder="Add notes about this inquiry..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {inquiry.status !== 'approved' && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => handleStatusUpdate('approved')}
                disabled={updateInquiryStatus.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </Button>
            )}
            {inquiry.status !== 'rejected' && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => handleStatusUpdate('rejected')}
                disabled={updateInquiryStatus.isPending}
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
            )}
            {inquiry.status === 'pending' && adminNotes !== (inquiry.admin_notes || '') && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleStatusUpdate(inquiry.status)}
                disabled={updateInquiryStatus.isPending}
              >
                Save Notes
              </Button>
            )}
            <div className="flex-1" />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Inquiry</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete the inquiry from "{inquiry.school_name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteInquiry.mutate(inquiry.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {inquiry.reviewed_at && (
            <p className="text-xs text-muted-foreground">
              Last reviewed {format(new Date(inquiry.reviewed_at), 'MMM d, yyyy · h:mm a')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

type FilterStatus = 'all' | InquiryStatus;

export function SchoolInquiriesSection() {
  const { inquiries, isLoading } = useSchoolInquiries();
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered = filter === 'all' ? inquiries : inquiries.filter((i) => i.status === filter);
  const pendingCount = inquiries.filter((i) => i.status === 'pending').length;

  const filters: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: `All (${inquiries.length})` },
    { value: 'pending', label: `Pending (${pendingCount})` },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">School Inquiries</h2>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {pendingCount} pending
            </Badge>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {filters.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? 'default' : 'ghost'}
            onClick={() => setFilter(f.value)}
            className="text-xs"
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {filter === 'all' ? 'No school inquiries yet' : `No ${filter} inquiries`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inquiry) => (
            <InquiryCard key={inquiry.id} inquiry={inquiry} />
          ))}
        </div>
      )}
    </div>
  );
}
