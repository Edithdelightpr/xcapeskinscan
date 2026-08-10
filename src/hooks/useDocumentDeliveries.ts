import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DeliveryChannel =
  | 'whatsapp_business'
  | 'whatsapp_simulated'
  | 'email'
  | 'manual';
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'simulated';

export interface DocumentDelivery {
  id: string;
  client_id: string;
  media_id: string;
  phone_number: string | null;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  provider_reference: string | null;
  error_message: string | null;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any).from('document_deliveries');

const KEY = (clientId: string) => ['document-deliveries', clientId] as const;

/**
 * List all delivery attempts for a given client (newest first).
 */
export const useClientDeliveries = (clientId: string | undefined) =>
  useQuery({
    queryKey: clientId ? KEY(clientId) : ['document-deliveries', 'none'],
    enabled: !!clientId,
    queryFn: async (): Promise<DocumentDelivery[]> => {
      const { data, error } = await db()
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentDelivery[];
    },
  });

interface SendInput {
  clientId: string;
  mediaId: string;
  phoneNumber: string | null;
  /** Client email — when present, prefer real email delivery. */
  email?: string | null;
  /** Storage path of the PDF in the `client-media` bucket. Used to mint a signed URL. */
  storagePath?: string | null;
  /** Friendly client name for greeting. */
  clientName?: string | null;
  /** Scope label like "Current Visit" / "Progress Update". */
  reportLabel?: string | null;
  /** Snapshot version of this report. */
  reportVersion?: number | null;
  /** Practitioner name (optional, shown in the email signature line). */
  practitionerName?: string | null;
  /**
   * If `true`, treat as the official WhatsApp Business channel (currently
   * not wired to a real provider — falls back to simulated).
   */
  preferLiveChannel?: boolean;
  /**
   * Force a channel. Default behaviour: email if `email` present, else
   * simulated WhatsApp.
   */
  channel?: DeliveryChannel;
}

/**
 * Records a delivery attempt for a given client/PDF and (for now)
 * marks it as `simulated` since no live WhatsApp Business provider
 * is connected. When a provider is added later, replace the
 * simulated branch with the real fetch + status update.
 */
export const useSendDocumentDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendInput): Promise<DocumentDelivery> => {
      const {
        clientId, mediaId, phoneNumber, email, storagePath,
        clientName, reportLabel, reportVersion, practitionerName,
        preferLiveChannel, channel: forcedChannel,
      } = input;
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      // Decide channel
      const useEmail =
        forcedChannel === 'email' ||
        (!forcedChannel && !!email && email.trim().length > 3);

      // -------- EMAIL CHANNEL (real delivery) --------
      if (useEmail) {
        if (!email || email.trim().length < 3) {
          const { data: row, error } = await db()
            .insert({
              client_id: clientId,
              media_id: mediaId,
              phone_number: phoneNumber,
              channel: 'email',
              status: 'failed',
              error_message: 'Client has no email on file',
              sent_by: userId,
            })
            .select()
            .single();
          if (error) throw error;
          return row as DocumentDelivery;
        }

        // Mint a 7-day signed URL for the PDF
        let downloadUrl: string | null = null;
        if (storagePath) {
          const { data: signed, error: signErr } = await supabase.storage
            .from('client-media')
            .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
          if (signErr) {
            const { data: row, error } = await db()
              .insert({
                client_id: clientId,
                media_id: mediaId,
                phone_number: phoneNumber,
                channel: 'email',
                status: 'failed',
                error_message: `Could not prepare download link: ${signErr.message}`,
                sent_by: userId,
              })
              .select()
              .single();
            if (error) throw error;
            return row as DocumentDelivery;
          }
          downloadUrl = signed?.signedUrl ?? null;
        }

        try {
          const { data: fnRes, error: fnErr } = await supabase.functions.invoke(
            'send-transactional-email',
            {
              body: {
                templateName: 'client-report',
                recipientEmail: email,
                idempotencyKey: `client-report-${mediaId}`,
                templateData: {
                  clientName: clientName ?? undefined,
                  reportLabel: reportLabel ?? undefined,
                  reportVersion: reportVersion ?? undefined,
                  practitionerName: practitionerName ?? undefined,
                  downloadUrl: downloadUrl ?? undefined,
                  expiresInDays: 7,
                },
              },
            },
          );
          if (fnErr) throw fnErr;

          const { data: row, error: insErr } = await db()
            .insert({
              client_id: clientId,
              media_id: mediaId,
              phone_number: phoneNumber,
              channel: 'email',
              status: 'sent',
              provider_reference:
                (fnRes as { messageId?: string } | null)?.messageId ?? `email-${Date.now().toString(36)}`,
              sent_by: userId,
              sent_at: new Date().toISOString(),
            })
            .select()
            .single();
          if (insErr) throw insErr;
          return row as DocumentDelivery;
        } catch (sendErr) {
          const message = sendErr instanceof Error ? sendErr.message : 'Email send failed';
          const { data: row, error } = await db()
            .insert({
              client_id: clientId,
              media_id: mediaId,
              phone_number: phoneNumber,
              channel: 'email',
              status: 'failed',
              error_message: message,
              sent_by: userId,
            })
            .select()
            .single();
          if (error) throw error;
          return row as DocumentDelivery;
        }
      }

      // -------- WHATSAPP CHANNEL (no provider wired — simulated) --------
      if (!phoneNumber || phoneNumber.trim().length < 6) {
        const { data: row, error } = await db()
          .insert({
            client_id: clientId,
            media_id: mediaId,
            phone_number: phoneNumber,
            channel: preferLiveChannel ? 'whatsapp_business' : 'whatsapp_simulated',
            status: 'failed',
            error_message: 'No email on file and no valid phone number',
            sent_by: userId,
          })
          .select()
          .single();
        if (error) throw error;
        return row as DocumentDelivery;
      }

      const ch: DeliveryChannel = preferLiveChannel
        ? 'whatsapp_business'
        : 'whatsapp_simulated';
      const status: DeliveryStatus = preferLiveChannel ? 'pending' : 'simulated';
      const providerRef = `sim-${Date.now().toString(36)}`;

      const { data: row, error } = await db()
        .insert({
          client_id: clientId,
          media_id: mediaId,
          phone_number: phoneNumber,
          channel: ch,
          status,
          provider_reference: providerRef,
          sent_by: userId,
          sent_at: status === 'simulated' ? new Date().toISOString() : null,
        })
        .select()
        .single();
      if (error) throw error;
      return row as DocumentDelivery;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY(vars.clientId) });
    },
  });
};
