import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { TemplateStyles, TemplateBlock, FONT_FAMILIES, FONT_SIZES } from '@/types/invoiceTemplate';

interface TemplateStylesPanelProps {
  styles: TemplateStyles;
  selectedBlock: TemplateBlock | null;
  onStylesChange: (styles: TemplateStyles) => void;
  onBlockChange: (block: TemplateBlock) => void;
}

export function TemplateStylesPanel({
  styles,
  selectedBlock,
  onStylesChange,
  onBlockChange,
}: TemplateStylesPanelProps) {
  const handleColorChange = (key: keyof TemplateStyles, value: string) => {
    // Convert hex to HSL for storage
    const hsl = hexToHsl(value);
    onStylesChange({ ...styles, [key]: hsl });
  };

  const hslToHex = (hsl: string): string => {
    const match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
    if (!match) return '#3b82f6';
    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const hexToHsl = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '217 91% 60%';
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Block-specific settings */}
      {selectedBlock && (
        <>
          <div>
            <h4 className="font-medium mb-3 text-sm">Block Settings</h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Text Align</Label>
                <Select
                  value={selectedBlock.textAlign}
                  onValueChange={(value: 'left' | 'center' | 'right') =>
                    onBlockChange({ ...selectedBlock, textAlign: value })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Font Size</Label>
                <Select
                  value={selectedBlock.fontSize}
                  onValueChange={(value: TemplateBlock['fontSize']) =>
                    onBlockChange({ ...selectedBlock, fontSize: value })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Width (%)</Label>
                <Input
                  type="number"
                  min={10}
                  max={100}
                  value={selectedBlock.width}
                  onChange={(e) =>
                    onBlockChange({ ...selectedBlock, width: Math.max(10, Math.min(100, parseInt(e.target.value) || 50)) })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Global Styles */}
      <div>
        <h4 className="font-medium mb-3 text-sm">Colors</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs flex-1">Primary</Label>
            <Input
              type="color"
              value={hslToHex(styles.primaryColor)}
              onChange={(e) => handleColorChange('primaryColor', e.target.value)}
              className="h-8 w-12 p-1 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs flex-1">Secondary</Label>
            <Input
              type="color"
              value={hslToHex(styles.secondaryColor)}
              onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
              className="h-8 w-12 p-1 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs flex-1">Text</Label>
            <Input
              type="color"
              value={hslToHex(styles.textColor)}
              onChange={(e) => handleColorChange('textColor', e.target.value)}
              className="h-8 w-12 p-1 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs flex-1">Muted</Label>
            <Input
              type="color"
              value={hslToHex(styles.mutedColor)}
              onChange={(e) => handleColorChange('mutedColor', e.target.value)}
              className="h-8 w-12 p-1 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs flex-1">Background</Label>
            <Input
              type="color"
              value={hslToHex(styles.backgroundColor)}
              onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
              className="h-8 w-12 p-1 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-3 text-sm">Typography</h4>
        <div>
          <Label className="text-xs">Font Family</Label>
          <Select
            value={styles.fontFamily}
            onValueChange={(value: TemplateStyles['fontFamily']) =>
              onStylesChange({ ...styles, fontFamily: value })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-3 text-sm">Effects</h4>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Border Radius</Label>
            <Select
              value={styles.borderRadius}
              onValueChange={(value: TemplateStyles['borderRadius']) =>
                onStylesChange({ ...styles, borderRadius: value })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Border Width</Label>
            <Select
              value={styles.borderWidth}
              onValueChange={(value: TemplateStyles['borderWidth']) =>
                onStylesChange({ ...styles, borderWidth: value })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="thin">Thin</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="thick">Thick</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Shadow</Label>
            <Select
              value={styles.shadow}
              onValueChange={(value: TemplateStyles['shadow']) =>
                onStylesChange({ ...styles, shadow: value })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
