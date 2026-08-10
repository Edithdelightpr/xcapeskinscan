import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Save, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PhoneInput from '@/components/ui/PhoneInput';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OutreachSettings {
  address: string;
  instagram_handle: string;
  tiktok_handle: string;
  website_url: string;
  whatsapp_template_body: string;
  consultation_duration_minutes: number;
  business_whatsapp_number: string;
  whatsapp_client_initiated_body: string;
}

const DEFAULT_VARS = {
  name: 'Ada',
  consultation_link: 'https://tropicsmedspa.com/consult/example-token',
};

const renderTemplate = (body: string, vars: Record<string, string>) =>
  body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => vars[key] ?? `{{${key}}}`);

// Client-initiated template uses single-brace tags: {name}, {source}, {consultation_link}
const renderSingleBrace = (body: string, vars: Record<string, string>) =>
  body.replace(/\{\s*(\w+)\s*\}/g, (_m, key) => vars[key] ?? `{${key}}`);

/**
 * Admin → Outreach Messaging.
 * Edits the WhatsApp acknowledgement that goes out automatically when a lead
 * submits the public intake form. Supports merge tags: {{name}},
 * {{consultation_link}}, {{address}}, {{instagram}}, {{tiktok}}, {{website}}.
 */
const AdminOutreachSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OutreachSettings>({
    address: '',
    instagram_handle: '',
    tiktok_handle: '',
    website_url: '',
    whatsapp_template_body: '',
    consultation_duration_minutes: 20,
    business_whatsapp_number: '+2348037696910',
    whatsapp_client_initiated_body: '',
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => { select: (s: string) => { eq: (c: string, v: boolean) => { single: () => Promise<{ data: OutreachSettings | null; error: { message: string } | null }> } } };
      })
        .from('outreach_settings')
        .select('*')
        .eq('id', true)
        .single();
      if (data && !error) setForm(data);
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof OutreachSettings>(k: K, v: OutreachSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as unknown as {
        from: (t: string) => { update: (patch: Partial<OutreachSettings>) => { eq: (c: string, v: boolean) => Promise<{ error: { message: string } | null }> } };
      })
        .from('outreach_settings')
        .update(form)
        .eq('id', true);
      if (error) throw new Error(error.message);
      toast.success('Outreach messaging saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const preview = renderTemplate(form.whatsapp_template_body, {
    ...DEFAULT_VARS,
    address: form.address || '[your address]',
    instagram: form.instagram_handle.replace(/^@/, '') || 'tropicsmedspa',
    tiktok: form.tiktok_handle.replace(/^@/, '') || 'tropicsmedspa',
    website: form.website_url || 'tropicsmedspa.com',
  });

  const clientInitiatedPreview = renderSingleBrace(form.whatsapp_client_initiated_body, {
    name: 'Ada',
    source: 'one of your outreach team',
    consultation_link: 'https://tropicsmedspa.com/consult/example-token',
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <header>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/15">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Outreach Messaging</h1>
            <p className="text-sm text-muted-foreground">
              Configure the WhatsApp message every new lead receives after filling the intake form.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-xl p-5 space-y-4">
          <h2 className="font-display font-semibold">Contact info (auto-fills the message)</h2>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main St, Lagos" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ig">Instagram handle</Label>
              <Input id="ig" value={form.instagram_handle} onChange={(e) => set('instagram_handle', e.target.value)} placeholder="tropicsmedspa" />
            </div>
            <div>
              <Label htmlFor="tt">TikTok handle</Label>
              <Input id="tt" value={form.tiktok_handle} onChange={(e) => set('tiktok_handle', e.target.value)} placeholder="tropicsmedspa" />
            </div>
          </div>
          <div>
            <Label htmlFor="web">Website URL</Label>
            <Input id="web" value={form.website_url} onChange={(e) => set('website_url', e.target.value)} placeholder="https://tropicsmedspa.com" />
          </div>
          <div>
            <Label htmlFor="dur">Free consultation duration (minutes)</Label>
            <Input
              id="dur" type="number" min={5} max={120}
              value={form.consultation_duration_minutes}
              onChange={(e) => set('consultation_duration_minutes', Number(e.target.value) || 20)}
            />
          </div>

          <div className="border-t border-border/40 pt-4 space-y-3">
            <div>
              <Label htmlFor="biz_wa">Business WhatsApp number (clients message this)</Label>
              <PhoneInput
                id="biz_wa"
                value={form.business_whatsapp_number}
                onChange={(v) => set('business_whatsapp_number', v)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use international format with the + sign. After a lead submits the intake form, they'll
                see a "Tap to message us on WhatsApp" button that opens a chat to this number.
              </p>
            </div>

            <div>
              <Label htmlFor="ci_tpl">Client → business pre-filled message</Label>
              <Textarea
                id="ci_tpl"
                value={form.whatsapp_client_initiated_body}
                onChange={(e) => set('whatsapp_client_initiated_body', e.target.value)}
                rows={5}
                className="font-mono text-xs"
                placeholder="Hi Tropics MedSpa, I'm {name}..."
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Merge tags:{' '}
                <code className="bg-surface/40 px-1 rounded">{'{name}'}</code> (client's first name),{' '}
                <code className="bg-surface/40 px-1 rounded">{'{source}'}</code> (e.g. "one of your outreach team", "your social media"),{' '}
                <code className="bg-surface/40 px-1 rounded">{'{consultation_link}'}</code>
                <br />
                Tip: write it in the client's voice — this is the message they tap "Send" on, so it should feel like a friendly intro, not a form submission.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Label htmlFor="tpl">WhatsApp message template</Label>
            <Textarea
              id="tpl" value={form.whatsapp_template_body}
              onChange={(e) => set('whatsapp_template_body', e.target.value)}
              rows={10} className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Merge tags: <code className="bg-surface/40 px-1 rounded">{'{{name}}'}</code>,{' '}
              <code className="bg-surface/40 px-1 rounded">{'{{consultation_link}}'}</code>,{' '}
              <code className="bg-surface/40 px-1 rounded">{'{{address}}'}</code>,{' '}
              <code className="bg-surface/40 px-1 rounded">{'{{instagram}}'}</code>,{' '}
              <code className="bg-surface/40 px-1 rounded">{'{{tiktok}}'}</code>,{' '}
              <code className="bg-surface/40 px-1 rounded">{'{{website}}'}</code>
            </p>
          </div>

          <Button onClick={save} disabled={saving} className="w-full glow-primary">
            <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>

        <div className="glass rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display font-semibold">Live previews</h2>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">
              Client → business message (opens after intake)
            </div>
            <div className="rounded-2xl bg-emerald-50/5 border border-emerald-500/20 p-4">
              <div className="text-[10px] text-muted-foreground mb-2">
                WhatsApp · to {form.business_whatsapp_number || '[your number]'}
              </div>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground font-sans">
{clientInitiatedPreview}
              </pre>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">
              Business → client follow-up (manual or future API send)
            </div>
          <div className="rounded-2xl bg-emerald-50/5 border border-emerald-500/20 p-4">
            <div className="text-[10px] text-muted-foreground mb-2">WhatsApp · Tropics MedSpa</div>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground font-sans">
{preview}
            </pre>
          </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sent automatically via the WhatsApp Business API. If the API isn't configured yet,
            the system falls back to a wa.me click-to-send link logged for staff follow-up.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminOutreachSettings;