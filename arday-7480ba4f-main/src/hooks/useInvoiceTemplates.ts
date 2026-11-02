import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { InvoiceTemplate, InvoiceTemplateLayout, DEFAULT_BLOCKS, DEFAULT_STYLES } from '@/types/invoiceTemplate';

interface RawTemplateRow {
  id: string;
  school_id: string;
  name: string;
  is_default: boolean;
  layout: unknown;
  created_at: string;
  updated_at: string;
}

function parseLayout(layout: unknown): InvoiceTemplateLayout {
  if (typeof layout === 'object' && layout !== null) {
    const obj = layout as Record<string, unknown>;
    return {
      blocks: Array.isArray(obj.blocks) ? obj.blocks : DEFAULT_BLOCKS,
      styles: typeof obj.styles === 'object' && obj.styles !== null
        ? { ...DEFAULT_STYLES, ...(obj.styles as object) }
        : DEFAULT_STYLES,
    };
  }
  return { blocks: DEFAULT_BLOCKS, styles: DEFAULT_STYLES };
}

export function useInvoiceTemplates(schoolId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['invoice-templates', schoolId],
    queryFn: async (): Promise<InvoiceTemplate[]> => {
      if (!schoolId) return [];
      const params = new URLSearchParams({ school_id: schoolId });
      const { data } = await api.get<RawTemplateRow[]>(`/invoices/templates?${params.toString()}`);
      return (data || []).map(row => ({
        ...row,
        layout: parseLayout(row.layout),
      }));
    },
    enabled: !!schoolId,
  });

  const createTemplate = useMutation({
    mutationFn: async ({ name, layout }: { name: string; layout: InvoiceTemplateLayout }) => {
      if (!schoolId) throw new Error('No school selected');
      const { data } = await api.post<InvoiceTemplate>('/invoices/templates', {
        school_id: schoolId,
        name,
        layout: JSON.parse(JSON.stringify(layout)),
        is_default: false,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates', schoolId] });
      toast({ title: 'Template created', description: 'Your invoice template has been saved.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, name, layout }: { id: string; name: string; layout: InvoiceTemplateLayout }) => {
      const { data } = await api.put<InvoiceTemplate>(`/invoices/templates/${id}`, {
        name,
        layout: JSON.parse(JSON.stringify(layout)),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates', schoolId] });
      toast({ title: 'Template updated', description: 'Your changes have been saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update template.', variant: 'destructive' });
    },
  });

  const setDefaultTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!schoolId) throw new Error('No school selected');
      const { data } = await api.put<InvoiceTemplate>(`/invoices/templates/${templateId}/default`, {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates', schoolId] });
      toast({ title: 'Default template set', description: 'This template will be used for new invoices.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to set default template.', variant: 'destructive' });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      await api.delete(`/invoices/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates', schoolId] });
      toast({ title: 'Template deleted', description: 'The template has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete template.', variant: 'destructive' });
    },
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createTemplate,
    updateTemplate,
    setDefaultTemplate,
    deleteTemplate,
  };
}
