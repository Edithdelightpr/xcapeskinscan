import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Loader2, Youtube, Image as ImageIcon, Video, ExternalLink, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useUpsertServiceCategory,
  type ServiceCategoryRow,
} from '@/hooks/useServiceCategories';
import ServiceImageUploader from './ServiceImageUploader';
import MenuDisplayModeSelect from './MenuDisplayModeSelect';
import { normalizeMenuMode, type MenuDisplayMode } from '@/lib/menuDisplay';
import ServiceVideoUploader from './ServiceVideoUploader';
import { parseYouTubeId, toYouTubeThumb } from '@/lib/youtube';
import { toast } from 'sonner';
import { Globe } from 'lucide-react';
import DiscountEditor, {
  emptyDiscount,
  rowToDiscountState,
  discountStateToColumns,
  type DiscountFormState,
} from './DiscountEditor';

interface Props {
  open: boolean;
  category: ServiceCategoryRow | null;
  onClose: () => void;
}

const CategoryForm = ({ open, category, onClose }: Props) => {
  const upsert = useUpsertServiceCategory();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includePhoto, setIncludePhoto] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFormat, setImageFormat] = useState<string | null>(null);
  const [imageAspect, setImageAspect] = useState<string | null>(null);
  const [includeYoutube, setIncludeYoutube] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [includePromoVideo, setIncludePromoVideo] = useState(false);
  const [promoVideoUrl, setPromoVideoUrl] = useState<string | null>(null);
  const [promoVideoSeconds, setPromoVideoSeconds] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [discount, setDiscount] = useState<DiscountFormState>(emptyDiscount);
  // Public content (additive)
  const [publicVisible, setPublicVisible] = useState(true);
  const [publicSlug, setPublicSlug] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [useCoverAsHero, setUseCoverAsHero] = useState(true);
  const [longDescription, setLongDescription] = useState('');
  const [concernsText, setConcernsText] = useState('');
  const [whoItsForText, setWhoItsForText] = useState('');
  const [faqText, setFaqText] = useState('');
  const [menuDisplayMode, setMenuDisplayMode] = useState<MenuDisplayMode>('auto');

  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(category.name);
      setDescription(category.description ?? '');
      setIncludePhoto(!!category.image_url);
      setImageUrl(category.image_url);
      setImageFormat(category.image_format);
      setImageAspect(category.image_aspect);
      setIncludeYoutube(!!category.youtube_url);
      setYoutubeUrl(category.youtube_url ?? '');
      setIncludePromoVideo(!!category.promo_video_url);
      setPromoVideoUrl(category.promo_video_url);
      setPromoVideoSeconds(category.promo_video_duration_seconds ?? null);
      setActive(category.active);
      setDiscount(rowToDiscountState(category));
      setPublicVisible(category.public_visible ?? true);
      setPublicSlug(category.public_slug ?? '');
      setHeroImageUrl(category.hero_image_url ?? '');
      setUseCoverAsHero(!category.hero_image_url);
      setLongDescription(category.long_description ?? '');
      setConcernsText((category.concerns ?? []).join('\n'));
      setWhoItsForText((category.who_its_for ?? []).join('\n'));
      setFaqText(JSON.stringify(category.faq ?? [], null, 2));
      setMenuDisplayMode(normalizeMenuMode(category.menu_display_mode));
    } else {
      setName(''); setDescription('');
      setIncludePhoto(false); setImageUrl(null); setImageFormat(null); setImageAspect(null);
      setIncludeYoutube(false); setYoutubeUrl('');
      setIncludePromoVideo(false); setPromoVideoUrl(null); setPromoVideoSeconds(null);
      setActive(true);
      setDiscount(emptyDiscount);
      setPublicVisible(true);
      setPublicSlug(''); setHeroImageUrl(''); setLongDescription('');
      setUseCoverAsHero(true);
      setConcernsText(''); setWhoItsForText(''); setFaqText('');
      setMenuDisplayMode('auto');
    }
  }, [open, category]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Category name is required'); return; }
    let normalizedYoutube: string | null = null;
    if (includeYoutube && youtubeUrl.trim()) {
      const id = parseYouTubeId(youtubeUrl);
      if (!id) { toast.error('Enter a valid YouTube URL'); return; }
      normalizedYoutube = `https://www.youtube.com/watch?v=${id}`;
    }
    const toLines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
    let faq: Array<{ q: string; a: string }> = [];
    if (faqText.trim()) {
      try {
        const parsed = JSON.parse(faqText);
        if (!Array.isArray(parsed)) throw new Error('FAQ must be an array');
        faq = parsed;
      } catch (e) {
        toast.error(`FAQ JSON invalid: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }
    try {
      await upsert.mutateAsync({
        ...(category ? { id: category.id } : {}),
        name: name.trim(),
        description: description.trim() || null,
        active,
        image_url: includePhoto ? imageUrl : null,
        image_format: includePhoto ? imageFormat : null,
        image_aspect: includePhoto ? imageAspect : null,
        youtube_url: normalizedYoutube,
        promo_video_url: includePromoVideo ? promoVideoUrl : null,
        promo_video_duration_seconds: includePromoVideo ? promoVideoSeconds : null,
        ...discountStateToColumns(discount),
        public_visible: publicVisible,
        public_slug: publicSlug.trim() || null,
        hero_image_url: useCoverAsHero ? null : (heroImageUrl.trim() || null),
        long_description: longDescription.trim() || null,
        concerns: toLines(concernsText),
        who_its_for: toLines(whoItsForText),
        faq,
        menu_display_mode: menuDisplayMode,
      });
      toast.success(category ? 'Category updated' : 'Category created');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const busy = upsert.isPending;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="font-display">
            {category ? 'Edit Category' : 'New Category'}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chemical Peel" />
            <p className="text-[11px] text-muted-foreground">
              Top-level grouping shown on the landing page. Add specific treatments under it.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this category of treatments does, who it's for…"
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cover media</Label>

            {/* YouTube */}
            <div className="space-y-3 rounded-xl border border-border/40 p-4 bg-surface/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-400" />
                  <div>
                    <Label className="text-sm">YouTube video</Label>
                    <p className="text-[11px] text-muted-foreground">Plays in the category detail view.</p>
                  </div>
                </div>
                <Switch checked={includeYoutube} onCheckedChange={setIncludeYoutube} />
              </div>
              {includeYoutube && (
                <div className="space-y-2">
                  <Input
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                  />
                  {(() => {
                    const thumb = toYouTubeThumb(youtubeUrl);
                    if (thumb) return (
                      <div className="rounded-lg overflow-hidden border border-border/40">
                        <img src={thumb} alt="YouTube preview" className="w-full h-32 object-cover" />
                      </div>
                    );
                    if (youtubeUrl.trim().length > 0) return <p className="text-[11px] text-amber-400">URL not recognized.</p>;
                    return null;
                  })()}
                </div>
              )}
            </div>

            {/* Cover photo (auto-cropped square on display) */}
            <div className="space-y-3 rounded-xl border border-border/40 p-4 bg-surface/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <div>
                    <Label className="text-sm">Cover photo</Label>
                    <p className="text-[11px] text-muted-foreground">Auto-cropped to a square frame on the menu.</p>
                  </div>
                </div>
                <Switch checked={includePhoto} onCheckedChange={setIncludePhoto} />
              </div>
              {includePhoto && (
                <ServiceImageUploader
                  value={imageUrl}
                  onChange={({ url, format, aspect }) => {
                    setImageUrl(url); setImageFormat(format); setImageAspect(aspect);
                  }}
                />
              )}
            </div>

            {/* Promo video */}
            <div className="space-y-3 rounded-xl border border-border/40 p-4 bg-surface/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-accent" />
                  <div>
                    <Label className="text-sm">Short promo video</Label>
                    <p className="text-[11px] text-muted-foreground">Upload a clip up to 30 seconds long.</p>
                  </div>
                </div>
                <Switch checked={includePromoVideo} onCheckedChange={setIncludePromoVideo} />
              </div>
              {includePromoVideo && (
                <ServiceVideoUploader
                  value={promoVideoUrl}
                  durationSeconds={promoVideoSeconds}
                  onChange={({ url, durationSeconds }) => {
                    setPromoVideoUrl(url); setPromoVideoSeconds(durationSeconds);
                  }}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-border/30">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label className="text-xs">Active (visible on landing page)</Label>
          </div>

          <DiscountEditor
            title="Category discount (optional)"
            description="Applies to every service in this category that does not have its own discount. Booking calculations are unchanged in this release — this controls how prices are shown on the public menu."
            helperText="Service-level discounts override category-level discounts."
            value={discount}
            onChange={setDiscount}
          />

          {/* Public content */}
          <div className="space-y-4 pt-4 border-t border-border/30">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-bronze" />
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Public /treatments page</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={publicVisible} onCheckedChange={setPublicVisible} />
              <Label className="text-xs">Show this category on the public treatments site</Label>
            </div>
            <div>
              <Label className="text-xs">URL slug</Label>
              <Input value={publicSlug} onChange={(e) => setPublicSlug(e.target.value)} placeholder="e.g. chemical-peels" />
              <p className="text-[11px] text-muted-foreground mt-1">Auto-generated if left blank.</p>
              {publicSlug.trim() && (
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <Link to={`/treatments/category/${publicSlug.trim()}`} target="_blank" className="text-bronze inline-flex items-center gap-1 hover:underline">
                    Preview public page <ExternalLink className="w-3 h-3" />
                  </Link>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/treatments/category/${publicSlug.trim()}`);
                      toast.success('Public link copied');
                    }}
                  >
                    <Copy className="w-3 h-3" /> Copy link
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-xl border border-border/40 p-4 bg-surface/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Category hero image</Label>
                  <p className="text-[11px] text-muted-foreground">Used at the top of the category page.</p>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Reuse cover image
                  <Switch checked={useCoverAsHero} onCheckedChange={setUseCoverAsHero} />
                </label>
              </div>
              {useCoverAsHero ? (
                <p className="text-[11px] text-muted-foreground">
                  The category hero will reuse the cover photo above. Turn the switch off to upload a different one.
                </p>
              ) : (
                <>
                  <ServiceImageUploader
                    value={heroImageUrl || null}
                    onChange={({ url }) => setHeroImageUrl(url ?? '')}
                  />
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Or paste a hero image URL (fallback)</Label>
                    <Input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="https://…" />
                  </div>
                </>
              )}
            </div>
            <div>
              <Label className="text-xs">Long description (public)</Label>
              <Textarea rows={4} value={longDescription} onChange={(e) => setLongDescription(e.target.value)} />
            </div>
            <MenuDisplayModeSelect value={menuDisplayMode} onChange={setMenuDisplayMode} />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs">Concerns addressed (one per line)</Label>
                <Textarea rows={4} value={concernsText} onChange={(e) => setConcernsText(e.target.value)} placeholder="Hyperpigmentation" />
              </div>
              <div>
                <Label className="text-xs">Who it's for (one per line)</Label>
                <Textarea rows={4} value={whoItsForText} onChange={(e) => setWhoItsForText(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">FAQ (JSON array of {'{ "q", "a" }'})</Label>
              <Textarea rows={5} value={faqText} onChange={(e) => setFaqText(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={handleSave} disabled={busy} className="glow-primary">
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {category ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CategoryForm;
