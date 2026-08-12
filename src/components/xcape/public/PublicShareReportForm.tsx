import { useState } from 'react';
import { Check, Copy, Loader2, MessageCircle, Send, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import PhoneInput from '@/components/ui/PhoneInput';
import { shareReport, type ShareReportResult } from '@/lib/publicAnalysisSession';

interface Props {
  token: string | null;
  /** Called once a link exists so the parent can persist it across renders. */
  onShared?: (result: ShareReportResult) => void;
}

/**
 * Contact gate for report delivery. The existing outreach workflow only
 * issues a Personal Report link once a name and mobile number are known, so
 * the same rule applies here. Nothing is sent until the visitor submits.
 */
const PublicShareReportForm = ({ token, onShared }: Props) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShareReportResult | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('This session is no longer available. Start a new analysis.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await shareReport({ token, fullName, phone, email, consent });
      setResult(res);
      onShared?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your report could not be prepared.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copying failed — long-press the link to copy it.');
    }
  };

  const nativeShare = async () => {
    if (!result) return;
    try {
      await navigator.share?.({ title: 'My XCAPE skin analysis', text: result.share_text, url: result.url });
    } catch {
      /* dismissed */
    }
  };

  if (result) {
    return (
      <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="text-sm font-medium text-emerald-200">Your report link is ready.</p>
        <p className="break-all rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">
          {result.url}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="min-h-[44px] bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            asChild
          >
            <a href={result.whatsapp_url} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
              Send on WhatsApp
            </a>
          </Button>
          <Button
            variant="outline"
            className="min-h-[44px] border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-slate-50"
            onClick={copy}
          >
            {copied ? <Check className="mr-2 h-4 w-4" aria-hidden /> : <Copy className="mr-2 h-4 w-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              variant="outline"
              className="min-h-[44px] border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-slate-50"
              onClick={nativeShare}
            >
              <Share2 className="mr-2 h-4 w-4" aria-hidden />
              Share
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs text-amber-300">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-100">Get your full report link</p>
        <p className="text-xs text-slate-400">
          We need your name and mobile number so the report can be sent to you and reviewed by a
          practitioner.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="share-name" className="text-xs text-slate-300">
          Full name
        </Label>
        <Input
          id="share-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
          placeholder="Ada Obi"
          className="min-h-[44px] border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="share-phone" className="text-xs text-slate-300">
          Mobile number
        </Label>
        <PhoneInput
          id="share-phone"
          value={phone}
          onChange={setPhone}
          required
          inputClassName="min-h-[44px] border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="share-email" className="text-xs text-slate-300">
          Email <span className="text-slate-500">(optional)</span>
        </Label>
        <Input
          id="share-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className="min-h-[44px] border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
        />
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-400">
        <Checkbox
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          className="mt-0.5 border-slate-600"
        />
        <span>I agree to be contacted by XCAPE about my skin analysis and recommendations.</span>
      </label>

      {error && (
        <p role="alert" className="text-xs text-amber-300">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={busy || !fullName.trim() || !phone}
        className="min-h-[44px] w-full bg-slate-100 text-slate-900 hover:bg-white"
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Send className="mr-2 h-4 w-4" aria-hidden />
        )}
        {busy ? 'Preparing your report…' : 'Send me my report'}
      </Button>
    </form>
  );
};

export default PublicShareReportForm;
