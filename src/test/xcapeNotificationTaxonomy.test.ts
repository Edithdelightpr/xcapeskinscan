import { describe, expect, it } from 'vitest';
import {
  LEGACY_STAFF_LABELS,
  XCAPE_CATEGORY_LABEL,
  XCAPE_EMPTY_NOTIFICATIONS,
  isPartnerNotification,
  partnerFilters,
  toXcapeCategory,
} from '@/lib/xcapeNotifications';

const n = (kind: string, category = 'ops', extra: Partial<{ title: string; target_table: string }> = {}) => ({
  kind,
  category,
  title: extra.title ?? '',
  target_table: extra.target_table ?? null,
});

describe('XCAPE partner notification taxonomy', () => {
  it('maps legacy stored kinds onto XCAPE categories without rewriting rows', () => {
    expect(toXcapeCategory(n('assessment_completed'))).toBe('analyses');
    expect(toXcapeCategory(n('report_link_opened'))).toBe('reports');
    expect(toXcapeCategory(n('order_created', 'finance'))).toBe('orders');
    expect(toXcapeCategory(n('event_invitation_sent'))).toBe('events');
    expect(toXcapeCategory(n('lead_captured', 'client'))).toBe('clients');
    expect(toXcapeCategory(n('password_changed', 'system'))).toBe('account');
  });

  it('hides legacy MedSpa recognition and hurdle notifications from partners', () => {
    expect(isPartnerNotification(n('kudos', 'recognition'))).toBe(false);
    expect(isPartnerNotification(n('hurdle_raised', 'hurdle'))).toBe(false);
    expect(isPartnerNotification(n('assessment_completed'))).toBe(true);
  });

  it('only shows a category filter when it has matching items', () => {
    const ids = partnerFilters([n('assessment_completed'), n('order_created')]).map((f) => f.id);
    expect(ids).toEqual(['all', 'unread', 'analyses', 'orders']);
  });

  it('exposes no legacy staff vocabulary in its labels or empty state', () => {
    const copy = [...Object.values(XCAPE_CATEGORY_LABEL), XCAPE_EMPTY_NOTIFICATIONS].join(' ');
    for (const legacy of LEGACY_STAFF_LABELS) {
      expect(copy.toLowerCase()).not.toContain(legacy.toLowerCase());
    }
    expect(XCAPE_EMPTY_NOTIFICATIONS).toMatch(/all caught up/i);
  });
});
