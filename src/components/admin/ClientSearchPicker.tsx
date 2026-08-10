import { useMemo, useState } from 'react';
import { Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useRealClients, type RealClient } from '@/hooks/useRealClients';

interface Props {
  value: string | null;
  onChange: (id: string, client: RealClient) => void;
  placeholder?: string;
}

/**
 * Reusable client picker — search by name, phone, email, or client code.
 * Used to ensure no duplicate clients are created when scheduling.
 */
const ClientSearchPicker = ({ value, onChange, placeholder = 'Search by name, phone, email, code…' }: Props) => {
  const { data: clients = [] } = useRealClients();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const selected = clients.find((c) => c.id === value) ?? null;

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients.slice(0, 8);
    return clients
      .filter((c) => {
        const hay = [c.full_name, c.phone, c.email, c.client_code, c.location]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 12);
  }, [clients, q]);

  return (
    <div className="relative">
      {selected && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left p-3 rounded-lg bg-surface border border-border/60 hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{selected.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {selected.client_code} · {selected.phone ?? selected.email ?? 'no contact'}
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-primary">Change</span>
          </div>
        </button>
      ) : (
        <>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="pl-9 bg-surface border-border/60"
            />
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm divide-y divide-border/20">
            {results.length === 0 && (
              <p className="text-xs text-muted-foreground p-4 text-center">No matching client.</p>
            )}
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.id, c); setOpen(false); setQ(''); }}
                className="w-full text-left p-3 hover:bg-surface/80 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.client_code} · {c.phone ?? '—'} · {c.email ?? '—'}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                    {c.membership_type}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ClientSearchPicker;