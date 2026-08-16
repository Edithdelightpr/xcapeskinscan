import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");

function migrationSql(): string {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
    .filter((sql) => sql.includes("xcape_customization_usage_events"));
  expect(files.length).toBeGreaterThan(0);
  return files.join("\n");
}

const SQL = migrationSql();

describe("xcape customization usage ledger — schema contract", () => {
  it("creates the ledger with one unique row per formula snapshot", () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.xcape_customization_usage_events/);
    expect(SQL).toMatch(/formula_snapshot_id uuid NOT NULL UNIQUE/);
  });

  it("captures the required audit fields", () => {
    for (const col of [
      "assessment_id",
      "client_id",
      "cdp_org_id",
      "cdp_org_name",
      "category",
      "kit_product_id",
      "kit_name",
      "base_product_id",
      "base_product_name",
      "active_product_id",
      "active_name",
      "dose_ml",
      "companion_product_id",
      "companion_name",
      "companion_dose_ml",
      "formula_lines",
      "rule_version_id",
      "protocol_version",
      "product_catalogue_version",
      "approved_by",
      "approved_at",
      "captured_by",
      "recorded_at",
    ]) {
      expect(SQL, col).toContain(col);
    }
    expect(SQL).toContain("auth.uid()");
  });

  it("is append-only: history is preserved on conflict", () => {
    const conflicts = SQL.match(/ON CONFLICT \(formula_snapshot_id\) DO NOTHING/g) ?? [];
    expect(conflicts.length).toBeGreaterThanOrEqual(2); // trigger insert + backfill
    expect(SQL).not.toMatch(/ON CONFLICT \(formula_snapshot_id\) DO UPDATE/);
    expect(SQL).not.toMatch(/UPDATE public\.xcape_formula_snapshots/);
    expect(SQL).not.toMatch(/DELETE FROM public\.xcape_formula_snapshots/);
  });

  it("only captures approved, non-demo, CDP-origin formulas using canonical assessment data", () => {
    expect(SQL).toMatch(/NEW\.status IS DISTINCT FROM 'approved' OR COALESCE\(NEW\.is_demo, false\)/);
    expect(SQL).toMatch(/v_assessment\.origin_role IS DISTINCT FROM 'cdp'/);
    expect(SQL).toMatch(/v_org\.kind IS DISTINCT FROM 'cdp'/);
    // canonical ids come from the assessment / organization rows, not NEW.*
    expect(SQL).toMatch(/NEW\.id, v_assessment\.id, v_assessment\.client_id, v_org\.id, v_org\.name/);
  });

  it("fires on insert and on status updates", () => {
    expect(SQL).toMatch(
      /CREATE TRIGGER xcape_formula_snapshots_capture_usage\s+AFTER INSERT OR UPDATE OF status ON public\.xcape_formula_snapshots/,
    );
  });

  it("backfills existing approved CDP rows idempotently", () => {
    expect(SQL).toMatch(/FROM public\.xcape_formula_snapshots s/);
    expect(SQL).toMatch(/WHERE s\.status = 'approved'/);
    expect(SQL).toMatch(/COALESCE\(s\.is_demo, false\) = false/);
  });

  it("locks the table down: RLS on, no anon/authenticated access, service_role reads", () => {
    expect(SQL).toMatch(/ALTER TABLE public\.xcape_customization_usage_events ENABLE ROW LEVEL SECURITY/);
    expect(SQL).toMatch(/REVOKE ALL ON public\.xcape_customization_usage_events FROM PUBLIC/);
    expect(SQL).toMatch(/REVOKE ALL ON public\.xcape_customization_usage_events FROM anon/);
    expect(SQL).toMatch(/REVOKE ALL ON public\.xcape_customization_usage_events FROM authenticated/);
    expect(SQL).toMatch(/GRANT SELECT ON public\.xcape_customization_usage_events TO service_role/);
    expect(SQL).not.toMatch(/CREATE POLICY[^;]*xcape_customization_usage_events/);
  });

  it("restricts the trigger function to service_role", () => {
    expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.xcape_capture_customization_usage\(\) FROM PUBLIC/);
    expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.xcape_capture_customization_usage\(\) FROM anon/);
    expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.xcape_capture_customization_usage\(\) FROM authenticated/);
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.xcape_capture_customization_usage\(\) TO service_role/);
  });

  it("adds org/date and kit/active aggregation indexes", () => {
    expect(SQL).toMatch(/idx_xcape_cust_usage_org_date[\s\S]*\(cdp_org_id, approved_at\)/);
    expect(SQL).toMatch(/idx_xcape_cust_usage_kit_active[\s\S]*\(kit_product_id, active_product_id, category\)/);
  });
});

