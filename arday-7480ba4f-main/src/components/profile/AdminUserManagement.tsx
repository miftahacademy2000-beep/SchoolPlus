import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, Loader2, Save, Mail, Phone, Shield, Pencil, X } from 'lucide-react';

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
}

interface RoleRow {
  id: string;
  role: string;
  school_id: string | null;
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case 'super_admin': return 'destructive' as const;
    case 'school_admin': return 'default' as const;
    default: return 'secondary' as const;
  }
};

export function AdminUserManagement() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<ProfileRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['admin-all-profiles'],
    queryFn: async () => {
      const response = await api.get<{ data: ProfileRow[] }>('/profiles', { params: { admin: 'all', sort: 'full_name' } });
      return (response.data || []) as ProfileRow[];
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ['admin-all-roles'],
    queryFn: async () => {
      const response = await api.get<{ data: (RoleRow & { user_id: string })[] }>('/user-roles', { params: { admin: 'all' } });
      return (response.data || []) as (RoleRow & { user_id: string })[];
    },
  });

  const getRolesForUser = (userId: string) =>
    allRoles.filter((r) => r.user_id === userId);

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q)
    );
  });

  const openEdit = (user: ProfileRow) => {
    setSelectedUser(user);
    setEditName(user.full_name || '');
    setEditPhone(user.phone || '');
    setEditEmail(user.email || '');
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const response = await api.post<{ error?: string }>('/users/update-credentials', {
        user_id: selectedUser.id,
        userId: selectedUser.id,
        full_name: editName.trim(),
        fullName: editName.trim(),
        phone: editPhone.trim() || null,
        email: editEmail.trim() || undefined,
      });
      if (response?.error) throw new Error(response.error);

      toast({ title: 'Profile updated', description: `${editName || 'User'}'s profile has been saved.` });
      setSelectedUser(null);
      // Refetch
      window.dispatchEvent(new Event('focus'));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string | null, email: string | null) =>
    (name || email || '?')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" /> All User Profiles
          </CardTitle>
          <CardDescription>Search and edit any user's profile details across the platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No users found.</p>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="space-y-1">
                {filtered.map((p) => {
                  const userRoles = getRolesForUser(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                      onClick={() => openEdit(p)}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                          {getInitials(p.full_name, p.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.full_name || 'Unnamed User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {userRoles.slice(0, 2).map((r) => (
                          <Badge key={r.id} variant={roleBadgeVariant(r.role)} className="text-[10px] px-1.5 py-0">
                            {roleLabels[r.role] || r.role}
                          </Badge>
                        ))}
                        {userRoles.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{userRoles.length - 2}</Badge>
                        )}
                      </div>
                      <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <p className="text-xs text-muted-foreground text-right">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Edit User Profile
            </DialogTitle>
            <DialogDescription>
              Editing profile for {selectedUser?.full_name || selectedUser?.email || 'user'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3 mb-2">
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedUser?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {getInitials(selectedUser?.full_name || null, selectedUser?.email || null)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedUser?.full_name || 'Unnamed'}</p>
                <div className="flex gap-1">
                  {selectedUser && getRolesForUser(selectedUser.id).map((r) => (
                    <Badge key={r.id} variant={roleBadgeVariant(r.role)} className="text-[10px]">
                      {roleLabels[r.role] || r.role}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="edit-email" className="pl-9" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email address" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="edit-phone" className="pl-9" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+1 234 567 890" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
