import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { useRealClients, type RealClient } from '@/hooks/useRealClients';
import { useCurrentClientId } from '@/hooks/useCurrentClientId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Crown, Star, History, UserPlus } from 'lucide-react';
import ClientFlowRouter from './intake/ClientFlowRouter';
import ClientCaptureForm from '@/components/intake/ClientCaptureForm';

const IntakeStage = () => {
  const { completeStage, setActiveStage } = useAppStore();
  const { data: clients = [], isLoading } = useRealClients();
  const [currentId, setCurrentId] = useCurrentClientId();

  const [showForm, setShowForm] = useState(false);
  const [prefillName, setPrefillName] = useState('');
  const [query, setQuery] = useState('');

  const selectedClient = useMemo<RealClient | null>(
    () => clients.find((c) => c.id === currentId) ?? null,
    [clients, currentId],
  );

  const results = useMemo<RealClient[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return clients
      .filter((c) => {
        const hay = [c.full_name, c.phone, c.email, c.client_code, c.location]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 8);
  }, [clients, query]);

  const tierIcon = (c: RealClient) => {
    if (c.membership_type === 'elite' || c.status === 'elite') return Crown;
    if (c.membership_type === 'member' || c.status === 'member') return Star;
    return History;
  };

  const tierLabel = (c: RealClient) => {
    if (c.membership_type === 'elite' || c.status === 'elite') return 'Elite';
    if (c.membership_type === 'member' || c.status === 'member') return 'Member';
    return 'Returning';
  };

  const handleCreated = (created: RealClient) => {
    setCurrentId(created.id);
    setShowForm(false);
    setPrefillName('');
    completeStage(0);
    setActiveStage(1);
  };

  const selectExisting = (id: string) => {
    setCurrentId(id);
    setQuery('');
  };

  return (
    <div className="animate-slide-up space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Client Intake</h2>
          <p className="text-muted-foreground text-sm mt-1">Search first — new clients fall back to full intake</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant="outline" size="sm">
          {showForm ? 'Cancel' : <><UserPlus className="w-4 h-4 mr-1.5" /> New Client Intake</>}
        </Button>
      </div>

      {/* If a returning client is selected, route them directly */}
      {selectedClient && !showForm && (
        <ClientFlowRouter
          client={selectedClient}
          onSwitchClient={() => setCurrentId(null)}
        />
      )}

      {/* Search-first identification */}
      {!selectedClient && !showForm && (
        <div className="glass rounded-xl p-5 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Find Existing Client</Label>
            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, phone, email, or client code…"
                className="pl-9 bg-surface border-border/60"
              />
            </div>
          </div>

          {query.trim() && (
            <div className="rounded-lg border border-border/40 bg-card/40 divide-y divide-border/20 max-h-72 overflow-y-auto">
              {results.length === 0 && (
                <div className="p-4 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">No matching client.</p>
                  <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setPrefillName(query); }}>
                    <UserPlus className="w-4 h-4 mr-1.5" /> Create "{query}" as new client
                  </Button>
                </div>
              )}
              {results.map((c) => {
                const Icon = tierIcon(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectExisting(c.id)}
                    className="w-full text-left p-3 hover:bg-surface/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.client_code} · {c.phone ?? '—'} · {c.email ?? '—'}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                        {tierLabel(c)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!query.trim() && (
            <p className="text-[11px] text-muted-foreground">
              Returning, member, and elite clients route to a fast continuity flow.
              If no match is found, use <span className="text-foreground">New Client Intake</span> for the full capture flow.
            </p>
          )}
        </div>
      )}

      {showForm && (
        <ClientCaptureForm
          mode="walk-in"
          initialFullName={prefillName}
          onCreated={handleCreated}
          onCancel={() => { setShowForm(false); setPrefillName(''); }}
          submitLabel="Save & Continue to Analysis"
        />
      )}

      {/* Recent clients — only when nothing selected and not creating */}
      {!selectedClient && !showForm && !query.trim() && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground px-1">Recent Clients</h3>
          {isLoading && <p className="text-sm text-muted-foreground">Loading clients from cloud…</p>}
          {!isLoading && clients.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No clients yet — start with New Client Intake.</p>
          )}
          <div className="grid gap-2">
            {clients.slice(0, 6).map((client) => {
              const Icon = tierIcon(client);
              return (
                <button
                  key={client.id}
                  onClick={() => selectExisting(client.id)}
                  className="glass rounded-xl p-4 text-left hover:border-primary/40 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {client.full_name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {client.client_code} · {client.phone ?? '—'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                      {tierLabel(client)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default IntakeStage;
