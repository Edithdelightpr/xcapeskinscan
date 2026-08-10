import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Eye, ImagePlus, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useProducts } from '@/hooks/useProducts';
import { useSaveXcapeMockup, useXcapeMockup } from '@/hooks/useXcapeMockup';
import CustomizationFormulaCard from '@/components/report/CustomizationFormulaCard';
import { CUSTOMIZATION_CATEGORIES, validateDoseTiers } from '@/lib/xcapeRules/customization';
import {
  DEFAULT_MOCKUP_CONFIG,
  MOCK_TAG,
  isMockPlaceholder,
  mockupToFormula,
  sanitizeMockupConfig,
  withCataloguePreview,
  type DelightMockupConfig,
} from '@/lib/xcapeRules/mockup';

/**
 * Delight Express report-card mockup — an ADMIN-ONLY, editable design
 * preview of the customized kit card exactly as it renders inside a report
 * concern card. Everything here is draft configuration:
 *
 *  - Persisted as a single JSON document in the admin-only
 *    `xcape_admin_mockups` table (no anon access, no delete).
 *  - Never creates products, mappings, proposals, formula snapshots or
 *    order rows, and never activates anything.
 *  - The preview runs CustomizationFormulaCard in explicit mock mode:
 *    add-to-cart and event logging are disabled no matter what is entered.
 *  - "Use real catalogue item" only overlays an existing product's
 *    presentation data onto the preview — it copies, publishes or converts
 *    nothing.
 */

const MockTag = ({ show }: { show: boolean }) =>
  show ? (
    <span className="rounded-full border border-amber-500/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-400">
      {MOCK_TAG}
    </span>
  ) : null;

const FieldLabel = ({ children, mock }: { children: React.ReactNode; mock?: boolean }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <Label className="text-[11px] text-muted-foreground">{children}</Label>
    <MockTag show={!!mock} />
  </div>
);

// Private admin-only bucket for uploaded mock images — public buckets are
// never used for mock assets. RLS scopes every operation to the admin role.
const MOCKUP_BUCKET = 'xcape-admin-mockups';
// Short-lived signed URL used ONLY for local admin preview — never persisted.
const SIGNED_URL_TTL_SECONDS = 3600;
const MAX_MOCK_IMAGE_BYTES = 5 * 1024 * 1024;

