import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Search, Users, UserPlus } from 'lucide-react';
import { useEnrollStudents, useClassEnrollment } from '@/hooks/useClassEnrollment';

interface EnrollStudentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
}

export function EnrollStudentsModal({
  open,
  onOpenChange,
  classId,
  className,
}: EnrollStudentsModalProps) {
  const [search, setSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  
  const { data, isLoading } = useClassEnrollment(classId);
  const enrollStudents = useEnrollStudents();

  const availableStudents = useMemo(() => {
    if (!data?.availableStudents) return [];
    if (!search) return data.availableStudents;
    
    return data.availableStudents.filter(student =>
      student.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      student.enrollment_number?.toLowerCase().includes(search.toLowerCase()) ||
      student.grade?.toLowerCase().includes(search.toLowerCase())
    );
  }, [data?.availableStudents, search]);

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleAll = () => {
    if (selectedStudents.length === availableStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(availableStudents.map(s => s.id));
    }
  };

  const handleEnroll = async () => {
    if (selectedStudents.length === 0) return;
    
    await enrollStudents.mutateAsync({
      classId,
      studentIds: selectedStudents,
    });
    
    setSelectedStudents([]);
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedStudents([]);
    setSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Enroll Students
          </DialogTitle>
          <DialogDescription>
            Add students to <strong>{className}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Currently enrolled count */}
        {data?.enrolledStudents && data.enrolledStudents.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{data.enrolledStudents.length} students currently enrolled</span>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Student list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : availableStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No students match your search' : 'All students are already enrolled'}
            </p>
          </div>
        ) : (
          <>
            {/* Select all */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedStudents.length === availableStudents.length}
                  onCheckedChange={toggleAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Select all ({availableStudents.length})
                </label>
              </div>
              {selectedStudents.length > 0 && (
                <Badge variant="secondary">{selectedStudents.length} selected</Badge>
              )}
            </div>

            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-2">
                {availableStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleStudent(student.id)}
                  >
                    <Checkbox
                      checked={selectedStudents.includes(student.id)}
                      onCheckedChange={() => toggleStudent(student.id)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {student.profile?.full_name?.charAt(0) || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {student.profile?.full_name || 'Unknown Student'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {student.enrollment_number || 'No ID'} • {student.grade || 'No grade'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={selectedStudents.length === 0 || enrollStudents.isPending}
          >
            {enrollStudents.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enroll {selectedStudents.length > 0 ? `(${selectedStudents.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
