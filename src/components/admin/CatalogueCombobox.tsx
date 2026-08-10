import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface CatalogueOption {
  id: string;
  name: string;
  hint?: string | null;
}

interface Props {
  options: CatalogueOption[];
  placeholder?: string;
  emptyText?: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Searchable, scrollable catalogue picker used in the practitioner's
 * treatment-completion form. Backed by shadcn Command inside a Popover so
 * the entire active service / product catalogue is discoverable without
 * relying on a native <select>.
 */
const CatalogueCombobox = ({
  options,
  placeholder = 'Search catalogue…',
  emptyText = 'No matches',
  onSelect,
  disabled,
  className,
}: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full sm:w-64 h-9 justify-between font-normal', className)}
        >
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Search className="w-3.5 h-3.5" />
            {placeholder}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,380px)] p-0 z-[10000]" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.name} ${o.hint ?? ''}`}
                  onSelect={() => {
                    onSelect(o.id);
                    setOpen(false);
                  }}
                  className="flex items-start gap-2"
                >
                  <Check className="w-3.5 h-3.5 opacity-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{o.name}</p>
                    {o.hint && (
                      <p className="text-[10px] text-muted-foreground truncate">{o.hint}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CatalogueCombobox;