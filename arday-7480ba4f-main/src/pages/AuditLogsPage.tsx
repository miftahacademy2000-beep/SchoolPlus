import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  FileText, 
  Search, 
  Filter,
  User,
  Calendar,
  Activity,
  Loader2,
  Shield
} from 'lucide-react';
import { api } from '@/lib/api';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';

interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  school_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const actionColors: Record<string, string> = {
  create: 'bg-green-500/10 text-green-700 dark:text-green-400',
  update: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  delete: 'bg-red-500/10 text-red-700 dark:text-red-400',
  login: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  logout: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  password_change: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  enroll: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  activate: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  deactivate: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
};

export default function AuditLogsPage() {
  const { isSuperAdmin } = useAuth();
  const { currentSchoolId } = useSchoolContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', currentSchoolId, actionFilter, entityFilter],
    queryFn: async (): Promise<AuditLog[]> => {
      const params: Record<string, string | undefined> = {};
      if (!isSuperAdmin && currentSchoolId) {
        params.school_id = currentSchoolId;
      }
      if (actionFilter !== 'all') {
        params.action = actionFilter;
      }
      if (entityFilter !== 'all') {
        params.entity_type = entityFilter;
      }

      const { data } = await api.get<AuditLog[]>('/audit-logs', { params });
      return data || [];
    },
  });

  const filteredLogs = logs?.filter(log => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      log.user_name?.toLowerCase().includes(search) ||
      log.user_email?.toLowerCase().includes(search) ||
      log.entity_name?.toLowerCase().includes(search) ||
      log.action.toLowerCase().includes(search)
    );
  });

  const getActionBadge = (action: string) => {
    const colorClass = actionColors[action] || 'bg-muted text-muted-foreground';
    return (
      <Badge variant="outline" className={`${colorClass} border-0`}>
        {action.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Audit Logs"
          description="Track all administrative actions and system events"
        />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Activity History
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-36">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="password_change">Password Change</SelectItem>
                    <SelectItem value="enroll">Enroll</SelectItem>
                    <SelectItem value="activate">Activate</SelectItem>
                    <SelectItem value="deactivate">Deactivate</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Entity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="class">Class</SelectItem>
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="grade">Grade</SelectItem>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Timestamp
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          User
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Action
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Entity
                        </div>
                      </TableHead>
                      <TableHead>Target</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {log.user_name || 'System'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {log.user_email || ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {log.entity_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.entity_name || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No audit logs found</p>
                <p className="text-sm">
                  Actions will be logged as users interact with the system.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