const DelightExpressMockup = () => {
  const { data: savedConfig, isLoading } = useXcapeMockup();
  const saveMockup = useSaveXcapeMockup();
  const { data: products = [] } = useProducts();

  const [draft, setDraft] = useState<DelightMockupConfig>(() => ({
    ...DEFAULT_MOCKUP_CONFIG,
    dose_tiers: DEFAULT_MOCKUP_CONFIG.dose_tiers.map((t) => ({ ...t })),
  }));
  const dirtyRef = useRef(false);
  const [cataloguePreviewId, setCataloguePreviewId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [signedPreviewUrl, setSignedPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hydrate from the saved admin record once, without clobbering edits.
  useEffect(() => {
    if (savedConfig != null && !dirtyRef.current) {
      setDraft(sanitizeMockupConfig(savedConfig));
    }
  }, [savedConfig]);

  // Mint a short-lived signed URL for the saved private mock image. The signed
  // URL lives only in this component's local preview state — it is never saved.
  useEffect(() => {
    const path = draft.kit_image_storage_path;
    if (!path) {
      setSignedPreviewUrl(null);
      return;
    }
    let cancelled = false;
    void supabase.storage
      .from(MOCKUP_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
      .then(({ data, error }) => {
        if (!cancelled) setSignedPreviewUrl(error ? null : (data?.signedUrl ?? null));
      });
    return () => {
      cancelled = true;
    };
  }, [draft.kit_image_storage_path]);

  const update = (patch: Partial<DelightMockupConfig>) => {
    dirtyRef.current = true;
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const updateTier = (index: number, patch: Partial<{ score_min: number; score_max: number; dose_ml: number }>) => {
    dirtyRef.current = true;
    setDraft((prev) => ({
      ...prev,
      dose_tiers: prev.dose_tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  };

  const tierErrors = useMemo(() => validateDoseTiers(draft.dose_tiers), [draft.dose_tiers]);

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);
  const catalogueProduct = useMemo(
    () => activeProducts.find((p) => p.id === cataloguePreviewId) ?? null,
    [activeProducts, cataloguePreviewId],
  );

  const previewFormula = useMemo(() => {
    const base = mockupToFormula(draft, {
      // A private upload takes precedence over any external URL; its signed
      // preview URL comes from local state only.
      imageOverride: draft.kit_image_storage_path ? signedPreviewUrl : undefined,
    });
    return catalogueProduct ? withCataloguePreview(base, catalogueProduct) : base;
  }, [draft, signedPreviewUrl, catalogueProduct]);

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Mock kit images must be image files');
      return;
    }
    if (file.size > MAX_MOCK_IMAGE_BYTES) {
      toast.error('Mock kit images are limited to 5 MB');
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop()?.toLowerCase() || 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg';
      const previousPath = draft.kit_image_storage_path;
      const path = `mockups/delight-express/${crypto.randomUUID()}.${ext}`;
      // Private admin-only bucket — mock assets never touch public storage.
      const { error } = await supabase.storage
        .from(MOCKUP_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (error) throw error;
      // Persist ONLY the private object path (a private upload replaces any
      // external URL as the image source). The signed preview URL is minted by
      // the effect above and never saved.
      update({ kit_image_storage_path: path, kit_image_url: '' });
      // Clean up the replaced private object (covered by the admin DELETE policy).
      if (previousPath && previousPath !== path) {
        void supabase.storage
          .from(MOCKUP_BUCKET)
          .remove([previousPath])
          .then(() => undefined);
      }
      toast.success('Mock image uploaded to the private admin bucket');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Image upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeUploadedImage = () => {
    const path = draft.kit_image_storage_path;
    update({ kit_image_storage_path: '' });
    if (path) {
      void supabase.storage
        .from(MOCKUP_BUCKET)
        .remove([path])
        .then(() => undefined);
    }
  };

  const onSave = async () => {
    if (tierErrors.length > 0) {
      toast.error('Fix the dose tier errors before saving');
      return;
    }
    try {
      await saveMockup.mutateAsync(draft);
      dirtyRef.current = false;
      toast.success('Mockup saved — admin-only, still not live');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save mockup');
    }
  };

  const onReset = () => {
    dirtyRef.current = true;
    setCataloguePreviewId('');
    setDraft({
      ...DEFAULT_MOCKUP_CONFIG,
      dose_tiers: DEFAULT_MOCKUP_CONFIG.dose_tiers.map((t) => ({ ...t })),
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground">Delight Express report-card mockup</h3>
        <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/50 text-[11px] tracking-wide px-2.5 py-1">
          DRAFT MOCKUP — NOT LIVE
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground max-w-3xl">
        Design preview of the customized kit card as it appears inside a report concern card.
        Everything on this panel is admin-only mock configuration: it creates no products,
        mappings, formulas or orders, never becomes purchasable, and never appears on public
        reports. The live engine keeps using real catalogue products, active mappings and
        practitioner-approved snapshots.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------- Editable mock fields ---------- */}
        <div className="glass rounded-xl p-4 space-y-4">
          <div className="space-y-2">
            <FieldLabel>Kit display name</FieldLabel>
            <Input
              value={draft.kit_display_name}
              onChange={(e) => update({ kit_display_name: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <FieldLabel>Kit image URL (external)</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                value={draft.kit_image_url}
                onChange={(e) => update({ kit_image_url: e.target.value })}
                placeholder="https://… (empty shows an image placeholder)"
                className="h-8 text-xs flex-1"
                disabled={!!draft.kit_image_storage_path}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs shrink-0"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="w-3.5 h-3.5 mr-1" />
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Externally hosted URLs may already be public. Uploaded images go to a private
              admin-only bucket and are previewed through short-lived signed URLs — the
              signed URL is never saved.
            </p>
            {draft.kit_image_storage_path && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-emerald-400">
                  Private upload active — remove it to use an external URL.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={removeUploadedImage}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove uploaded image
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <FieldLabel mock={isMockPlaceholder(draft, 'short_description')}>Short description</FieldLabel>
            <Textarea
              value={draft.short_description}
              onChange={(e) => update({ short_description: e.target.value })}
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <FieldLabel mock={isMockPlaceholder(draft, 'display_price')}>
                Display price (₦, mock price)
              </FieldLabel>
              <Input
                type="number"
                min={0}
                value={draft.display_price}
                onChange={(e) => update({ display_price: Math.max(0, Number(e.target.value) || 0) })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>CTA preview label</FieldLabel>
              <Input
                value={draft.cta_label}
                onChange={(e) => update({ cta_label: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <FieldLabel>Preview category</FieldLabel>
              <Select
                value={draft.preview_category}
                onValueChange={(v) => update({ preview_category: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMIZATION_CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <FieldLabel>Preview health score (0–100)</FieldLabel>
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.preview_score}
                onChange={(e) =>
                  update({ preview_score: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                }
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <FieldLabel mock={isMockPlaceholder(draft, 'base_product_label')}>
                Product inside the kit being customized
              </FieldLabel>
              <Input
                value={draft.base_product_label}
                onChange={(e) => update({ base_product_label: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel mock={isMockPlaceholder(draft, 'active_solution_label')}>
                Active solution label
              </FieldLabel>
              <Input
                value={draft.active_solution_label}
                onChange={(e) => update({ active_solution_label: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Score → dose tiers (must cover 0–100 with no gaps or overlaps)</FieldLabel>
            <div className="space-y-1.5">
              {draft.dose_tiers.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={t.score_min}
                    onChange={(e) => updateTier(i, { score_min: Number(e.target.value) || 0 })}
                    className="h-8 text-xs"
                    aria-label={`Tier ${i + 1} score min`}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={t.score_max}
                    onChange={(e) => updateTier(i, { score_max: Number(e.target.value) || 0 })}
                    className="h-8 text-xs"
                    aria-label={`Tier ${i + 1} score max`}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={t.dose_ml}
                    onChange={(e) => updateTier(i, { dose_ml: Number(e.target.value) || 0 })}
                    className="h-8 text-xs"
                    aria-label={`Tier ${i + 1} dose ml`}
                  />
                  <span className="text-[10px] text-muted-foreground">ml</span>
                </div>
              ))}
            </div>
            {tierErrors.length > 0 && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 space-y-0.5">
                {tierErrors.map((err, i) => (
                  <p key={i} className="text-[11px] text-destructive">
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <FieldLabel>Aggressiveness</FieldLabel>
              <Select
                value={draft.aggressiveness}
                onValueChange={(v) => update({ aggressiveness: v as 'mild' | 'aggressive' })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild" className="text-xs">Mild — no companion</SelectItem>
                  <SelectItem value="aggressive" className="text-xs">
                    Aggressive — companion required
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.aggressiveness === 'aggressive' && (
              <div className="space-y-1">
                <FieldLabel>Companion ratio</FieldLabel>
                <Input
                  type="number"
                  step="0.1"
                  min={0.1}
                  value={draft.companion_ratio}
                  onChange={(e) => update({ companion_ratio: Number(e.target.value) || 1 })}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          {draft.aggressiveness === 'aggressive' && (
            <div className="space-y-1">
              <FieldLabel mock={isMockPlaceholder(draft, 'companion_label')}>
                Companion solution label
              </FieldLabel>
              <Input
                value={draft.companion_label}
                onChange={(e) => update({ companion_label: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          )}

          <div className="space-y-1">
            <FieldLabel>Instructions</FieldLabel>
            <Textarea
              value={draft.instructions}
              onChange={(e) => update({ instructions: e.target.value })}
              rows={2}
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <FieldLabel>Warnings (one per line)</FieldLabel>
            <Textarea
              value={draft.warnings.join('\n')}
              onChange={(e) => update({ warnings: e.target.value.split('\n') })}
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={onReset}>
              Reset to defaults
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs"
              disabled={saveMockup.isPending || tierErrors.length > 0 || isLoading}
              onClick={onSave}
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {saveMockup.isPending ? 'Saving…' : 'Save mockup (admin-only)'}
            </Button>
          </div>
        </div>

        {/* ---------- Live preview ---------- */}
        <div className="space-y-3">
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              Live preview — rendered with the real report card component, inside a concern
              card's CUSTOMIZATION position
            </div>

            <div className="space-y-1">
              <FieldLabel>Use real catalogue item (preview only)</FieldLabel>
              <div className="flex items-center gap-2">
                <Select value={cataloguePreviewId} onValueChange={setCataloguePreviewId}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Select an existing product to preview…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cataloguePreviewId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs shrink-0"
                    onClick={() => setCataloguePreviewId('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Preview only — selecting a catalogue item never copies, publishes, activates or
                converts mock values, and the preview still cannot be purchased.
              </p>
            </div>

            {/* Concern-card frame: mirrors how PersonalReportView nests the
                formula inside the CUSTOMIZATION position. */}
            <div className="rounded-3xl border border-border/40 bg-background/60 p-4">
              <div className="text-[10.5px] font-semibold text-bronze uppercase tracking-[0.18em] pb-2">
                Customization
              </div>
              <CustomizationFormulaCard
                token="mockup"
                formula={previewFormula}
                compact
                mock
                ctaLabel={draft.cta_label.trim() || undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DelightExpressMockup;