describe("xcape_admin_customization_usage RPC", () => {
  it("is admin-only, security definer with a fixed search_path", () => {
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.xcape_admin_customization_usage/);
    expect(SQL).toMatch(/SECURITY DEFINER\s+SET search_path = public/);
    expect(SQL).toMatch(/auth\.uid\(\) IS NOT NULL\s*\n\s*AND public\.is_admin\(auth\.uid\(\)\)/);
  });

  it("revokes PUBLIC/anon and grants authenticated + service_role", () => {
    expect(SQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.xcape_admin_customization_usage\(uuid, timestamptz, timestamptz\) FROM PUBLIC/,
    );
    expect(SQL).toMatch(
      /REVOKE ALL ON FUNCTION public\.xcape_admin_customization_usage\(uuid, timestamptz, timestamptz\) FROM anon/,
    );
    expect(SQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.xcape_admin_customization_usage\(uuid, timestamptz, timestamptz\) TO authenticated/,
    );
    expect(SQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.xcape_admin_customization_usage\(uuid, timestamptz, timestamptz\) TO service_role/,
    );
  });

  it("returns grouped dose totals with an exclusive end date", () => {
    expect(SQL).toMatch(/count\(\*\)::bigint AS approved_formula_count/);
    expect(SQL).toMatch(/sum\(COALESCE\(e\.dose_ml, 0\)\)\) AS total_dose_ml/);
    expect(SQL).toMatch(/sum\(COALESCE\(e\.companion_dose_ml, 0\)\)\) AS total_companion_dose_ml/);
    expect(SQL).toMatch(
      /sum\(COALESCE\(e\.dose_ml, 0\) \+ COALESCE\(e\.companion_dose_ml, 0\)\)\) AS total_combined_ml/,
    );
    expect(SQL).toMatch(/min\(e\.approved_at\) AS first_approved_at/);
    expect(SQL).toMatch(/max\(e\.approved_at\) AS last_approved_at/);
    expect(SQL).toMatch(/_from IS NULL OR e\.approved_at >= _from/);
    expect(SQL).toMatch(/_to IS NULL OR e\.approved_at < _to/);
    expect(SQL).toMatch(
      /GROUP BY e\.cdp_org_id, e\.category, e\.kit_product_id, e\.active_product_id, e\.companion_product_id/,
    );
  });
});

describe("generated types", () => {
  it("expose the ledger table and admin RPC", () => {
    const types = fs.readFileSync(
      path.resolve(__dirname, "../integrations/supabase/types.ts"),
      "utf8",
    );
    expect(types).toContain("xcape_customization_usage_events");
    expect(types).toContain("xcape_admin_customization_usage");
  });
});

describe("no seeded usage or Mobile Money settings", () => {
  it("migration seeds no usage rows and no momo values", () => {
    expect(SQL).not.toMatch(/INSERT INTO public\.xcape_commerce_settings/);
    const inserts = SQL.match(/INSERT INTO public\.xcape_customization_usage_events/g) ?? [];
    // only the trigger insert and the derived backfill (SELECT-based), never literal rows
    expect(inserts.length).toBe(2);
    expect(SQL).not.toMatch(/INSERT INTO public\.xcape_customization_usage_events[\s\S]{0,400}VALUES \('/);
  });
});
