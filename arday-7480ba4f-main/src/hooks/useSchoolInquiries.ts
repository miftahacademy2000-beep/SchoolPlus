import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export type InquiryStatus = 'pending' | 'approved' | 'rejected';

export interface SchoolInquiry {
  id: string;
  school_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  message: string | null;
  status: InquiryStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useSchoolInquiries() {
  const queryClient = useQueryClient();

  const { data: inquiries = [], isLoading, error } = useQuery({
    queryKey: ['school-inquiries'],
    queryFn: async () => {
      const { data } = await api.get<SchoolInquiry[]>('/school-inquiries');
      return data || [];
    },
  });

  const submitInquiry = useMutation({
    mutationFn: async (data: {
      school_name: string;
      contact_name: string;
      email: string;
      phone?: string;
      address?: string;
      message?: string;
    }) => {
      await api.post('/school-inquiries', {
        school_name: data.school_name,
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone || null,
        address: data.address || null,
        message: data.message || null,
      });
    },
    onSuccess: () => {
      toast.success('Your inquiry has been submitted! We will contact you soon.');
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit inquiry: ${error.message}`);
    },
  });

  const updateInquiryStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      admin_notes,
    }: {
      id: string;
      status: InquiryStatus;
      admin_notes?: string;
    }) => {
      await api.put(`/school-inquiries/${id}`, {
        status,
        admin_notes: admin_notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-inquiries'] });
      toast.success('Inquiry status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update inquiry: ${error.message}`);
    },
  });

  const deleteInquiry = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/school-inquiries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-inquiries'] });
      toast.success('Inquiry deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete inquiry: ${error.message}`);
    },
  });

  return {
    inquiries,
    isLoading,
    error,
    submitInquiry,
    updateInquiryStatus,
    deleteInquiry,
  };
}
