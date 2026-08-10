import { useState } from 'react';
import { Settings2, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { toast } from 'sonner';
import SequenceTreatmentPlanDialog from './SequenceTreatmentPlanDialog';
import { useClientOpenPlans } from '@/hooks/usePaymentClaims';

interface Props {
  clientId: string;
  clientName?: string;
  /**
   * Called when the client has no active plan and the user clicks the button.
   * Parent decides whether to open the assessment flow, jump to a tab, etc.
   * If omitted, a toast is shown instructing the user to create a plan first.
   */
  onNoPlan?: () => void;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  className?: string;
  label?: string;
}

/**
 * Always-accessible entry point to open the focused plan-management modal
 * (`SequenceTreatmentPlanDialog`) for a client's active treatment plan —
 * without going through the full skin analysis or Start Treatment flow.
 *
 * Reuses the existing plan-sequencing dialog, hooks and RPCs so completed
 * sessions, financial allocations and plan history stay canonical.
 */
const CustomizeTreatmentPlanButton = ({
  clientId,
  clientName,
  onNoPlan,
  size = 'sm',
  variant = 'outline',
  className,
  label = 'Customize Treatment Plan',
}: Props) => {
  const { data: plans = [], isLoading } = useClientOpenPlans(clientId);
  const [open, setOpen] = useState(false);

  const activePlan = plans.find((p) => p.status === 'active') ?? plans[0] ?? null;

  const handleClick = () => {
    if (!activePlan) {
      if (onNoPlan) {
        onNoPlan();
      } else {
        toast.info('Create treatment plan first', {
          description: clientName
            ? `${clientName} has no active plan. Run an assessment and accept recommendations to create one.`
            : 'This client has no active plan. Run an assessment and accept recommendations to create one.',
        });
      }
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={className}
        onClick={handleClick}
        disabled={isLoading}
        title="Adjust remaining sessions and pre-schedule future appointments"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <Settings2 className="w-4 h-4 mr-1.5" />
        )}
        {label}
      </Button>

      {activePlan && open && (
        <SequenceTreatmentPlanDialog
          open={open}
          onClose={() => setOpen(false)}
          planId={activePlan.id}
          title="Customize Treatment Plan"
          description="Adjust the client's remaining journey and schedule future appointments. Completed treatments and payments stay protected."
          saveLabel="Save Plan & Schedule"
        />
      )}
    </>
  );
};

export default CustomizeTreatmentPlanButton;