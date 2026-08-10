/**
 * Menu-role rules for public service selection.
 *
 * Hard rule: a booster (`menu_role === 'addon'`) can never be booked alone.
 * It must always travel with at least one eligible core service, as defined
 * by `service_addon_links`. If the core is removed, dependent boosters go too.
 */

export type ServiceMenuRole = 'core' | 'addon' | 'bundle';

export interface AddonLinkLite {
  core_service_id: string;
  addon_service_id: string;
  visible?: boolean | null;
}

export const isAddonRole = (role?: string | null) => role === 'addon';

/** Cores that this booster may legally attach to. */
export const eligibleCoreIdsFor = (addonId: string, links: AddonLinkLite[]) =>
  links.filter((l) => l.addon_service_id === addonId && l.visible !== false).map((l) => l.core_service_id);

/**
 * Drop any add-on id that has no eligible core present in the selection.
 * Order is preserved. Non-addon ids are always kept.
 */
export const sanitizeServiceSelection = (
  ids: string[],
  links: AddonLinkLite[],
  roleOf: (id: string) => string | null | undefined,
): { ids: string[]; removed: string[] } => {
  const present = new Set(ids);
  const removed: string[] = [];
  const kept = ids.filter((id) => {
    if (!isAddonRole(roleOf(id))) return true;
    const ok = eligibleCoreIdsFor(id, links).some((coreId) => present.has(coreId));
    if (!ok) removed.push(id);
    return ok;
  });
  return { ids: kept, removed };
};
