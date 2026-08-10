import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Truck } from 'lucide-react';
import { useProcurementSessions } from '@/hooks/useProcurement';
import ProcurementSessionEditor from './ProcurementSessionEditor';

const fmt = (n: number) =>
  '₦' + (n ?? 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });

const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (s) {
    case 'received': return 'default';
    case 'reconciled': return 'default';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
};

export default function AdminProcurement() {
  const { data: sessions = [], isLoading } = useProcurementSessions();
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const open = (id: string | null) => {
    setActiveId(id);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" /> Procurement
          </h1>
          <p className="text-sm text-muted-foreground">
            Record inventory intake. Cash → Inventory Asset (not operational spend).
          </p>
        </div>
        <Button onClick={() => open(null)}>
          <Plus className="h-4 w-4 mr-1" /> New procurement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Procurement sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No procurement sessions yet.</div>
          ) : (
            <div className="divide-y">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => open(s.id)}
                  className="w-full text-left p-3 hover:bg-muted/40 transition flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.supplier_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.procurement_date} · {fmt(s.total_procurement_cost)}
                    </div>
                  </div>
                  <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProcurementSessionEditor
        open={editorOpen}
        onOpenChange={(v) => { setEditorOpen(v); if (!v) setActiveId(null); }}
        sessionId={activeId}
      />
    </div>
  );
}