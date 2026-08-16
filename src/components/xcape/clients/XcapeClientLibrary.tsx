import { useMemo, useState } from 'react';
import { homeCtaPath } from '@/lib/xcapeExperience';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ImageIcon, ImageOff, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRealClients } from '@/hooks/useRealClients';
import { Input } from '@/components/ui/input';
import { signMediaPaths, SIGNED_URL_TTL_SECONDS } from '@/hooks/useSignedMediaUrls';

interface JourneyMeta {
  assessments: number;
  lastAnalysis: string | null;
  thumbUrl: string | null;
}

/**
 * Visual skin library — the Affiliate / CDP replacement for the raw CRM table.
 * Reads the same RLS-scoped `clients`, `client_visit_assessments` and
 * `client_media` rows; only the presentation changes.
 */
const useJourneyMeta = (clientIds: string[]) =>
  useQuery({
    queryKey: ['xcape-client-journey-meta', clientIds.join(',')],
    enabled: clientIds.length > 0,
    queryFn: async (): Promise<Record<string, JourneyMeta>> => {
      const meta: Record<string, JourneyMeta> = {};
      const { data: assessments, error: assessmentsError } = await supabase
        .from('client_visit_assessments')
        .select('id, client_id, created_at')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false });
      if (assessmentsError) throw assessmentsError;
      for (const a of assessments ?? []) {
        const entry = (meta[a.client_id] ??= { assessments: 0, lastAnalysis: null, thumbUrl: null });
        entry.assessments += 1;
        entry.lastAnalysis ??= a.created_at;
      }

      // Latest non-archived captured image per client (consented storage only).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: media, error: mediaError } = await (supabase as any)
        .from('client_media')
        .select('client_id, storage_path, bucket_path, file_type, archived, created_at')
        .in('client_id', clientIds)
        .eq('archived', false)
        .order('created_at', { ascending: false });
      if (mediaError) throw mediaError;

      const firstPath: Record<string, string> = {};
      for (const m of (media ?? []) as Array<Record<string, string | null>>) {
        const cid = m.client_id as string;
        const path = (m.storage_path ?? m.bucket_path) as string | null;
        if (!cid || !path || firstPath[cid]) continue;
        if (m.file_type && m.file_type !== 'image') continue;
        firstPath[cid] = path;
      }
      const paths = Object.values(firstPath);
      if (paths.length) {
        // Throws on a signing error or a missing signed result — a retrieval
        // failure must never look like "this client has no photo".
        const byPath = await signMediaPaths(paths, SIGNED_URL_TTL_SECONDS);
        for (const [cid, path] of Object.entries(firstPath)) {
          const entry = (meta[cid] ??= { assessments: 0, lastAnalysis: null, thumbUrl: null });
          entry.thumbUrl = byPath[path] ?? null;
        }
      }
      return meta;
    },
    staleTime: (SIGNED_URL_TTL_SECONDS * 1000) / 3,
    refetchInterval: (SIGNED_URL_TTL_SECONDS * 1000) / 3,
    retry: 1,
  });

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

const XcapeClientLibrary = () => {
  const [query, setQuery] = useState('');
  const { data: clients = [], isLoading } = useRealClients();
  const ids = useMemo(() => clients.slice(0, 200).map((c) => c.id), [clients]);
  const {
    data: meta = {},
    isError: metaFailed,
    isFetching: metaFetching,
    refetch: refetchMeta,
  } = useJourneyMeta(ids);
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.full_name, c.phone, c.email, c.client_code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [clients, query]);

  return (
    <section className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone or code"
          aria-label="Search clients"
          className="h-12 rounded-full pl-10"
        />
      </div>

      {metaFailed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">
            Photos and analysis counts could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => {
              setBrokenThumbs({});
              void refetchMeta();
            }}
            disabled={metaFetching}
            className="min-h-[36px] rounded-full border border-border px-4 text-sm font-medium disabled:opacity-60"
          >
            {metaFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading your skin library…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No clients yet. Start a new analysis and the person you scan appears here.
          </p>
          <Link
            to={homeCtaPath(true)}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
          >
            + Start New Analysis
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const m = meta[c.id];
            return (
              <li key={c.id}>
                <Link
                  to={`/xcape/clients/${c.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-lg"
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                    {m?.thumbUrl && !brokenThumbs[c.id] ? (
                      <img
                        src={m.thumbUrl}
                        alt={`Latest captured skin image for ${c.full_name}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={() => setBrokenThumbs((b) => ({ ...b, [c.id]: true }))}
                      />
                    ) : (
                      <span className="flex flex-col items-center gap-2 text-muted-foreground">
                        {metaFailed || brokenThumbs[c.id] ? (
                          <ImageOff className="h-6 w-6" aria-hidden />
                        ) : (
                          <ImageIcon className="h-6 w-6" aria-hidden />
                        )}
                        <span className="text-2xl font-semibold">{initials(c.full_name ?? '?')}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <p className="truncate text-base font-semibold">{c.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {metaFailed
                        ? 'Details unavailable'
                        : `${m?.assessments ?? 0} analys${(m?.assessments ?? 0) === 1 ? 'is' : 'es'}`}
                      {!metaFailed && m?.lastAnalysis
                        ? ` · last ${new Date(m.lastAnalysis).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : ''}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium group-hover:underline">
                      View Progress <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default XcapeClientLibrary;
