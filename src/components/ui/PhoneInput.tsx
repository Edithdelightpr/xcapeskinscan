import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COUNTRIES, DEFAULT_DIAL_CODE, splitE164, toE164 } from '@/lib/phone';

export interface PhoneInputProps {
  /** E.164 string, e.g. `+2348012345678`. Empty string = unset. */
  value: string;
  /** Called with normalised E.164 (or '' when cleared). */
  onChange: (e164: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoComplete?: string;
  defaultDial?: string;
}

/**
 * Country-code selector + national number field. Always emits E.164.
 * Defaults to Nigeria (+234). Strips a leading `0` automatically so users
 * can type local-format numbers and still get a clean international value.
 */
const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    {
      value,
      onChange,
      id,
      name,
      required,
      disabled,
      placeholder = '801 234 5678',
      className,
      inputClassName,
      autoComplete = 'tel',
      defaultDial = DEFAULT_DIAL_CODE,
    },
    ref,
  ) {
    const initial = React.useMemo(() => {
      const split = splitE164(value);
      return value
        ? split
        : { dial: defaultDial, national: '' };
    }, [value, defaultDial]);

    const [dial, setDial] = React.useState<string>(initial.dial);
    const [national, setNational] = React.useState<string>(initial.national);

    // Re-sync if parent resets value externally (e.g. form reset).
    React.useEffect(() => {
      const split = splitE164(value);
      if (!value) {
        setNational('');
        return;
      }
      if (split.dial !== dial) setDial(split.dial);
      if (split.national !== national) setNational(split.national);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const emit = (nextDial: string, nextNational: string) => {
      const e164 = toE164(nextDial, nextNational);
      onChange(e164);
    };

    const handleDial = (next: string) => {
      setDial(next);
      emit(next, national);
    };

    const handleNational = (raw: string) => {
      // Allow user to keep spaces/dashes while typing; normalisation happens on emit.
      const visible = raw.replace(/[^\d\s\-()+]/g, '');
      setNational(visible);
      emit(dial, visible);
    };

    return (
      <div className={cn('flex gap-2', className)}>
        <Select value={dial} onValueChange={handleDial} disabled={disabled}>
          <SelectTrigger
            className="w-[112px] shrink-0 bg-background border-input"
            aria-label="Country code"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.dial}>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden>{c.flag}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {c.dial}
                  </span>
                  <span className="hidden sm:inline text-xs">{c.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          ref={ref}
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={national}
          onChange={(e) => handleNational(e.target.value)}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
            'ring-offset-background placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            inputClassName,
          )}
        />
      </div>
    );
  },
);

export default PhoneInput;
