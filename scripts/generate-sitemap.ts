// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://tropicsmedspa.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/menu", changefreq: "weekly", priority: "0.9" },
  { path: "/menu?tab=products", changefreq: "weekly", priority: "0.8" },
  { path: "/treatments", changefreq: "weekly", priority: "0.9" },
  { path: "/tropixa", changefreq: "weekly", priority: "0.8" },
  { path: "/consultation", changefreq: "monthly", priority: "0.9" },
  { path: "/book-appointment", changefreq: "monthly", priority: "0.8" },
  { path: "/schedule", changefreq: "monthly", priority: "0.7" },
];

async function fetchPublicPaths(): Promise<SitemapEntry[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return [];
  const headers = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
  const out: SitemapEntry[] = [];
  try {
    const catsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/service_categories?select=id,public_slug,public_visible,active&active=eq.true&public_visible=eq.true`,
      { headers },
    );
    if (catsRes.ok) {
      const cats = (await catsRes.json()) as Array<{ id: string; public_slug: string | null }>;
      for (const c of cats) {
        out.push({ path: `/treatments/category/${c.public_slug ?? c.id}`, changefreq: "monthly", priority: "0.7" });
      }
    }
    const svcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?select=id,public_slug,public_visible,active&active=eq.true&public_visible=eq.true`,
      { headers },
    );
    if (svcRes.ok) {
      const svcs = (await svcRes.json()) as Array<{ id: string; public_slug: string | null }>;
      for (const s of svcs) {
        out.push({ path: `/treatments/${s.public_slug ?? s.id}`, changefreq: "monthly", priority: "0.6" });
      }
    }
    const famRes = await fetch(
      `${SUPABASE_URL}/rest/v1/service_families?select=slug,public_visible&public_visible=eq.true`,
      { headers },
    );
    if (famRes.ok) {
      const fams = (await famRes.json()) as Array<{ slug: string }>;
      for (const f of fams) {
        if (f.slug) out.push({ path: `/treatments/family/${f.slug}`, changefreq: "monthly", priority: "0.7" });
      }
    }
  } catch (e) {
    console.warn("sitemap: failed to fetch public paths", e);
  }
  return out;
}

// NOTE: /report/:token pages are intentionally excluded from the sitemap and
// blocked in robots.txt — they are private, token-only Personal Report links.

function generateSitemap(items: SitemapEntry[]) {
  const urls = items.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

const dynamic = await fetchPublicPaths();
const entries = [...staticEntries, ...dynamic];
writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries — ${dynamic.length} dynamic)`);