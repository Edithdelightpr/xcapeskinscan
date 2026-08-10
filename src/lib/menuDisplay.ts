/**
 * Menu display framework for public treatment category / family listings.
 *
 * Modes:
 *  - visual_cards : always image cards (restrained branded fallback if no image)
 *  - compact_list : always compact CTA rows (no media area)
 *  - mixed        : per-item — image card when the item has its OWN configured
 *                   image, compact row otherwise
 *  - auto         : deterministic choice based on image coverage ratio
 *
 * AUTO THRESHOLDS (deterministic, documented):
 *   ratio = items with own image / visible items
 *   ratio >= 0.8  -> visual_cards   ("all or nearly all")
 *   ratio <= 0.34 -> compact_list   ("none or a minority")
 *   otherwise     -> mixed          ("meaningful mix")
 *   0 items       -> compact_list
 */
export type MenuDisplayMode = 'auto' | 'visual_cards' | 'compact_list' | 'mixed';

export const MENU_DISPLAY_OPTIONS: Array<{ value: MenuDisplayMode; label: string }> = [
  { value: 'auto', label: 'Automatic' },
  { value: 'visual_cards', label: 'Visual cards' },
  { value: 'compact_list', label: 'Compact list' },
  { value: 'mixed', label: 'Mixed layout' },
];

export const MENU_DISPLAY_HINT =
  'Controls how the options below this page are listed: Automatic picks the best layout from how many items have their own image.';

export const normalizeMenuMode = (v: unknown): MenuDisplayMode =>
  v === 'visual_cards' || v === 'compact_list' || v === 'mixed' ? v : 'auto';

const AUTO_VISUAL_MIN = 0.8;
const AUTO_COMPACT_MAX = 0.34;

/** Resolve `auto` into a concrete mode using the item image-coverage ratio. */
export const resolveMenuMode = (
  mode: MenuDisplayMode,
  hasOwnImageFlags: boolean[],
): Exclude<MenuDisplayMode, 'auto'> => {
  if (mode !== 'auto') return mode;
  const total = hasOwnImageFlags.length;
  if (total === 0) return 'compact_list';
  const ratio = hasOwnImageFlags.filter(Boolean).length / total;
  if (ratio >= AUTO_VISUAL_MIN) return 'visual_cards';
  if (ratio <= AUTO_COMPACT_MAX) return 'compact_list';
  return 'mixed';
};

/**
 * Whether a single item renders as a visual card under the resolved mode.
 * `hasOwnImage` must reflect the item's OWN configured image field only —
 * never a category/family fallback or generated placeholder.
 */
export const itemUsesVisualCard = (
  resolved: Exclude<MenuDisplayMode, 'auto'>,
  hasOwnImage: boolean,
) => (resolved === 'visual_cards' ? true : resolved === 'mixed' ? hasOwnImage : false);
