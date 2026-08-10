import { useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  FileDown, Briefcase, Stethoscope, Package, Plus, Trash2,
  History, Save, Loader2, Check, AlertTriangle, RotateCcw,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type CurrencySymbol = '₦' | '€' | '$' | '£';

interface Product {
  id: string;
  name: string;
  units: number;
  costPerUnit: number;
  pricePerUnit: number;
}

interface ProposalState {
  // Outreach (single proof by default)
  outreachCount: number;
  outreachRevenue: number;
  // Capital
  capital: number;
  ingredients: number;             // production / ingredients
  operations: number;              // logistics + outreach + ops bucket
  // Dynamic products
  products: Product[];
  // Packaging (MOQ-aware, always on per spec but can be hidden)
  packagingEnabled: boolean;
  packagingMoq: number;
  packagingCostPerUnit: number;
  // Investor split
  investorPct: number;
  businessPct: number;
  currency: CurrencySymbol;
  // Treatment / 360 deal
  treatmentEnabled: boolean;
  outreachLeads: number;
  conversionRatePct: number;
  avgSpendPerClient: number;
  // Phasing — model capital-vs-MOQ gap & reinvestment of phase 1 profit
  phasingEnabled: boolean;
  manufacturedUnitsOverride: number | null; // null => use sum of products.units
  reinvestProfitPct: number;                // % of phase 1 profit funneled into phase 2 manufacturing
  // Manual Phase 2 inputs (override auto-derived values)
  phase2ReinvestAmount: number | null;      // ₦ reinvested from Phase 1 profit; null => use phase1Profit
  phase2UnitsManual: number | null;         // units that sum manufactures; null => use gapUnits
}

const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULTS: ProposalState = {
  outreachCount: 1,
  outreachRevenue: 200000,
  capital: 4000000,
  ingredients: 2500000,
  operations: 500000,
  products: [
    { id: uid(), name: 'Product A', units: 500, costPerUnit: 5000, pricePerUnit: 12000 },
  ],
  packagingEnabled: true,
  packagingMoq: 1000,
  packagingCostPerUnit: 500,
  investorPct: 40,
  businessPct: 60,
  currency: '₦',
  treatmentEnabled: false,
  outreachLeads: 50,
  conversionRatePct: 20,
  avgSpendPerClient: 200000,
  phasingEnabled: true,
  manufacturedUnitsOverride: null,
  reinvestProfitPct: 100,
  phase2ReinvestAmount: null,
  phase2UnitsManual: null,
};

const fmt = (currency: string, n: number) =>
  `${currency}${Math.round(n).toLocaleString('en-US')}`;

const NumberField = ({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
      {label}
    </Label>
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={prefix ? 'pl-8' : ''}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const StatTile = ({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent?: 'primary' | 'accent' | 'destructive' | 'muted';
  big?: boolean;
}) => {
  const tone =
    accent === 'primary'
      ? 'text-primary'
      : accent === 'accent'
        ? 'text-accent'
        : accent === 'destructive'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-display font-bold ${tone} ${big ? 'text-3xl' : 'text-2xl'}`}
      >
        {value}
      </p>
    </div>
  );
};

const AdminBusinessProposal = () => {
  return <AdminBusinessProposalInner />;
};

const SaveIndicator = ({
  state,
  lastSavedAt,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: Date | null;
}) => {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertTriangle className="w-3.5 h-3.5" /> Save failed
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="w-3.5 h-3.5 text-primary" /> Saved
        {lastSavedAt && ` ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
      </span>
    );
  }
  return null;
};

const AdminBusinessProposalInner = () => {
  const { user } = useAuth();
  const [s, setS] = useState<ProposalState>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [versions, setVersions] = useState<Array<{ id: string; saved_at: string; label: string | null; state: ProposalState }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const set = <K extends keyof ProposalState>(key: K, v: ProposalState[K]) =>
    setS((prev) => ({ ...prev, [key]: v }));

  const exportRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing proposal once user is known
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('business_proposals')
        .select('state, updated_at')
        .eq('owner_user_id', user.id)
        .maybeSingle();
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('Load proposal failed', error);
        toast.error('Could not load saved proposal');
      } else if (data?.state) {
        setS({ ...DEFAULTS, ...(data.state as ProposalState) });
        setLastSavedAt(new Date(data.updated_at));
        setSaveState('saved');
      }
      setLoaded(true);
    })();
  }, [user]);

  // Auto-save (debounced) on every state change after initial load
  useEffect(() => {
    if (!loaded || !user) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('saving');
    debounceRef.current = setTimeout(async () => {
      const { error } = await (supabase as any)
        .from('business_proposals')
        .upsert(
          { owner_user_id: user.id, state: s, updated_at: new Date().toISOString() },
          { onConflict: 'owner_user_id' },
        );
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('Save proposal failed', error);
        setSaveState('error');
        toast.error('Save failed — your changes are not stored');
      } else {
        setSaveState('saved');
        setLastSavedAt(new Date());
      }
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [s, loaded, user]);

  const fetchVersions = async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from('business_proposal_versions')
      .select('id, saved_at, label, state')
      .eq('owner_user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(50);
    if (error) {
      toast.error('Could not load history');
      return;
    }
    setVersions((data ?? []) as any);
  };

  const saveSnapshot = async () => {
    if (!user) return;
    const label = window.prompt('Label this snapshot (optional):') ?? null;
    const { error } = await (supabase as any)
      .from('business_proposal_versions')
      .insert({ owner_user_id: user.id, state: s, label: label || null });
    if (error) {
      toast.error('Snapshot failed');
    } else {
      toast.success('Snapshot saved');
      if (historyOpen) fetchVersions();
    }
  };

  const restoreVersion = (state: ProposalState) => {
    setS({ ...DEFAULTS, ...state });
    setHistoryOpen(false);
    toast.success('Version restored — auto-saving as current');
  };

  const updateProduct = (id: string, patch: Partial<Product>) =>
    setS((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  const addProduct = () =>
    setS((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          id: uid(),
          name: `Product ${String.fromCharCode(65 + prev.products.length)}`,
          units: 100,
          costPerUnit: 5000,
          pricePerUnit: 12000,
        },
      ],
    }));
  const removeProduct = (id: string) =>
    setS((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));

  const computed = useMemo(() => {
    const productRows = s.products.map((p) => {
      const revenue = p.units * p.pricePerUnit;
      const cost = p.units * p.costPerUnit;
      return { ...p, revenue, cost, profit: revenue - cost };
    });
    const totalUnits = productRows.reduce((a, r) => a + r.units, 0);
    const productRevenue = productRows.reduce((a, r) => a + r.revenue, 0);

    // Packaging — units paid for = max(MOQ, totalUnits)
    const packagingUnitsPaidFor = s.packagingEnabled
      ? Math.max(s.packagingMoq, totalUnits)
      : 0;
    const packagingTotalCost = s.packagingEnabled
      ? packagingUnitsPaidFor * s.packagingCostPerUnit
      : 0;
    const packagingLeftover = Math.max(0, packagingUnitsPaidFor - totalUnits);

    // Outreach
    const outreachRevenue = s.outreachCount * s.outreachRevenue;

    // Treatment (360)
    const convertedClients = s.treatmentEnabled
      ? Math.round((s.outreachLeads * s.conversionRatePct) / 100)
      : 0;
    const treatmentRevenue = s.treatmentEnabled
      ? convertedClients * s.avgSpendPerClient
      : 0;

    const totalRevenue = outreachRevenue + productRevenue + treatmentRevenue;
    const totalCost = s.ingredients + packagingTotalCost + s.operations;
    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const roi = s.capital > 0 ? (profit / s.capital) * 100 : 0;

    const investorProfit = (profit * s.investorPct) / 100;
    const businessProfit = (profit * s.businessPct) / 100;

    // ============= PHASE PLAN (capital fit + reinvestment) =============
    // Weighted avg product cost & price (per unit), used for marginal phase 2 math
    const totalProductCost = productRows.reduce((a, r) => a + r.cost, 0);
    const avgCostPerUnit = totalUnits > 0 ? totalProductCost / totalUnits : 0;
    const avgPricePerUnit = totalUnits > 0 ? productRevenue / totalUnits : 0;

    // Phase 1 = what the capital actually manufactures right now
    const phase1Units =
      s.manufacturedUnitsOverride != null && s.manufacturedUnitsOverride >= 0
        ? Math.min(s.manufacturedUnitsOverride, packagingUnitsPaidFor || s.manufacturedUnitsOverride)
        : totalUnits;

    const phase1ProductCost = phase1Units * avgCostPerUnit;
    // Packaging is paid in full upfront in phase 1 (MOQ commitment)
    const phase1Outlay =
      phase1ProductCost + packagingTotalCost + s.ingredients + s.operations;
    const phase1Revenue =
      phase1Units * avgPricePerUnit + outreachRevenue + treatmentRevenue;
    const phase1Profit = phase1Revenue - phase1Outlay;
    const phase1Roi = s.capital > 0 ? (phase1Profit / s.capital) * 100 : 0;
    const capitalSurplus = s.capital - phase1Outlay; // positive = capital covers phase 1

    // Gap = packaging units paid for that haven't been manufactured yet
    const gapUnits = Math.max(0, packagingUnitsPaidFor - phase1Units);
    const gapCost = gapUnits * avgCostPerUnit; // packaging already paid; only product cost remains

    // Phase 2 funded by reinvested phase 1 profit (clamped to non-negative)
    const phase2FundsAvailable =
      s.phase2ReinvestAmount != null
        ? Math.max(0, s.phase2ReinvestAmount)
        : Math.max(0, phase1Profit);
    const phase2Units =
      s.phase2UnitsManual != null
        ? Math.max(0, Math.floor(s.phase2UnitsManual))
        : gapUnits;
    const phase2Cost = phase2FundsAvailable;
    const phase2ImpliedCostPerUnit = phase2Units > 0 ? phase2Cost / phase2Units : 0;
    const phase2Revenue = phase2Units * avgPricePerUnit;
    const phase2Profit = phase2Revenue - phase2Cost;
    const phase2Shortfall = 0;

    // Full cycle (phase 1 + phase 2)
    const cycleRevenue = phase1Revenue + phase2Revenue;
    const cycleCost = phase1Outlay + phase2Cost;
    const cycleProfit = cycleRevenue - cycleCost;
    const blendedRoi = s.capital > 0 ? (cycleProfit / s.capital) * 100 : 0;
    const selfFunding = phase1Profit > 0 && phase2Shortfall === 0 && gapUnits > 0;

    // ============= FULL-CYCLE AGGREGATES (investor-facing) =============
    // When phasing is on, headline numbers reflect Phase 1 + Phase 2 combined,
    // but ROI is still computed on the original capital (s.capital).
    const phaseOn = s.phasingEnabled;
    const cycleUnits = phase1Units + (phaseOn ? phase2Units : 0);
    const cycleProductRevenue = cycleUnits * avgPricePerUnit;
    const cycleIngredients = s.ingredients + (phaseOn ? phase2Cost : 0);
    const cycleTotalRevenue =
      cycleProductRevenue + outreachRevenue + treatmentRevenue;
    const cycleTotalCost =
      cycleIngredients + packagingTotalCost + s.operations;
    const cycleNetProfit = cycleTotalRevenue - cycleTotalCost;
    const cycleMargin =
      cycleTotalRevenue > 0 ? (cycleNetProfit / cycleTotalRevenue) * 100 : 0;
    const cycleRoiOnCapital =
      s.capital > 0 ? (cycleNetProfit / s.capital) * 100 : 0;
    const cycleInvestorProfit = (cycleNetProfit * s.investorPct) / 100;
    const cycleBusinessProfit = (cycleNetProfit * s.businessPct) / 100;

    return {
      productRows,
      totalUnits,
      productRevenue,
      packagingUnitsPaidFor,
      packagingTotalCost,
      packagingLeftover,
      outreachRevenue,
      convertedClients,
      treatmentRevenue,
      totalRevenue,
      totalCost,
      profit,
      margin,
      roi,
      investorProfit,
      businessProfit,
      // phase plan
      avgCostPerUnit,
      avgPricePerUnit,
      phase1Units,
      phase1ProductCost,
      phase1Outlay,
      phase1Revenue,
      phase1Profit,
      phase1Roi,
      capitalSurplus,
      gapUnits,
      gapCost,
      phase2FundsAvailable,
      phase2Units,
      phase2Cost,
      phase2ImpliedCostPerUnit,
      phase2Revenue,
      phase2Profit,
      phase2Shortfall,
      cycleRevenue,
      cycleCost,
      cycleProfit,
      blendedRoi,
      selfFunding,
      // full cycle (investor-facing)
      cycleUnits,
      cycleProductRevenue,
      cycleIngredients,
      cycleTotalRevenue,
      cycleTotalCost,
      cycleNetProfit,
      cycleMargin,
      cycleRoiOnCapital,
      cycleInvestorProfit,
      cycleBusinessProfit,
    };
  }, [s]);

  const c = s.currency;

  const handleExportPdf = async () => {
    if (!exportRef.current) return;
    const node = exportRef.current;
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
      useCORS: true,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
    } else {
      // Multi-page: slice the canvas
      let renderedHeight = 0;
      const pageCanvasHeight = (canvas.width * pageH) / pageW;
      while (renderedHeight < canvas.height) {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(pageCanvasHeight, canvas.height - renderedHeight);
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) break;
        ctx.drawImage(
          canvas,
          0,
          renderedHeight,
          canvas.width,
          sliceCanvas.height,
          0,
          0,
          canvas.width,
          sliceCanvas.height,
        );
        const sliceData = sliceCanvas.toDataURL('image/png');
        const sliceImgH = (sliceCanvas.height * imgW) / sliceCanvas.width;
        if (renderedHeight > 0) pdf.addPage();
        pdf.addImage(sliceData, 'PNG', 0, 0, imgW, sliceImgH);
        renderedHeight += sliceCanvas.height;
      }
    }
    pdf.save(`tropics-business-proposal-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const maxRC = Math.max(computed.cycleTotalRevenue, computed.cycleTotalCost, 1);
  const profitTotalAbs =
    Math.abs(computed.cycleInvestorProfit) +
      Math.abs(computed.cycleBusinessProfit) || 1;

  const phasedStory =
    s.phasingEnabled && computed.phase2Units > 0
      ? `With a capital of ${fmt(c, s.capital)}, we produce ${computed.cycleUnits.toLocaleString()} units across ${s.products.length} product${s.products.length === 1 ? '' : 's'} in 2 phases — ${computed.phase1Units.toLocaleString()} in Phase 1 from the invested capital, and ${computed.phase2Units.toLocaleString()} in Phase 2 funded by reinvested Phase 1 profit (${fmt(c, computed.phase2Cost)} in ingredients, packaging already paid). The full cycle generates ${fmt(c, computed.cycleTotalRevenue)} in revenue and ${fmt(c, computed.cycleNetProfit)} in profit on the same ${fmt(c, s.capital)} capital. The investor receives ${s.investorPct}% resulting in ${fmt(c, computed.cycleInvestorProfit)} return.`
      : '';
  const story = phasedStory
    ? `We conducted ${s.outreachCount} outreach${s.outreachCount === 1 ? '' : 'es'} and generated ${fmt(c, computed.outreachRevenue)} with limited stock, validating demand. ${phasedStory}`
    : `We conducted ${s.outreachCount} outreach${s.outreachCount === 1 ? '' : 'es'} and generated ${fmt(c, computed.outreachRevenue)} with limited stock, validating demand. With a capital of ${fmt(c, s.capital)}, we produce ${computed.cycleUnits.toLocaleString()} units across ${s.products.length} product${s.products.length === 1 ? '' : 's'}.${
        s.packagingEnabled
          ? ` Due to packaging MOQ constraints, we pay for ${computed.packagingUnitsPaidFor.toLocaleString()} units.`
          : ''
      } This generates ${fmt(c, computed.cycleTotalRevenue)} in revenue and ${fmt(c, computed.cycleNetProfit)} in profit per cycle. The investor receives ${s.investorPct}% resulting in ${fmt(c, computed.cycleInvestorProfit)} return.`;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header (NOT exported) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Business Proposal
            </h1>
            <p className="text-sm text-muted-foreground">
              Investor-ready outcome calculator
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
          <div className="w-32">
            <Select
              value={s.currency}
              onValueChange={(v) => set('currency', v as CurrencySymbol)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="₦">₦ Naira</SelectItem>
                <SelectItem value="$">$ Dollar</SelectItem>
                <SelectItem value="€">€ Euro</SelectItem>
                <SelectItem value="£">£ Pound</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={saveSnapshot} className="gap-2">
            <Save className="w-4 h-4" /> Snapshot
          </Button>
          <Sheet open={historyOpen} onOpenChange={(o) => { setHistoryOpen(o); if (o) fetchVersions(); }}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <History className="w-4 h-4" /> History
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Proposal version history</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {versions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No snapshots yet. Snapshots are created automatically every time the proposal changes.
                  </p>
                )}
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-lg border border-border/40 bg-card/40 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {v.label || new Date(v.saved_at).toLocaleString()}
                      </p>
                      {v.label && (
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(v.saved_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreVersion(v.state)}
                      className="gap-1.5 shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </Button>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          <Button onClick={handleExportPdf} className="gap-2">
            <FileDown className="w-4 h-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* INPUTS — not exported */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outreach proof</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <NumberField
              label="Number of outreaches"
              value={s.outreachCount}
              onChange={(n) => set('outreachCount', Math.max(0, Math.floor(n)))}
              hint="Initial outreach (validation phase, limited stock)"
            />
            <NumberField
              label="Revenue per outreach"
              value={s.outreachRevenue}
              onChange={(n) => set('outreachRevenue', n)}
              prefix={c}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capital structure</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <NumberField
              label="Total capital"
              value={s.capital}
              onChange={(n) => set('capital', n)}
              prefix={c}
            />
            <NumberField
              label="Ingredients / production"
              value={s.ingredients}
              onChange={(n) => set('ingredients', n)}
              prefix={c}
            />
            <NumberField
              label="Operations (logistics + outreach)"
              value={s.operations}
              onChange={(n) => set('operations', n)}
              prefix={c}
            />
            <div className="flex items-end">
              <div className="w-full rounded-lg bg-surface px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Packaging (auto)
                </p>
                <p className="text-lg font-display font-bold text-foreground">
                  {fmt(c, computed.packagingTotalCost)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DYNAMIC PRODUCTS */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Products</CardTitle>
          <Button size="sm" variant="outline" onClick={addProduct} className="gap-2">
            <Plus className="w-4 h-4" /> Add product
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 px-3 font-medium">Units</th>
                  <th className="py-2 px-3 font-medium">Cost/unit</th>
                  <th className="py-2 px-3 font-medium">Price/unit</th>
                  <th className="py-2 px-3 font-medium text-right">Revenue</th>
                  <th className="py-2 px-3 font-medium text-right">Profit</th>
                  <th className="py-2 pl-3 font-medium" />
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-border/20">
                {computed.productRows.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3">
                      <Input
                        value={p.name}
                        onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                        className="h-9"
                      />
                    </td>
                    <td className="py-2 px-3 w-24">
                      <Input
                        type="number"
                        value={p.units}
                        onChange={(e) =>
                          updateProduct(p.id, {
                            units: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          })
                        }
                        className="h-9"
                      />
                    </td>
                    <td className="py-2 px-3 w-32">
                      <Input
                        type="number"
                        value={p.costPerUnit}
                        onChange={(e) =>
                          updateProduct(p.id, { costPerUnit: Number(e.target.value) || 0 })
                        }
                        className="h-9"
                      />
                    </td>
                    <td className="py-2 px-3 w-32">
                      <Input
                        type="number"
                        value={p.pricePerUnit}
                        onChange={(e) =>
                          updateProduct(p.id, { pricePerUnit: Number(e.target.value) || 0 })
                        }
                        className="h-9"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-medium">
                      {fmt(c, p.revenue)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-medium ${p.profit >= 0 ? 'text-accent' : 'text-destructive'}`}
                    >
                      {fmt(c, p.profit)}
                    </td>
                    <td className="py-2 pl-3 w-10">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeProduct(p.id)}
                        disabled={s.products.length <= 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 pr-3 font-semibold">Totals</td>
                  <td className="pt-3 px-3 font-semibold">
                    {computed.totalUnits.toLocaleString()}
                  </td>
                  <td colSpan={2} />
                  <td className="pt-3 px-3 text-right font-semibold text-primary">
                    {fmt(c, computed.productRevenue)}
                  </td>
                  <td className="pt-3 px-3 text-right font-semibold">
                    {fmt(
                      c,
                      computed.productRows.reduce((a, r) => a + r.profit, 0),
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* PACKAGING — MOQ aware */}
      <Card className={s.packagingEnabled ? '' : 'opacity-70'}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Packaging (MOQ-based)</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {s.packagingEnabled ? 'Included' : 'Excluded'}
            </span>
            <Switch
              checked={s.packagingEnabled}
              onCheckedChange={(v) => set('packagingEnabled', v)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            If you produce fewer units than the supplier's MOQ, you still pay for
            the MOQ. Leftover packages remain as inventory for the next batch.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <NumberField
              label="Packaging MOQ"
              value={s.packagingMoq}
              onChange={(n) => set('packagingMoq', Math.max(0, Math.floor(n)))}
            />
            <NumberField
              label="Cost per package unit"
              value={s.packagingCostPerUnit}
              onChange={(n) => set('packagingCostPerUnit', n)}
              prefix={c}
            />
            <div className="rounded-lg bg-surface px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Total units produced
              </p>
              <p className="text-lg font-display font-bold text-foreground">
                {computed.totalUnits.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-surface px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Units needed
              </p>
              <p className="text-lg font-display font-bold text-foreground">
                {computed.totalUnits.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-surface px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Units paid for {computed.totalUnits < s.packagingMoq ? '(MOQ applied)' : ''}
              </p>
              <p className="text-lg font-display font-bold text-primary">
                {computed.packagingUnitsPaidFor.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-surface px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Total packaging cost
              </p>
              <p className="text-lg font-display font-bold text-foreground">
                {fmt(c, computed.packagingTotalCost)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {computed.packagingLeftover.toLocaleString()} carried as inventory
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PHASE PLAN — capital-fit & reinvestment */}
      <Card className={s.phasingEnabled ? '' : 'opacity-70'}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Capital Fit & Reinvestment Plan</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {s.phasingEnabled ? 'Included' : 'Excluded'}
            </span>
            <Switch
              checked={s.phasingEnabled}
              onCheckedChange={(v) => set('phasingEnabled', v)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            When capital can't fund manufacturing of every unit your packaging MOQ paid for,
            this models the gap and shows how Phase 1 profit reinvests to close it — so investors
            see the true full-cycle ROI, not just the partial first run.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <NumberField
              label={`Units manufactured in Phase 1 (capital-funded)`}
              value={
                s.manufacturedUnitsOverride ?? computed.totalUnits
              }
              onChange={(n) =>
                set('manufacturedUnitsOverride', Math.max(0, Math.floor(n)))
              }
              hint={`Defaults to total product units (${computed.totalUnits.toLocaleString()}). Override if capital only manufactures a subset.`}
            />
            <NumberField
              label="Phase 2 reinvestment amount"
              value={s.phase2ReinvestAmount ?? Math.max(0, computed.phase1Profit)}
              onChange={(n) => set('phase2ReinvestAmount', Math.max(0, Math.floor(n)))}
              prefix={c}
              hint={`How much of Phase 1 revenue/profit you're putting back in. Defaults to Phase 1 profit (${fmt(c, Math.max(0, computed.phase1Profit))}).`}
            />
            <NumberField
              label="Phase 2 units to manufacture"
              value={s.phase2UnitsManual ?? computed.gapUnits}
              onChange={(n) => set('phase2UnitsManual', Math.max(0, Math.floor(n)))}
              hint={`How many units that reinvestment will produce. Defaults to remaining packaged units (${computed.gapUnits.toLocaleString()}).`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {s.manufacturedUnitsOverride != null && (
              <Button variant="ghost" size="sm" onClick={() => set('manufacturedUnitsOverride', null)} className="text-xs">
                <RotateCcw className="w-3 h-3 mr-1" /> Reset Phase 1 units
              </Button>
            )}
            {s.phase2ReinvestAmount != null && (
              <Button variant="ghost" size="sm" onClick={() => set('phase2ReinvestAmount', null)} className="text-xs">
                <RotateCcw className="w-3 h-3 mr-1" /> Reset reinvestment
              </Button>
            )}
            {s.phase2UnitsManual != null && (
              <Button variant="ghost" size="sm" onClick={() => set('phase2UnitsManual', null)} className="text-xs">
                <RotateCcw className="w-3 h-3 mr-1" /> Reset Phase 2 units
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TREATMENT (360 deal toggle) */}
      <Card className={s.treatmentEnabled ? '' : 'opacity-70'}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Treatment Revenue (360 deal)</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {s.treatmentEnabled ? 'Included' : 'Excluded'}
            </span>
            <Switch
              checked={s.treatmentEnabled}
              onCheckedChange={(v) => set('treatmentEnabled', v)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Toggle off for product-only investment deals. When on, projected
            service revenue is added to the investor calculation.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <NumberField
              label="Outreach leads captured"
              value={s.outreachLeads}
              onChange={(n) => set('outreachLeads', Math.max(0, Math.floor(n)))}
            />
            <NumberField
              label="Outreach → service conversion"
              value={s.conversionRatePct}
              onChange={(n) =>
                set('conversionRatePct', Math.max(0, Math.min(100, n)))
              }
              suffix="%"
              hint={`Converted clients: ${computed.convertedClients}`}
            />
            <NumberField
              label="Avg spend per client"
              value={s.avgSpendPerClient}
              onChange={(n) => set('avgSpendPerClient', n)}
              prefix={c}
            />
          </div>
        </CardContent>
      </Card>

      {/* INVESTOR SPLIT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Investor Split</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <NumberField
            label="Investor share"
            value={s.investorPct}
            onChange={(n) => set('investorPct', n)}
            suffix="%"
          />
          <NumberField
            label="Business share"
            value={s.businessPct}
            onChange={(n) => set('businessPct', n)}
            suffix="%"
          />
        </CardContent>
      </Card>

      {/* ============== EXPORTABLE RESULTS ============== */}
      <div ref={exportRef} className="space-y-4 bg-background p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">
              Tropixa Investor Proposal
            </h2>
            <p className="text-xs text-muted-foreground">
              Generated {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Big numbers */}
        <div className="grid sm:grid-cols-3 gap-3">
          <StatTile
            label="Total Units Produced"
            value={computed.cycleUnits.toLocaleString()}
            big
          />
          <StatTile
            label="Packaging Units Paid"
            value={computed.packagingUnitsPaidFor.toLocaleString()}
            accent={
              computed.totalUnits < s.packagingMoq && s.packagingEnabled
                ? 'destructive'
                : 'muted'
            }
            big
          />
          <StatTile
            label="Total Revenue"
            value={fmt(c, computed.cycleTotalRevenue)}
            accent="primary"
            big
          />
          <StatTile label="Total Cost" value={fmt(c, computed.cycleTotalCost)} big />
          <StatTile
            label="Profit"
            value={fmt(c, computed.cycleNetProfit)}
            accent={computed.cycleNetProfit >= 0 ? 'accent' : 'destructive'}
            big
          />
          <StatTile
            label={`Investor Return (${s.investorPct}%)`}
            value={fmt(c, computed.cycleInvestorProfit)}
            accent="primary"
            big
          />
        </div>

        {/* Auto story */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">The Story</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground">{story}</p>
          </CardContent>
        </Card>

        {/* Summary table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Investor Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="[&>tr]:border-b [&>tr]:border-border/20">
                  <tr>
                    <td className="py-2.5 pr-4">Outreach Revenue</td>
                    <td className="py-2.5 pl-4 text-right font-medium">
                      {fmt(c, computed.outreachRevenue)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">
                      Product Revenue ({s.products.length} product
                      {s.products.length === 1 ? '' : 's'},{' '}
                      {computed.cycleUnits.toLocaleString()} units)
                    </td>
                    <td className="py-2.5 pl-4 text-right font-medium">
                      {fmt(c, computed.cycleProductRevenue)}
                    </td>
                  </tr>
                  {s.treatmentEnabled && (
                    <tr>
                      <td className="py-2.5 pr-4">
                        Treatment Revenue ({computed.convertedClients} clients)
                      </td>
                      <td className="py-2.5 pl-4 text-right font-medium">
                        {fmt(c, computed.treatmentRevenue)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold">Total Revenue</td>
                    <td className="py-2.5 pl-4 text-right font-semibold text-primary">
                      {fmt(c, computed.cycleTotalRevenue)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">
                      Ingredients / Production
                      {s.phasingEnabled && computed.phase2Cost > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {' '}(incl. Phase 2 reinvestment of {fmt(c, computed.phase2Cost)})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      {fmt(c, computed.cycleIngredients)}
                    </td>
                  </tr>
                  {s.packagingEnabled && (
                    <tr>
                      <td className="py-2.5 pr-4">
                        Packaging ({computed.packagingUnitsPaidFor.toLocaleString()} units
                        × {fmt(c, s.packagingCostPerUnit)})
                      </td>
                      <td className="py-2.5 pl-4 text-right">
                        {fmt(c, computed.packagingTotalCost)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2.5 pr-4">Operations</td>
                    <td className="py-2.5 pl-4 text-right">
                      {fmt(c, s.operations)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold">Total Cost</td>
                    <td className="py-2.5 pl-4 text-right font-semibold">
                      {fmt(c, computed.cycleTotalCost)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold">Profit</td>
                    <td
                      className={`py-2.5 pl-4 text-right font-semibold ${computed.cycleNetProfit >= 0 ? 'text-accent' : 'text-destructive'}`}
                    >
                      {fmt(c, computed.cycleNetProfit)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">Profit Margin</td>
                    <td className="py-2.5 pl-4 text-right">
                      {computed.cycleMargin.toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">ROI on Capital</td>
                    <td className="py-2.5 pl-4 text-right">
                      {computed.cycleRoiOnCapital.toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">
                      Investor Share ({s.investorPct}%)
                    </td>
                    <td className="py-2.5 pl-4 text-right font-medium text-primary">
                      {fmt(c, computed.cycleInvestorProfit)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">
                      Business Share ({s.businessPct}%)
                    </td>
                    <td className="py-2.5 pl-4 text-right font-medium">
                      {fmt(c, computed.cycleBusinessProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Phase Plan card removed from investor view — reinvestment math is reflected
            inside totals/story; the operator-facing inputs remain above (not exported). */}

        {/* Visuals */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue vs Cost</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-medium text-foreground">
                    {fmt(c, computed.cycleTotalRevenue)}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${(computed.cycleTotalRevenue / maxRC) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-medium text-foreground">
                    {fmt(c, computed.cycleTotalCost)}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-destructive/70 transition-all"
                    style={{ width: `${(computed.cycleTotalCost / maxRC) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profit Split</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-3 rounded-full bg-surface overflow-hidden flex">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${(Math.abs(computed.cycleInvestorProfit) / profitTotalAbs) * 100}%`,
                  }}
                />
                <div
                  className="h-full bg-accent"
                  style={{
                    width: `${(Math.abs(computed.cycleBusinessProfit) / profitTotalAbs) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Investor</span>
                  <span className="font-medium text-foreground">
                    {fmt(c, computed.cycleInvestorProfit)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                  <span className="text-muted-foreground">Business</span>
                  <span className="font-medium text-foreground">
                    {fmt(c, computed.cycleBusinessProfit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminBusinessProposal;