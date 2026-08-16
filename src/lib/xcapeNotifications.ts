/**
 * XCAPE partner notification presentation layer.
 *
 * Historical rows carry the legacy Tropics MedSpa taxonomy (ops / hurdle /
 * recognition / finance …). Nothing is rewritten in the database — this maps
 * stored categories and kinds onto product-specific XCAPE categories, and
 * hides staff-only recognition/hurdle chatter from Affiliate / CDP surfaces.
 */

export type XcapeNotificationCategory =
  | 'analyses'
  | 'reports'
  | 'clients'
  | 'orders'
  | 'events'
  | 'account';

export const XCAPE_CATEGORY_LABEL: Record<XcapeNotificationCategory, string> = {
  analyses: 'Analyses',
  reports: 'Reports',
  clients: 'Clients & leads',
  orders: 'Orders',
  events: 'Events',
  account: 'Account',
};

/** Legacy staff taxonomy that must never surface on partner screens. */
export const LEGACY_STAFF_LABELS = [
  'Kudos',
  'Hurdle',
  'Hurdles',
  'Recognition',
  'Operations',
  'Finance',
  'Acknowledge',
  'Teammate',
];

const LEGACY_STAFF_CATEGORIES = ['hurdle', 'recognition'];
const LEGACY_STAFF_KINDS = ['kudos', 'hurdle', 'recognition', 'shoutout', 'attendance'];

export interface NotificationLike {
  category: string;
  kind: string;
  title?: string | null;
  target_table?: string | null;
}

const match = (haystack: string, needles: string[]) => needles.some((n) => haystack.includes(n));

/** Map any stored notification onto an XCAPE partner category. */
export const toXcapeCategory = (n: NotificationLike): XcapeNotificationCategory => {
  const hay = `${n.kind} ${n.category} ${n.target_table ?? ''} ${n.title ?? ''}`.toLowerCase();
  if (match(hay, ['assessment', 'analysis', 'scan'])) return 'analyses';
  if (match(hay, ['report', 'share_link', 'report_link'])) return 'reports';
  if (match(hay, ['order', 'purchase', 'checkout', 'payment', 'cart'])) return 'orders';
  if (match(hay, ['event', 'rsvp', 'invitation'])) return 'events';
  if (match(hay, ['client', 'lead'])) return 'clients';
  return 'account';
};

/**
 * Partner feed filter: hide legacy staff recognition / hurdle notifications
 * rather than relabelling them into the product.
 */
export const isPartnerNotification = (n: NotificationLike): boolean =>
  !LEGACY_STAFF_CATEGORIES.includes(n.category) &&
  !LEGACY_STAFF_KINDS.some((k) => n.kind.toLowerCase().includes(k));

/**
 * Filter chips for the partner notification centre. All / Unread are always
 * present; category chips only appear when they have matching items.
 */
export const partnerFilters = (
  items: NotificationLike[],
): { id: 'all' | 'unread' | XcapeNotificationCategory; label: string }[] => {
  const present = new Set(items.map(toXcapeCategory));
  const chips: { id: 'all' | 'unread' | XcapeNotificationCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
  ];
  (Object.keys(XCAPE_CATEGORY_LABEL) as XcapeNotificationCategory[]).forEach((c) => {
    if (present.has(c)) chips.push({ id: c, label: XCAPE_CATEGORY_LABEL[c] });
  });
  return chips;
};

export const XCAPE_EMPTY_NOTIFICATIONS =
  'You’re all caught up. New analyses, reports, orders and account updates will appear here.';
