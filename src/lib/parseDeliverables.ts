import type { Role } from '@/store/appStore';

export interface ParsedDeliverableDraft {
  /** Stable client-only id for the preview list */
  uid: string;
  title: string;
  ownerName: string;
  /** Resolved staff id if a matching staff exists */
  ownerStaffId?: string;
  ownerRole?: Role;
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

const CATEGORY_KEYWORDS: { match: RegExp; category: string }[] = [
  { match: /\b(design|logo|signage|label|branding|mockup|wireframe)\b/i, category: 'Design' },
  { match: /\b(content|video|reel|post|caption|social|narrative|copy|script)\b/i, category: 'Marketing' },
  { match: /\b(research|formulation|sample|analyze|analysis|study|investigate)\b/i, category: 'Operations' },
  { match: /\b(repair|fix|logistics|deliver|shipment|maintenance|install)\b/i, category: 'Logistics' },
  { match: /\b(invest|investor|finance|budget|pitch|fund)\b/i, category: 'Business Dev' },
  { match: /\b(client|booking|call|follow.?up|confirm|reach out)\b/i, category: 'Bookings' },
];

const PRIORITY_KEYWORDS: { match: RegExp; priority: ParsedDeliverableDraft['priority'] }[] = [
  { match: /\b(urgent|asap|critical|immediately)\b/i, priority: 'urgent' },
  { match: /\b(high priority|important|priority)\b/i, priority: 'high' },
];

const HEADING_BLOCKLIST = [
  'deliverables', 'this week', 'tasks', 'todo', 'to-do', 'agenda', 'weekly', 'goals',
];

const BULLET_PREFIX = /^[\s]*[-–—•⁃*·●▪▫◦►▸]\s+/;
const NUMBERED_PREFIX = /^[\s]*\d+[.)]\s+/;

/** Detect a "name header" line: ALL CAPS or short Title-Case line with no bullet. */
function isNameHeader(line: string): boolean {
  const trimmed = line.trim().replace(/[:：]+\s*$/, '');
  if (!trimmed) return false;
  if (BULLET_PREFIX.test(line) || NUMBERED_PREFIX.test(line)) return false;
  if (trimmed.length > 40) return false;

  const lowered = trimmed.toLowerCase();
  if (HEADING_BLOCKLIST.some((h) => lowered.includes(h))) return false;

  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 2) return false;

  // ALL CAPS (with possible spaces / & / -)
  const upperRatio = letters === letters.toUpperCase() ? 1 : 0;
  if (upperRatio === 1 && /^[A-Z][A-Z\s&\-.]+$/.test(trimmed)) return true;

  // Trailing colon = explicit owner header (e.g., "Edith:")
  if (/[:：]\s*$/.test(line.trim())) {
    const words = trimmed.split(/\s+/);
    if (words.length <= 4) return true;
  }
  return false;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(BULLET_PREFIX, '')
    .replace(NUMBERED_PREFIX, '')
    .replace(/[\s.;,]+$/, '')
    .trim();
}

function detectCategory(title: string): string | undefined {
  for (const { match, category } of CATEGORY_KEYWORDS) {
    if (match.test(title)) return category;
  }
  return undefined;
}

function detectPriority(title: string): ParsedDeliverableDraft['priority'] {
  for (const { match, priority } of PRIORITY_KEYWORDS) {
    if (match.test(title)) return priority;
  }
  return 'medium';
}

function normalizeName(name: string): string {
  return name.trim().replace(/[:：]+\s*$/, '').trim();
}

function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export interface ParseFreeformOptions {
  /** Existing staff for owner resolution (case-insensitive first-name match) */
  staff: { id: string; name: string; role: Role }[];
}

export function parseFreeformDeliverables(
  raw: string,
  options: ParseFreeformOptions,
): ParsedDeliverableDraft[] {
  const drafts: ParsedDeliverableDraft[] = [];
  if (!raw.trim()) return drafts;

  const lines = raw.split(/\r?\n/);
  let currentOwner: string | null = null;
  let counter = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (isNameHeader(line)) {
      const cleaned = normalizeName(line);
      // If the header is ALL CAPS, restore Title Case for display.
      currentOwner = cleaned === cleaned.toUpperCase() ? toTitleCase(cleaned) : cleaned;
      continue;
    }

    // Skip lines without a bullet AND without a current owner — likely meta text.
    const isBullet = BULLET_PREFIX.test(line) || NUMBERED_PREFIX.test(line);
    if (!isBullet && !currentOwner) continue;
    // Skip non-bullet lines under an owner unless they look like a sentence task (contains a verb-ish word).
    if (!isBullet && currentOwner) {
      // Heuristic: only accept short, action-y standalone lines.
      if (line.trim().length > 120) continue;
    }

    const title = cleanTitle(line);
    if (!title) continue;
    if (!currentOwner) continue; // No owner yet — drop silently.

    const matched = options.staff.find(
      (s) => s.name.toLowerCase().split(/\s+/)[0] === currentOwner!.toLowerCase().split(/\s+/)[0],
    );

    drafts.push({
      uid: `draft-${Date.now().toString(36)}-${counter++}`,
      title,
      ownerName: matched ? matched.name : currentOwner,
      ownerStaffId: matched?.id,
      ownerRole: matched?.role,
      category: detectCategory(title) ?? 'General',
      priority: detectPriority(title),
    });
  }

  return drafts;
}
