import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MENU_DISPLAY_OPTIONS,
  MENU_DISPLAY_HINT,
  normalizeMenuMode,
  type MenuDisplayMode,
} from '@/lib/menuDisplay';

interface Props {
  value: MenuDisplayMode | string | null | undefined;
  onChange: (v: MenuDisplayMode) => void;
}

const MenuDisplayModeSelect = ({ value, onChange }: Props) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Menu display style</Label>
    <Select value={normalizeMenuMode(value)} onValueChange={(v) => onChange(v as MenuDisplayMode)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {MENU_DISPLAY_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-[11px] text-muted-foreground">{MENU_DISPLAY_HINT}</p>
  </div>
);

export default MenuDisplayModeSelect;
