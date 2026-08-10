import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BRAND } from '@/lib/brand';

export interface PublicHoursRow {
  days: string;
  time: string;
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "09:00:00" or "09:00" → "9:00am" */
const fmtTime = (t: string): string => {
  const [hStr, mStr] = t.slice(0, 5).split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
};

interface Row {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  is_24h: boolean;
}

/**
 * Collapse per-day business hours into human-readable groupings for the
 * public footer. Consecutive days with identical open/close windows are
 * merged (e.g. "Tue – Sun · 9:00am – 9:00pm").
 */
const groupHours = (rows: Row[]): PublicHoursRow[] => {
  // Ensure Monday-first display order (Mon=1 ... Sun=0 → 7).
  const ordered = [...rows].sort((a, b) => {
    const ai = a.day_of_week === 0 ? 7 : a.day_of_week;
    const bi = b.day_of_week === 0 ? 7 : b.day_of_week;
    return ai - bi;
  });

  const signatureFor = (r: Row): string => {
    if (!r.is_open) return 'closed';
    if (r.is_24h) return 'open_24h';
    return `${r.open_time}-${r.close_time}`;
  };

  const readable = (r: Row): string => {
    if (!r.is_open) return 'Closed';
    if (r.is_24h) return 'Open 24 hours';
    return `${fmtTime(r.open_time)} – ${fmtTime(r.close_time)}`;
  };

  const out: PublicHoursRow[] = [];
  let groupStart = 0;
  for (let i = 0; i <= ordered.length; i++) {
    const cur = ordered[i];
    const prev = ordered[i - 1];
    const breakGroup = !cur || !prev || signatureFor(cur) !== signatureFor(prev);
    if (breakGroup && prev) {
      const firstDay = ordered[groupStart];
      const lastDay = prev;
      const days =
        firstDay.day_of_week === lastDay.day_of_week
          ? DAY_SHORT[firstDay.day_of_week]
          : `${DAY_SHORT[firstDay.day_of_week]} – ${DAY_SHORT[lastDay.day_of_week]}`;
      out.push({ days, time: readable(firstDay) });
      groupStart = i;
    }
  }
  return out;
};

/**
 * Fetch business hours for public display. Falls back to `BRAND.hours` when
 * the table is empty, unavailable, or the query errors out so the footer
 * never renders blank.
 */
export const usePublicBusinessHours = () => {
  return useQuery({
    queryKey: ['public-business-hours'],
    staleTime: 60_000 * 10,
    queryFn: async (): Promise<PublicHoursRow[]> => {
      try {
        const { data, error } = await supabase
          .from('business_hours')
          .select('day_of_week,is_open,open_time,close_time,is_24h')
          .order('day_of_week');
        if (error) throw error;
        const rows = (data ?? []) as Row[];
        if (rows.length === 0) return BRAND.hours;
        const grouped = groupHours(rows);
        return grouped.length > 0 ? grouped : BRAND.hours;
      } catch {
        return BRAND.hours;
      }
    },
  });
};