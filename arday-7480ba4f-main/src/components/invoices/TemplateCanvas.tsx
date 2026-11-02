import { useRef, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { cn } from '@/lib/utils';
import { TemplateBlock, TemplateStyles, BlockType, BLOCK_LABELS } from '@/types/invoiceTemplate';

interface TemplateCanvasProps {
  blocks: TemplateBlock[];
  styles: TemplateStyles;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onMoveBlock: (id: string, x: number, y: number) => void;
  onAddBlock: (type: BlockType, x: number, y: number) => void;
  schoolData?: {
    name: string;
    logo_url?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

const FONT_FAMILY_MAP: Record<TemplateStyles['fontFamily'], string> = {
  inter: 'font-sans',
  roboto: 'font-sans',
  poppins: 'font-sans',
  playfair: 'font-serif',
  montserrat: 'font-sans',
};

const FONT_SIZE_MAP: Record<TemplateBlock['fontSize'], string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
  '2xl': 'text-xl',
};

const BORDER_RADIUS_MAP: Record<TemplateStyles['borderRadius'], string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
};

const SHADOW_MAP: Record<TemplateStyles['shadow'], string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

export function TemplateCanvas({
  blocks,
  styles,
  selectedBlockId,
  onSelectBlock,
  onMoveBlock,
  onAddBlock,
  schoolData,
}: TemplateCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ blockId: string; startX: number; startY: number; startBlockX: number; startBlockY: number } | null>(null);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'BLOCK',
    drop: (item: { type: BlockType }, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (offset && canvasRect) {
        const x = ((offset.x - canvasRect.left) / canvasRect.width) * 100;
        const y = offset.y - canvasRect.top;
        onAddBlock(item.type, Math.max(0, Math.min(100, x)), Math.max(0, y));
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const handleMouseDown = useCallback((e: React.MouseEvent, blockId: string, block: TemplateBlock) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectBlock(blockId);
    dragRef.current = {
      blockId,
      startX: e.clientX,
      startY: e.clientY,
      startBlockX: block.x,
      startBlockY: block.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const deltaX = ((moveEvent.clientX - dragRef.current.startX) / canvasRect.width) * 100;
      const deltaY = moveEvent.clientY - dragRef.current.startY;
      const newX = Math.max(0, Math.min(100 - block.width, dragRef.current.startBlockX + deltaX));
      const newY = Math.max(0, dragRef.current.startBlockY + deltaY);
      onMoveBlock(dragRef.current.blockId, newX, newY);
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onMoveBlock, onSelectBlock]);

  const renderBlockContent = (block: TemplateBlock) => {
    switch (block.type) {
      case 'logo':
        return schoolData?.logo_url ? (
          <img src={schoolData.logo_url} alt="School Logo" className="h-16 w-auto object-contain" />
        ) : (
          <div className="h-16 w-16 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
            Logo
          </div>
        );
      case 'school_name':
        return (
          <div className="font-bold" style={{ color: `hsl(${styles.primaryColor})` }}>
            {schoolData?.name || 'School Name'}
          </div>
        );
      case 'school_contact':
        return (
          <div className="space-y-0.5" style={{ color: `hsl(${styles.mutedColor})` }}>
            {schoolData?.address && <div>{schoolData.address}</div>}
            {schoolData?.phone && <div>Tel: {schoolData.phone}</div>}
            {schoolData?.email && <div>{schoolData.email}</div>}
            {!schoolData?.address && !schoolData?.phone && !schoolData?.email && (
              <div>123 School St • (555) 123-4567 • contact@school.edu</div>
            )}
          </div>
        );
      case 'student_info':
        return (
          <div className={BORDER_RADIUS_MAP[styles.borderRadius]} style={{ 
            padding: '12px', 
            backgroundColor: `hsl(${styles.secondaryColor})`,
          }}>
            <div className="font-semibold mb-1" style={{ color: `hsl(${styles.textColor})` }}>Bill To:</div>
            <div style={{ color: `hsl(${styles.textColor})` }}>John Doe</div>
            <div style={{ color: `hsl(${styles.mutedColor})` }}>Grade: 10th</div>
          </div>
        );
      case 'invoice_details':
        return (
          <div className={BORDER_RADIUS_MAP[styles.borderRadius]} style={{ 
            padding: '12px', 
            backgroundColor: `hsl(${styles.secondaryColor})`,
          }}>
            <div className="font-semibold mb-2" style={{ color: `hsl(${styles.textColor})` }}>Invoice Details:</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span style={{ color: `hsl(${styles.mutedColor})` }}>Title:</span>
                <span style={{ color: `hsl(${styles.textColor})` }}>Tuition Fee - Q1</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: `hsl(${styles.mutedColor})` }}>Due Date:</span>
                <span style={{ color: `hsl(${styles.textColor})` }}>Jan 15, 2025</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: `hsl(${styles.mutedColor})` }}>Status:</span>
                <span className="text-amber-600 font-medium">PENDING</span>
              </div>
            </div>
          </div>
        );
      case 'amount':
        return (
          <div>
            <div className="font-semibold mb-1" style={{ color: `hsl(${styles.textColor})` }}>Amount Due:</div>
            <div className="text-2xl font-bold" style={{ color: `hsl(${styles.primaryColor})` }}>$1,500.00</div>
          </div>
        );
      case 'footer':
        return (
          <div style={{ color: `hsl(${styles.mutedColor})` }}>
            Thank you! Please retain this invoice for your records.
          </div>
        );
      default:
        return <div>{BLOCK_LABELS[block.type]}</div>;
    }
  };

  return (
    <div
      ref={(node) => {
        drop(node);
        (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      onClick={() => onSelectBlock(null)}
      className={cn(
        'relative w-full min-h-[600px] border-2 border-dashed transition-colors',
        FONT_FAMILY_MAP[styles.fontFamily],
        SHADOW_MAP[styles.shadow],
        isOver ? 'border-primary bg-primary/5' : 'border-border'
      )}
      style={{ backgroundColor: `hsl(${styles.backgroundColor})` }}
    >
      {/* A4 aspect ratio guide lines */}
      <div className="absolute inset-4 border border-dashed border-muted pointer-events-none" />

      {blocks.map((block) => (
        <div
          key={block.id}
          onMouseDown={(e) => handleMouseDown(e, block.id, block)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectBlock(block.id);
          }}
          className={cn(
            'absolute cursor-move transition-all',
            FONT_SIZE_MAP[block.fontSize],
            selectedBlockId === block.id && 'ring-2 ring-primary ring-offset-2'
          )}
          style={{
            left: `${block.x}%`,
            top: `${block.y}px`,
            width: `${block.width}%`,
            textAlign: block.textAlign,
          }}
        >
          {renderBlockContent(block)}
        </div>
      ))}

      {blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">Drag blocks here</p>
            <p className="text-sm">Build your invoice template</p>
          </div>
        </div>
      )}
    </div>
  );
}
