import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

/**
 * Fire-and-forget completion with a short "Undo" toast.
 * `complete` runs immediately; `undo` runs only if the user taps Undo.
 */
export function useUndoableComplete() {
  const { toast } = useToast();
  return (title: string, complete: () => void, undo: () => void) => {
    complete();
    toast({
      title: 'Marked complete',
      description: title.length > 60 ? `${title.slice(0, 60)}…` : title,
      action: (
        <ToastAction altText="Undo" onClick={undo}>
          Undo
        </ToastAction>
      ),
    });
  };
}