import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  ENGINE_VARIABLE_KEYS, ENGINE_VARIABLE_LABEL, ENGINE_VARIABLE_DESCRIPTION,
  STAGE_TABLE,
} from '@/lib/skinEngine';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * XCAPE Scoring Standard — read-only reference rendered directly from the
 * live analysis engine tables (src/lib/skinEngine.ts). No engine logic is
 * modified here; this page only exposes the existing standard.
 */
const XcapeAdminScoring = () => {
  const [selectedBand, setSelectedBand] = useState<Record<string, string>>({});

  const bandReference = STAGE_TABLE[ENGINE_VARIABLE_KEYS[0]];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto space-y-6">
      <Helmet>
        <title>XCAPE Scoring Standard — XCAPE</title>
      </Helmet>
      <XcapePageHeader
        title="XCAPE Scoring Standard"
        description="Reference view of the Tropical Skin Analysis Standard, read directly from the live analysis engine. Scores run 0–100; a higher score means greater stability. Concern burden = 100 − score."
      />

      {/* Universal band scale */}
      <section className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <h2 className="text-sm font-semibold text-foreground">Stability bands</h2>
          <p className="text-xs text-muted-foreground mt-0.5">The shared scale applied to every scored variable.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left">
                <th className="px-5 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Range</th>
                <th className="px-5 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Stage</th>
                <th className="px-5 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {bandReference.map((s) => (
                <tr key={s.band}>
                  <td className="px-5 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">{s.range[0]}–{s.range[1]}</td>
                  <td className="px-5 py-2.5 text-xs text-foreground whitespace-nowrap">{s.stage}</td>
                  <td className="px-5 py-2.5 text-xs text-muted-foreground">{s.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Per-variable language */}
      {ENGINE_VARIABLE_KEYS.map((key) => {
        const stages = STAGE_TABLE[key];
        const current = stages.find((s) => s.band === (selectedBand[key] ?? stages[0].band)) ?? stages[0];
        return (
          <section key={key} className="glass rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-foreground">{ENGINE_VARIABLE_LABEL[key]}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{ENGINE_VARIABLE_DESCRIPTION[key]}</p>
              </div>
              <Select
                value={current.band}
                onValueChange={(v) => setSelectedBand((prev) => ({ ...prev, [key]: v }))}
              >
                <SelectTrigger className="w-[240px] bg-surface border-border/60 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.band} value={s.band} className="text-xs">
                      {s.range[0]}–{s.range[1]} · {s.stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-5 grid md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-semibold">Findings language</p>
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-0.5">Analysis</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{current.analysis}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-0.5">Impact</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{current.impact}</p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-accent font-semibold">Direction language</p>
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-0.5">Call to action</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{current.call_to_action}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-0.5">Treatment direction</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{current.treatment_direction}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-foreground mb-0.5">Home-care direction</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{current.home_care_direction}</p>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default XcapeAdminScoring;
