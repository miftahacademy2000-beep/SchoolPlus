import { useDrag } from 'react-dnd';
import { GripVertical, Image, Building2, Phone, User, FileText, DollarSign, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockType, BLOCK_LABELS } from '@/types/invoiceTemplate';

interface TemplateBlockItemProps {
  type: BlockType;
  isOnCanvas?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

const BLOCK_ICONS: Record<BlockType, React.ReactNode> = {
  logo: <Image className="h-4 w-4" />,
  school_name: <Building2 className="h-4 w-4" />,
  school_contact: <Phone className="h-4 w-4" />,
  student_info: <User className="h-4 w-4" />,
  invoice_details: <FileText className="h-4 w-4" />,
  amount: <DollarSign className="h-4 w-4" />,
  footer: <MessageSquare className="h-4 w-4" />,
};

export function TemplateBlockItem({ type, isOnCanvas, isSelected, onClick }: TemplateBlockItemProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'BLOCK',
    item: { type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  if (isOnCanvas) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-all',
          isSelected
            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
            : 'border-border bg-background hover:border-primary/50'
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        {BLOCK_ICONS[type]}
        <span className="text-sm font-medium">{BLOCK_LABELS[type]}</span>
      </div>
    );
  }

  return (
    <div
      ref={drag}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card cursor-grab transition-all hover:border-primary/50 hover:shadow-sm',
        isDragging && 'opacity-50'
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      {BLOCK_ICONS[type]}
      <span className="text-sm font-medium">{BLOCK_LABELS[type]}</span>
    </div>
  );
}
