import { useState, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Save, RotateCcw, Trash2, Plus, Eye } from 'lucide-react';
import { TemplateBlockItem } from './TemplateBlockItem';
import { TemplateCanvas } from './TemplateCanvas';
import { TemplateStylesPanel } from './TemplateStylesPanel';
import { TemplateLogoUpload } from './TemplateLogoUpload';
import { generateTemplatedInvoicePdf } from '@/lib/generateTemplatedInvoicePdf';
import { 
  TemplateBlock, 
  TemplateStyles, 
  BlockType, 
  DEFAULT_BLOCKS, 
  DEFAULT_STYLES,
  BLOCK_LABELS,
  InvoiceTemplateLayout,
} from '@/types/invoiceTemplate';

interface InvoiceTemplateBuilderProps {
  initialLayout?: InvoiceTemplateLayout;
  templateName?: string;
  onSave: (name: string, layout: InvoiceTemplateLayout) => void;
  onCancel: () => void;
  schoolId?: string;
  schoolData?: {
    name: string;
    logo_url?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  onSchoolDataUpdate?: (updates: Partial<InvoiceTemplateBuilderProps['schoolData']>) => void;
}

const AVAILABLE_BLOCKS: BlockType[] = [
  'logo',
  'school_name',
  'school_contact',
  'student_info',
  'invoice_details',
  'amount',
  'footer',
];

export function InvoiceTemplateBuilder({
  initialLayout,
  templateName: initialName = 'New Template',
  onSave,
  onCancel,
  schoolId,
  schoolData,
  onSchoolDataUpdate,
}: InvoiceTemplateBuilderProps) {
  const [name, setName] = useState(initialName);
  const [blocks, setBlocks] = useState<TemplateBlock[]>(initialLayout?.blocks ?? DEFAULT_BLOCKS);
  const [styles, setStyles] = useState<TemplateStyles>(initialLayout?.styles ?? DEFAULT_STYLES);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(schoolData?.logo_url ?? null);

  const handleLogoUpdate = useCallback((newLogoUrl: string | null) => {
    setLocalLogoUrl(newLogoUrl);
    onSchoolDataUpdate?.({ logo_url: newLogoUrl });
  }, [onSchoolDataUpdate]);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;

  const handleAddBlock = useCallback((type: BlockType, x: number, y: number) => {
    const existingBlock = blocks.find((b) => b.type === type);
    if (existingBlock) {
      // Move existing block instead of adding duplicate
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === existingBlock.id ? { ...b, x, y } : b
        )
      );
      setSelectedBlockId(existingBlock.id);
      return;
    }

    const newBlock: TemplateBlock = {
      id: `${type}_${Date.now()}`,
      type,
      label: BLOCK_LABELS[type],
      x,
      y,
      width: type === 'logo' ? 30 : type === 'student_info' || type === 'invoice_details' ? 80 : 100,
      textAlign: type === 'logo' || type === 'school_name' || type === 'amount' || type === 'footer' ? 'center' : 'left',
      fontSize: type === 'school_name' ? '2xl' : type === 'amount' ? 'xl' : type === 'school_contact' || type === 'footer' ? 'sm' : 'md',
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, [blocks]);

  const handleMoveBlock = useCallback((id: string, x: number, y: number) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, x, y } : b))
    );
  }, []);

  const handleBlockChange = useCallback((updatedBlock: TemplateBlock) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === updatedBlock.id ? updatedBlock : b))
    );
  }, []);

  const handleDeleteBlock = useCallback(() => {
    if (!selectedBlockId) return;
    setBlocks((prev) => prev.filter((b) => b.id !== selectedBlockId));
    setSelectedBlockId(null);
  }, [selectedBlockId]);

  const handleReset = useCallback(() => {
    setBlocks(DEFAULT_BLOCKS);
    setStyles(DEFAULT_STYLES);
    setSelectedBlockId(null);
  }, []);

  const handleSave = () => {
    onSave(name, { blocks, styles });
  };

  const handlePreviewPdf = useCallback(() => {
    // Create sample invoice data for preview
    const sampleInvoice = {
      invoice_number: 'INV-PREVIEW',
      title: 'Sample Tuition Fee',
      description: 'This is a sample invoice preview',
      amount: 1500,
      status: 'pending',
      due_date: new Date().toISOString(),
      paid_date: null,
      created_at: new Date().toISOString(),
      student: {
        grade: '10th',
        enrollment_number: 'STU-001',
        class_name: 'Class 10',
        section: 'A',
        profile: {
          full_name: 'John Doe',
        },
      },
      school: schoolData ? {
        name: schoolData.name,
        email: schoolData.email || 'contact@school.edu',
        phone: schoolData.phone || '(555) 123-4567',
        address: schoolData.address || '123 School Street',
        logo_url: localLogoUrl,
      } : {
        name: 'Sample School',
        email: 'contact@school.edu',
        phone: '(555) 123-4567',
        address: '123 School Street',
        logo_url: null,
      },
    };

    generateTemplatedInvoicePdf(sampleInvoice, { blocks, styles });
  }, [blocks, styles, schoolData, localLogoUrl]);

  // Calculate which blocks are already on canvas
  const blocksOnCanvas = new Set(blocks.map((b) => b.type));

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="template-name" className="text-xs text-muted-foreground">
                Template Name
              </Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 w-48"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviewPdf}>
              <Eye className="h-4 w-4 mr-1" />
              Preview PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              Save Template
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Block Palette */}
          <div className="w-56 border-r bg-muted/30 flex flex-col">
            {/* Logo Upload Section */}
            {schoolId && (
              <TemplateLogoUpload
                currentLogoUrl={localLogoUrl}
                schoolId={schoolId}
                schoolName={schoolData?.name || 'School'}
                onLogoUpdate={handleLogoUpdate}
              />
            )}
            
            <div className="p-3 border-b">
              <h3 className="font-medium text-sm">Blocks</h3>
              <p className="text-xs text-muted-foreground">Drag to canvas</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {AVAILABLE_BLOCKS.map((type) => (
                  <div key={type} className="relative">
                    <TemplateBlockItem type={type} />
                    {blocksOnCanvas.has(type) && (
                      <div className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-[8px] text-primary-foreground">✓</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Center - Canvas */}
          <div className="flex-1 p-6 bg-muted/10 overflow-auto">
            <div className="max-w-2xl mx-auto">
              <TemplateCanvas
                blocks={blocks}
                styles={styles}
                selectedBlockId={selectedBlockId}
                onSelectBlock={setSelectedBlockId}
                onMoveBlock={handleMoveBlock}
                onAddBlock={handleAddBlock}
                schoolData={schoolData}
              />
            </div>
          </div>

          {/* Right Sidebar - Styles Panel */}
          <div className="w-64 border-l bg-muted/30 flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">Styling</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedBlock ? `Editing: ${selectedBlock.label}` : 'Select a block'}
                </p>
              </div>
              {selectedBlock && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={handleDeleteBlock}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3">
                <TemplateStylesPanel
                  styles={styles}
                  selectedBlock={selectedBlock}
                  onStylesChange={setStyles}
                  onBlockChange={handleBlockChange}
                />
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </DndProvider>
  );
}
