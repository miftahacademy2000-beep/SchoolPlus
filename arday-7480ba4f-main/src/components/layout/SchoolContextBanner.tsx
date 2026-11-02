import { Building2, X, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function SchoolContextBanner() {
  const { isSuperAdmin } = useAuth();
  const currentSchoolId = useAppStore((s) => s.currentSchoolId);
  const setCurrentSchoolId = useAppStore((s) => s.setCurrentSchoolId);

  const { data: school } = useQuery({
    queryKey: ['school-banner', currentSchoolId],
    queryFn: async () => {
      const response = await api.get<{ data: { name: string } }>(`/schools/${currentSchoolId}`);
      return response.data;
    },
    enabled: isSuperAdmin && !!currentSchoolId,
  });

  if (!isSuperAdmin || !currentSchoolId || !school) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 text-primary">
        <Eye className="h-4 w-4 flex-shrink-0" />
        <span>
          Viewing as <strong>{school.name}</strong>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
        onClick={() => setCurrentSchoolId(null)}
      >
        <X className="h-3 w-3" />
        Exit school view
      </Button>
    </div>
  );
}
