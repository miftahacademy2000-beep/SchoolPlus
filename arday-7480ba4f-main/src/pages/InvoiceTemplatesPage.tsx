import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Star, Loader2, FileText } from 'lucide-react';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useInvoiceTemplates } from '@/hooks/useInvoiceTemplates';
import { InvoiceTemplateBuilder } from '@/components/invoices/InvoiceTemplateBuilder';
import { InvoiceTemplate, InvoiceTemplateLayout, DEFAULT_BLOCKS, DEFAULT_STYLES } from '@/types/invoiceTemplate';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function InvoiceTemplatesPage() {
  const { currentSchoolId } = useSchoolContext();
  const queryClient = useQueryClient();
  const { 
    templates, 
    isLoading, 
    createTemplate, 
    updateTemplate, 
    setDefaultTemplate, 
    deleteTemplate 
  } = useInvoiceTemplates(currentSchoolId);

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  // Fetch school data for preview
  const { data: schoolData } = useQuery({
    queryKey: ['school-data', currentSchoolId],
    queryFn: async () => {
      if (!currentSchoolId) return null;
      const { data } = await api.get<{ name: string; logo_url: string | null; address: string | null; phone: string | null; email: string | null }>(`/schools/${currentSchoolId}`);
      return data;
    },
    enabled: !!currentSchoolId,
  });

  // Handler to update school data when logo changes
  const handleSchoolDataUpdate = (updates: Partial<typeof schoolData>) => {
    queryClient.setQueryData(['school-data', currentSchoolId], (old: typeof schoolData) => ({
      ...old,
      ...updates,
    }));
    // Also invalidate to ensure we have fresh data
    queryClient.invalidateQueries({ queryKey: ['school-data', currentSchoolId] });
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setIsBuilderOpen(true);
  };

  const handleEdit = (template: InvoiceTemplate) => {
    setEditingTemplate(template);
    setIsBuilderOpen(true);
  };

  const handleSave = (name: string, layout: InvoiceTemplateLayout) => {
    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, name, layout }, {
        onSuccess: () => setIsBuilderOpen(false),
      });
    } else {
      createTemplate.mutate({ name, layout }, {
        onSuccess: () => setIsBuilderOpen(false),
      });
    }
  };

  const handleDelete = (templateId: string) => {
    setTemplateToDelete(templateId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (templateToDelete) {
      deleteTemplate.mutate(templateToDelete);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleSetDefault = (templateId: string) => {
    setDefaultTemplate.mutate(templateId);
  };

  if (!currentSchoolId) {
    return (
      <DashboardLayout>
        <PageHeader title="Invoice Templates" description="No school selected" />
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Please select a school to manage invoice templates.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader 
        title="Invoice Templates" 
        description="Design and customize your school's invoice layout"
      />
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-sm text-muted-foreground">
              Create custom templates to define how your invoices look when generated as PDFs.
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No templates yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first invoice template to customize how invoices appear.
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {template.name}
                        {template.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Default
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Updated {new Date(template.updated_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Mini preview */}
                  <div 
                    className="h-32 rounded border bg-muted/30 mb-4 flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: `hsl(${template.layout.styles.backgroundColor})` }}
                  >
                    <div className="text-center transform scale-50">
                      <div 
                        className="font-bold text-lg"
                        style={{ color: `hsl(${template.layout.styles.primaryColor})` }}
                      >
                        {schoolData?.name || 'School Name'}
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: `hsl(${template.layout.styles.mutedColor})` }}
                      >
                        Invoice Preview
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEdit(template)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    {!template.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(template.id)}
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Template Builder Dialog */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              Design your invoice template layout
            </DialogDescription>
          </DialogHeader>
          <InvoiceTemplateBuilder
            initialLayout={editingTemplate?.layout}
            templateName={editingTemplate?.name}
            onSave={handleSave}
            onCancel={() => setIsBuilderOpen(false)}
            schoolId={currentSchoolId ?? undefined}
            schoolData={schoolData ?? undefined}
            onSchoolDataUpdate={handleSchoolDataUpdate}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
