import { useMemo, useState } from 'react';
import {
  Plus,
  FootprintsIcon,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  ClipboardList,
  FileText,
  LogIn,
  Share2,
  Copy,
  MessageCircle,
  Send,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AppointmentModal from '@/components/admin/AppointmentModal';
import CustomizeTreatmentPlanButton from '@/components/admin/CustomizeTreatmentPlanButton';
import { useSignInClient, type VisitReason } from '@/hooks/useClientVisits';
import { useAuth } from '@/hooks/useAuth';
import { useRealStaff } from '@/hooks/useRealStaff';
import { openWhatsApp } from '@/lib/whatsapp';
import { toast } from 'sonner';
import type { RealClient } from '@/hooks/useRealClients';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  client: RealClient;
  onJumpTab: (tab: 'media' | 'assessments' | 'notes' | 'bookings' | 'visits') => void;
}

/**
 * Quick-action strip on the client profile so staff can record visits,
 * upload photos, etc., WITHOUT restarting the new-client intake flow.
 */
const ClientQuickActions = ({ client, onJumpTab }: Props) => {
  const [modal, setModal] = useState<null | 'walkin' | 'schedule'>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { user } = useAuth();
  const signIn = useSignInClient();
  const { data: staff = [] } = useRealStaff();

  // Build the public booking URL. When the client is attributed to a staff member with a slug,
  // route through that slug so the new lead inherits the same attribution (referral tracking).
  const shareUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const attributed = staff.find((s) => s.id === client.attributed_staff_id);
    const slug = attributed?.booking_slug?.trim();
    return slug ? `${origin}/schedule/${slug}` : `${origin}/schedule`;
  }, [staff, client.attributed_staff_id]);

  const shareMessage = `Hi! Book your Tropics MedSpa appointment here: ${shareUrl}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleQuickSignIn = async () => {
    try {
      await signIn.mutateAsync({
        client_id: client.id,
        logged_by_staff_id: user?.id ?? null,
        reason_for_visit: 'walk_in_enquiry' as VisitReason,
        request_id: (crypto as Crypto).randomUUID(),
      });
      toast.success('Signed in — see Visits tab');
      onJumpTab('visits');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign in');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — please copy manually');
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: 'Tropics MedSpa booking',
        text: shareMessage,
        url: shareUrl,
      });
    } catch {
      // user dismissed — no toast needed
    }
  };

  const handleGeneratePortalLink = async () => {
    setPortalOpen(true);
    if (portalUrl) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-portal-link', {
        body: { client_id: client.id },
      });
      if (error || data?.error) {
        const msg = data?.message ?? data?.error ?? (error as { message?: string })?.message ?? 'Could not generate link';
        if (data?.error === 'NO_APPOINTMENT') {
          toast.error('Book an appointment for this client first — portal links are tied to a booking.');
        } else {
          toast.error(msg);
        }
        setPortalOpen(false);
        return;
      }
      setPortalUrl(data.url as string);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate link');
      setPortalOpen(false);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCopyPortal = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success('Portal link copied');
    } catch {
      toast.error('Could not copy — please copy manually');
    }
  };

  const portalMessage = portalUrl
    ? `Hi ${client.full_name?.split(' ')[0] ?? ''}! Here's your private Tropics MedSpa account — view your bookings, photos, benefits and reports anytime: ${portalUrl}`
    : '';

  return (
    <>
      <div className="glass rounded-xl p-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={handleQuickSignIn} disabled={signIn.isPending} className="glow-primary">
          <LogIn className="w-4 h-4 mr-1.5" /> Sign In Now
        </Button>
        <Button size="sm" variant="outline" onClick={() => setModal('walkin')}>
          <FootprintsIcon className="w-4 h-4 mr-1.5" /> Record Walk-In
        </Button>
        <Button size="sm" variant="outline" onClick={() => setModal('schedule')}>
          <CalendarIcon className="w-4 h-4 mr-1.5" /> Schedule Visit
        </Button>
        <Button size="sm" variant="outline" onClick={() => onJumpTab('media')}>
          <ImageIcon className="w-4 h-4 mr-1.5" /> Upload Photos
        </Button>
        <Button size="sm" variant="outline" onClick={() => onJumpTab('assessments')}>
          <ClipboardList className="w-4 h-4 mr-1.5" /> New Assessment
        </Button>
        <Button size="sm" variant="outline" onClick={() => onJumpTab('notes')}>
          <FileText className="w-4 h-4 mr-1.5" /> Add Note
        </Button>
        <Button size="sm" variant="outline" onClick={() => onJumpTab('bookings')}>
          <Plus className="w-4 h-4 mr-1.5" /> All Bookings
        </Button>
        <CustomizeTreatmentPlanButton
          clientId={client.id}
          clientName={client.full_name}
          onNoPlan={() => onJumpTab('assessments')}
        />
        <Button size="sm" onClick={() => setShareOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Share2 className="w-4 h-4 mr-1.5" /> Share Intake Link
        </Button>
        <Button size="sm" onClick={handleGeneratePortalLink} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <KeyRound className="w-4 h-4 mr-1.5" /> Send Portal Link
        </Button>
      </div>

      <AppointmentModal
        open={modal === 'walkin'}
        onClose={() => setModal(null)}
        defaultClient={client}
        isWalkIn
      />
      <AppointmentModal
        open={modal === 'schedule'}
        onClose={() => setModal(null)}
        defaultClient={client}
      />

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-accent" /> Share Intake Link
            </DialogTitle>
            <DialogDescription>
              Send this to anyone who wants to book an appointment. They'll fill in their own details and pick a time — no account needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Public booking link
              </label>
              <Input value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} className="mt-1.5 font-mono text-xs" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-1.5" /> Copy link
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openWhatsApp(client.phone ?? '', shareMessage)}
              >
                <MessageCircle className="w-4 h-4 mr-1.5" /> Send via WhatsApp
              </Button>
              {canNativeShare && (
                <Button size="sm" variant="outline" onClick={handleNativeShare}>
                  <Send className="w-4 h-4 mr-1.5" /> More…
                </Button>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              New leads who book through this link are automatically created in your client list and tagged as <span className="font-medium">self-booked</span>.
              {client.attributed_staff_id ? ' Attribution is preserved for referral tracking.' : ''}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Portal link dialog */}
      <Dialog open={portalOpen} onOpenChange={(v) => { setPortalOpen(v); if (!v) setPortalUrl(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" /> Client Portal Link
            </DialogTitle>
            <DialogDescription>
              Send this private link to {client.full_name}. It opens their personal portal — bookings, photos, benefits and downloadable reports — for the next 90 days.
            </DialogDescription>
          </DialogHeader>

          {portalLoading || !portalUrl ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Generating secure link…
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Personal portal URL
                </label>
                <Input value={portalUrl} readOnly onFocus={(e) => e.currentTarget.select()} className="mt-1.5 font-mono text-xs" />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleCopyPortal}>
                  <Copy className="w-4 h-4 mr-1.5" /> Copy link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openWhatsApp(client.phone ?? '', portalMessage)}
                  disabled={!client.phone}
                >
                  <MessageCircle className="w-4 h-4 mr-1.5" /> Send via WhatsApp
                </Button>
                {canNativeShare && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.share({
                          title: 'Your Tropics MedSpa portal',
                          text: portalMessage,
                          url: portalUrl,
                        });
                      } catch { /* dismissed */ }
                    }}
                  >
                    <Send className="w-4 h-4 mr-1.5" /> More…
                  </Button>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                The link is single-client. Anyone with the URL can see this client's bookings & photos, so share with care.
                Generate a fresh link any time — old ones stay valid until they expire.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientQuickActions;