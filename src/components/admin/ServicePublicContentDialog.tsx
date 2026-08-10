import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Globe, ExternalLink, Youtube, Video as VideoIcon, Image as ImageIcon,
  ArrowUp, ArrowDown, Trash2, Upload, Loader2, Copy, Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useServices, type ServiceRow } from '@/hooks/useServices';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ServiceImageUploader from './ServiceImageUploader';
import ServiceVideoUploader from './ServiceVideoUploader';
import { parseYouTubeId, toYouTubeThumb } from '@/lib/youtube';
import { supabase } from '@/integrations/supabase/client';

interface Props { service: ServiceRow | null; onClose: () => void; }

type PriceMode = 'catalogue' | 'from' | 'on_consultation';

/**
 * Full public-media + public-content editor for one treatment.
 * All media fields are optional and empty-safe — nothing is fabricated for
 * treatments that have no admin-uploaded assets.
 */
const ServicePublicContentDialog = ({ service, onClose }: Props) => {
  const qc = useQueryClient();
  const updatePublic = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from('services' as never)
        .update(patch as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { data: allServices = [] } = useServices();
  const siblingIndividuals = allServices.filter(
    (s) =>
      s.id !== service?.id &&
      (s.party_type ?? 'individual') === 'individual' &&
      (service?.family_id ? s.family_id === service.family_id : s.category_id === service?.category_id),
  );
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryUrlDraft, setGalleryUrlDraft] = useState('');

  const [form, setForm] = useState({
    public_visible: true,
    featured: false,
    public_slug: '',
    public_summary: '',
    public_option_label: '',
    party_type: 'individual' as 'individual' | 'couple',
    base_service_id: '' as string,
    long_description: '',

    // Cover (card / thumbnail) — persists on services.image_url
    image_url: null as string | null,
    image_format: null as string | null,
    image_aspect: null as string | null,

    // Hero — services.hero_image_url. When useCoverAsHero is on we save null and
    // the public pages fall back to image_url automatically.
    useCoverAsHero: true,
    hero_image_url: '' as string,

    // Video / YouTube — reuse existing service fields
    youtube_url: '' as string,
    promo_video_url: null as string | null,
    promo_video_duration_seconds: null as number | null,

    price_display_mode: 'catalogue' as PriceMode,
    benefits: '',
    suitable_for: '',
    preparation: '',
    aftercare: '',
    faq: '',
    what_to_expect: '',
    gallery: [] as string[],
  });

  useEffect(() => {
    if (!service) return;
    setForm({
      public_visible: service.public_visible ?? true,
      featured: service.featured ?? false,
      public_slug: service.public_slug ?? '',
      public_summary: service.public_summary ?? '',
      public_option_label: service.public_option_label ?? '',
      party_type: (service.party_type ?? 'individual') as 'individual' | 'couple',
      base_service_id: service.base_service_id ?? '',
      long_description: service.long_description ?? '',
      image_url: service.image_url ?? null,
      image_format: service.image_format ?? null,
      image_aspect: service.image_aspect ?? null,
      useCoverAsHero: !service.hero_image_url,
      hero_image_url: service.hero_image_url ?? '',
      youtube_url: service.youtube_url ?? '',
      promo_video_url: service.promo_video_url ?? null,
      promo_video_duration_seconds: service.promo_video_duration_seconds ?? null,
      price_display_mode: (service.price_display_mode ?? 'catalogue') as PriceMode,
      benefits: (service.benefits ?? []).join('\n'),
      suitable_for: (service.suitable_for ?? []).join('\n'),
      preparation: service.preparation ?? '',
      aftercare: service.aftercare ?? '',
      faq: JSON.stringify(service.faq ?? [], null, 2),
      what_to_expect: service.what_to_expect ?? '',
      gallery: (service.gallery_urls ?? []) as string[],
    });
    setGalleryUrlDraft('');
  }, [service]);

  const youtubeThumb = useMemo(() => toYouTubeThumb(form.youtube_url), [form.youtube_url]);
  const youtubeInvalid = form.youtube_url.trim().length > 0 && !parseYouTubeId(form.youtube_url);

  // Live preview map — surfaced back to the admin.
  const cardMedia = form.image_url ?? (form.useCoverAsHero ? null : (form.hero_image_url || null));
  const heroMedia = form.useCoverAsHero
    ? form.image_url
    : (form.hero_image_url || form.image_url);
  const detailVideo = form.youtube_url && !youtubeInvalid ? 'YouTube' : form.promo_video_url ? 'Uploaded video' : null;

  if (!service) return null;

  const toLines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);

  const moveGallery = (idx: number, dir: -1 | 1) => {
    setForm((f) => {
      const next = [...f.gallery];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return f;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...f, gallery: next };
    });
  };
  const removeGallery = (idx: number) =>
    setForm((f) => ({ ...f, gallery: f.gallery.filter((_, i) => i !== idx) }));

  const addGalleryUrl = () => {
    const url = galleryUrlDraft.trim();
    if (!url) return;
    if (form.gallery.includes(url)) { toast.error('That image is already in the gallery.'); return; }
    setForm((f) => ({ ...f, gallery: [...f.gallery, url] }));
    setGalleryUrlDraft('');
  };

  const handleGalleryFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setGalleryBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) { toast.error(`Skipped ${file.name}: not an image.`); continue; }
        if (file.size > 10 * 1024 * 1024) { toast.error(`Skipped ${file.name}: over 10 MB.`); continue; }
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `gallery/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('service-images')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) { toast.error(`Upload failed for ${file.name}: ${upErr.message}`); continue; }
        const { data } = supabase.storage.from('service-images').getPublicUrl(path);
        if (!form.gallery.includes(data.publicUrl) && !uploaded.includes(data.publicUrl)) {
          uploaded.push(data.publicUrl);
        }
      }
      if (uploaded.length > 0) {
        setForm((f) => ({ ...f, gallery: [...f.gallery, ...uploaded] }));
        toast.success(`Added ${uploaded.length} gallery image${uploaded.length > 1 ? 's' : ''}`);
      }
    } finally {
      setGalleryBusy(false);
    }
  };

  const save = async () => {
    let faq: Array<{ q: string; a: string }> = [];
    if (form.faq.trim()) {
      try {
        const parsed = JSON.parse(form.faq);
        if (!Array.isArray(parsed)) throw new Error('FAQ must be an array');
        faq = parsed;
      } catch (e) {
        toast.error(`FAQ JSON invalid: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }
    let normalizedYoutube: string | null = null;
    if (form.youtube_url.trim()) {
      const id = parseYouTubeId(form.youtube_url);
      if (!id) { toast.error('Enter a valid YouTube URL, or clear the field.'); return; }
      normalizedYoutube = `https://www.youtube.com/watch?v=${id}`;
    }
    try {
      await updatePublic.mutateAsync({
        id: service.id,
        patch: {
        public_visible: form.public_visible,
        featured: form.featured,
        public_slug: form.public_slug.trim() || null,
        public_summary: form.public_summary.trim() || null,
        public_option_label: form.public_option_label.trim() || null,
        party_type: form.party_type,
        base_service_id: form.party_type === 'couple' ? (form.base_service_id || null) : null,
        long_description: form.long_description.trim() || null,
        image_url: form.image_url,
        image_format: form.image_format,
        image_aspect: form.image_aspect,
        hero_image_url: form.useCoverAsHero ? null : (form.hero_image_url.trim() || null),
        youtube_url: normalizedYoutube,
        promo_video_url: form.promo_video_url,
        promo_video_duration_seconds: form.promo_video_duration_seconds,
        price_display_mode: form.price_display_mode,
        benefits: toLines(form.benefits),
        suitable_for: toLines(form.suitable_for),
        preparation: form.preparation.trim() || null,
        aftercare: form.aftercare.trim() || null,
        faq,
        what_to_expect: form.what_to_expect.trim() || null,
        gallery_urls: form.gallery,
        },
      });
      toast.success('Public content saved');
      onClose();
    } catch (e) {
      const err = e as { message?: string; details?: string; hint?: string; code?: string };
      const parts = [err?.message, err?.details, err?.hint, err?.code ? `(code ${err.code})` : null].filter(Boolean);
      toast.error(parts.length ? parts.join(' — ') : 'Failed to save');
      // eslint-disable-next-line no-console
      console.error('[ServicePublicContentDialog] save failed:', e);
    }
  };

  const publicPath = form.public_slug.trim() ? `/treatments/${form.public_slug.trim()}` : null;
  const copyPublicLink = async () => {
    if (!publicPath) { toast.error('Set a URL slug first.'); return; }
    const url = `${window.location.origin}${publicPath}`;
    await navigator.clipboard.writeText(url);
    toast.success('Public link copied');
  };

  return (
    <Dialog open={!!service} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-bronze" /> Public page — {service.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4 md:gap-6 rounded-lg border border-border/40 bg-surface/40 p-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.public_visible} onCheckedChange={(v) => setForm((f) => ({ ...f, public_visible: v }))} />
              Show on public site
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.featured} onCheckedChange={(v) => setForm((f) => ({ ...f, featured: v }))} />
              Feature on landing
            </label>
            <div className="flex items-center gap-3 ml-auto">
              {publicPath && (
                <>
                  <button type="button" onClick={copyPublicLink} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <Copy className="w-3.5 h-3.5" /> Copy link
                  </button>
                  <Link to={publicPath} target="_blank" className="text-sm text-bronze inline-flex items-center gap-1 hover:underline">
                    Preview <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-bronze" />
              <h3 className="text-sm uppercase tracking-wider font-semibold text-foreground">Public media</h3>
            </div>

            <div className="rounded-lg border border-border/40 bg-surface/30 p-3 text-xs text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground mb-1">Where each asset appears</p>
              <ul className="space-y-0.5">
                <li>• <span className="text-foreground/90">Card / thumbnail</span> (landing + category): {cardMedia ? <span className="text-bronze">Cover image</span> : <span className="text-amber-400">Branded fallback (no image uploaded)</span>}</li>
                <li>• <span className="text-foreground/90">Detail-page hero</span>: {heroMedia ? <span className="text-bronze">{form.useCoverAsHero ? 'Cover image' : 'Separate hero image'}</span> : <span className="text-amber-400">Branded fallback</span>}</li>
                <li>• <span className="text-foreground/90">Detail-page video</span>: {detailVideo ? <span className="text-bronze">{detailVideo}</span> : <span className="text-muted-foreground">None</span>}</li>
                <li>• <span className="text-foreground/90">Gallery</span>: {form.gallery.length > 0 ? <span className="text-bronze">{form.gallery.length} image{form.gallery.length > 1 ? 's' : ''}</span> : <span className="text-muted-foreground">Hidden until at least one is added</span>}</li>
              </ul>
            </div>

            <div className="space-y-2 rounded-xl border border-border/40 p-4 bg-surface/30">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                <Label className="text-sm">Cover / card image</Label>
              </div>
              <p className="text-[11px] text-muted-foreground">Shown on the treatments landing card and in the category grid.</p>
              <ServiceImageUploader
                value={form.image_url}
                onChange={({ url, format, aspect }) =>
                  setForm((f) => ({ ...f, image_url: url, image_format: format, image_aspect: aspect }))
                }
              />
            </div>

            <div className="space-y-3 rounded-xl border border-border/40 p-4 bg-surface/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-accent" />
                  <Label className="text-sm">Detail-page hero</Label>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Reuse cover image
                  <Switch
                    checked={form.useCoverAsHero}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, useCoverAsHero: v }))}
                  />
                </label>
              </div>
              {form.useCoverAsHero ? (
                <p className="text-[11px] text-muted-foreground">
                  The detail-page hero uses the cover image. Turn the switch off to upload a different one.
                </p>
              ) : (
                <>
                  <ServiceImageUploader
                    value={form.hero_image_url || null}
                    onChange={({ url }) => setForm((f) => ({ ...f, hero_image_url: url ?? '' }))}
                  />
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Or paste a hero image URL (fallback)</Label>
                    <Input
                      value={form.hero_image_url}
                      onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })}
                      placeholder="https://…"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-border/40 p-4 bg-surface/30">
              <div className="flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-400" />
                <Label className="text-sm">YouTube video (optional)</Label>
              </div>
              <Input
                value={form.youtube_url}
                onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=…"
              />
              {youtubeThumb ? (
                <div className="rounded-lg overflow-hidden border border-border/40 w-full max-w-xs">
                  <img src={youtubeThumb} alt="YouTube preview" className="w-full h-32 object-cover" />
                </div>
              ) : youtubeInvalid ? (
                <p className="text-[11px] text-amber-400">URL not recognized as a YouTube link.</p>
              ) : null}
            </div>

            <div className="space-y-3 rounded-xl border border-border/40 p-4 bg-surface/30">
              <div className="flex items-center gap-2">
                <VideoIcon className="w-4 h-4 text-accent" />
                <Label className="text-sm">Short promo video (optional)</Label>
              </div>
              <ServiceVideoUploader
                value={form.promo_video_url}
                durationSeconds={form.promo_video_duration_seconds}
                onChange={({ url, durationSeconds }) =>
                  setForm((f) => ({ ...f, promo_video_url: url, promo_video_duration_seconds: durationSeconds }))
                }
              />
            </div>

            <div className="space-y-3 rounded-xl border border-border/40 p-4 bg-surface/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <Label className="text-sm">Gallery ({form.gallery.length})</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={galleryBusy}
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    {galleryBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                    Upload images
                  </Button>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { void handleGalleryFiles(e.target.files); e.target.value = ''; }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Shown as a snap carousel on mobile and a grid on desktop. Only displays when at least one image is added.
              </p>

              {form.gallery.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {form.gallery.map((src, i) => (
                    <div key={src + i} className="relative rounded-lg overflow-hidden border border-border/40">
                      <img src={src} alt={`Gallery ${i + 1}`} className="w-full h-28 object-cover" />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/80 px-1.5 py-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveGallery(i, -1)}
                            disabled={i === 0}
                            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                            aria-label="Move up"
                          ><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button
                            type="button"
                            onClick={() => moveGallery(i, 1)}
                            disabled={i === form.gallery.length - 1}
                            className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                            aria-label="Move down"
                          ><ArrowDown className="w-3.5 h-3.5" /></button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeGallery(i)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive"
                          aria-label="Remove"
                        ><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No gallery images yet — upload above or paste a URL below.</p>
              )}

              <div className="flex gap-2">
                <Input
                  value={galleryUrlDraft}
                  onChange={(e) => setGalleryUrlDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGalleryUrl(); } }}
                  placeholder="https://… (paste a URL as fallback)"
                />
                <Button type="button" variant="outline" onClick={addGalleryUrl}>Add URL</Button>
              </div>
            </div>
          </section>

          <section className="space-y-4 pt-2 border-t border-border/30">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>URL slug</Label>
                <Input value={form.public_slug} onChange={(e) => setForm({ ...form, public_slug: e.target.value })} placeholder="e.g. carbon-laser-facial" />
                <p className="text-[11px] text-muted-foreground mt-1">Auto-generated if left blank.</p>
              </div>
              <div>
                <Label>Price display</Label>
                <Select value={form.price_display_mode} onValueChange={(v) => setForm({ ...form, price_display_mode: v as PriceMode })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="catalogue">Show catalogue price</SelectItem>
                    <SelectItem value="from">Show "From ₦..."</SelectItem>
                    <SelectItem value="on_consultation">Confirmed after consultation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Short summary (1–2 sentences)</Label>
              <Textarea rows={2} value={form.public_summary} onChange={(e) => setForm({ ...form, public_summary: e.target.value })} />
            </div>

            <div>
              <Label>Option label (within its treatment family)</Label>
              <Input
                value={form.public_option_label}
                onChange={(e) => setForm({ ...form, public_option_label: e.target.value })}
                placeholder='e.g. "Individual · 60 minutes", "Couples · 60 minutes"'
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Display only. Used to label this purchase option on the family page. Pricing, booking and checkout are unaffected.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <div>
                <Label>Audience / booking type</Label>
                <Select
                  value={form.party_type}
                  onValueChange={(v) => setForm({ ...form, party_type: v as 'individual' | 'couple' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual — one client</SelectItem>
                    <SelectItem value="couple">Couples — two clients treated simultaneously</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Couples means two clients treated at the same time. Its price starts at double the individual price
                  but can be changed independently at any time in the normal price editor.
                </p>
              </div>
              {form.party_type === 'couple' && (
                <div>
                  <Label>Linked individual service</Label>
                  <Select
                    value={form.base_service_id || 'none'}
                    onValueChange={(v) => setForm({ ...form, base_service_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select the individual option" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {siblingIndividuals.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} — {s.duration_minutes} min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label>Long description</Label>
              <Textarea rows={5} value={form.long_description} onChange={(e) => setForm({ ...form, long_description: e.target.value })} />
            </div>

            <div>
              <Label>What to expect (visit walk-through)</Label>
              <Textarea rows={4} value={form.what_to_expect} onChange={(e) => setForm({ ...form, what_to_expect: e.target.value })} placeholder="Explain the in-clinic experience step by step." />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Benefits (one per line)</Label>
                <Textarea rows={5} value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} />
              </div>
              <div>
                <Label>Suitable for (one per line)</Label>
                <Textarea rows={5} value={form.suitable_for} onChange={(e) => setForm({ ...form, suitable_for: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Preparation</Label>
                <Textarea rows={4} value={form.preparation} onChange={(e) => setForm({ ...form, preparation: e.target.value })} />
              </div>
              <div>
                <Label>Aftercare</Label>
                <Textarea rows={4} value={form.aftercare} onChange={(e) => setForm({ ...form, aftercare: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>FAQ (JSON array of {'{ "q", "a" }'})</Label>
              <Textarea rows={6} value={form.faq} onChange={(e) => setForm({ ...form, faq: e.target.value })} className="font-mono text-xs" />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={updatePublic.isPending}>
            {updatePublic.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Save public content
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ServicePublicContentDialog;