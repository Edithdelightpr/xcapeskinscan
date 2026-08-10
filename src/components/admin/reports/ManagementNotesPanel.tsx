import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trash2 } from 'lucide-react';
import { useReportNotes } from '@/hooks/useReportNotes';
import type { ReportRange } from '@/lib/reportRanges';
import { ReportSectionCard } from './ReportSectionCard';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import { toast } from 'sonner';

interface Props {
  range: ReportRange;
}

export const ManagementNotesPanel = ({ range }: Props) => {
  const { notes, add, remove } = useReportNotes(range);
  const { user } = useAuth();
  const { data: staff = [] } = useRealStaff();
  const [body, setBody] = useState('');

  const nameById = (id: string) =>
    staff.find((s: any) => s.id === id)?.full_name ?? 'Team member';

  const submit = async () => {
    if (!body.trim()) return;
    try {
      await add.mutateAsync(body.trim());
      setBody('');
      toast.success('Note added');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save note');
    }
  };

  return (
    <ReportSectionCard
      title="Management Notes"
      subtitle="Context and observations for this period. Notes do not change system metrics."
    >
      <div className="space-y-3 print:hidden">
        <Textarea
          placeholder="What happened, challenges, missing payments, next action…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        <Button size="sm" onClick={submit} disabled={!body.trim() || add.isPending}>
          {add.isPending ? 'Saving…' : 'Add note'}
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No notes yet for this period.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between gap-2 text-xs text-muted-foreground mb-1">
                <span>{nameById(n.author_user_id)} · {new Date(n.created_at).toLocaleString()}</span>
                {(user?.id === n.author_user_id) && (
                  <button
                    onClick={() => remove.mutate(n.id)}
                    className="hover:text-destructive print:hidden"
                    aria-label="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap">{n.body}</p>
            </div>
          ))
        )}
      </div>
    </ReportSectionCard>
  );
};