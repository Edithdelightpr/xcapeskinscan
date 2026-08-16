import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");
const ALLOWED = ["cash", "bank_transfer", "pos", "online"];

function readAllMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ file: f, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8") }));
}

describe("pending_outreach_orders.payment_method source contract", () => {
  const migrations = readAllMigrations();

  it("never inserts 'mobile_money' anywhere in migration sources", () => {
    const offenders = migrations.filter((m) => m.sql.includes("mobile_money")).map((m) => m.file);
    expect(offenders).toEqual([]);
  });

  it("submit_report_momo_order inserts the allowed 'online' payment method", () => {
    const relevant = migrations.filter((m) => m.sql.includes("submit_report_momo_order"));
    expect(relevant.length).toBeGreaterThan(0);
    for (const m of relevant) {
      const insertsIntoOrders = m.sql.includes("pending_outreach_orders");
      if (!insertsIntoOrders) continue;
      expect(m.sql, m.file).toMatch(/v_client,\s*'online',/);
    }
  });

  it("keeps the constraint's allowed value set unchanged", () => {
    const constraintSql = migrations
      .map((m) => m.sql)
      .find((sql) => sql.includes("_payment_method NOT IN"));
    expect(constraintSql).toBeTruthy();
    for (const v of ALLOWED) {
      expect(constraintSql).toContain(`'${v}'`);
    }
  });
});
