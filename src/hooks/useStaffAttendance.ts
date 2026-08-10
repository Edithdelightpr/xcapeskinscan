import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeInvalidate } from '@/hooks/useRealtimeInvalidate';
import { emitNotification } from '@/lib/notifications';

export type AttendanceStatus = 'signed_in' | 'signed_out' | 'absent';

export interface StartOfDayNotes {
  status?: string;
  focus?: string;
  blockers?: string;
}

export interface EndOfDayNotes {
  completed?: string;
  pending?: string;
  skipped?: string;
  daily_numbers?: string;
  continuity?: string;
}

export interface StaffAttendanceLog {
  id: string;
  staff_user_id: string;
  attendance_date: string;
  sign_in_time: string | null;
  sign_out_time: string | null;
  duration_minutes: number | null;
  location: string | null;
  status: AttendanceStatus;
  start_of_day_notes: StartOfDayNotes | null;
  end_of_day_notes: EndOfDayNotes | null;
  signed_in_by: string | null;
  signed_out_by: string | null;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from('staff_attendance_logs');

const KEY = ['staff-attendance'] as const;

const todayStr = () => new Date().toISOString().slice(0, 10);

export const useTodaysAttendance = () => {
  // Sign-in / sign-out events from any staff member appear in the live roster
  // without requiring a manual refresh.
  useRealtimeInvalidate('staff_attendance_logs', [KEY], 'rt-staff-attendance');
  return useQuery({
    queryKey: [...KEY, 'today'],
    queryFn: async (): Promise<StaffAttendanceLog[]> => {
      const { data, error } = await tbl()
        .select('*')
        .eq('attendance_date', todayStr())
        .order('sign_in_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StaffAttendanceLog[];
    },
  });
};

export const useMyAttendanceToday = (userId?: string) =>
  useQuery({
    queryKey: [...KEY, 'me', userId, todayStr()],
    enabled: !!userId,
    queryFn: async (): Promise<StaffAttendanceLog | null> => {
      const { data, error } = await tbl()
        .select('*')
        .eq('staff_user_id', userId)
        .eq('attendance_date', todayStr())
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as StaffAttendanceLog | null;
    },
  });

export const useStaffAttendanceHistory = (staffId?: string, limit = 30) =>
  useQuery({
    queryKey: [...KEY, 'history', staffId],
    enabled: !!staffId,
    queryFn: async (): Promise<StaffAttendanceLog[]> => {
      const { data, error } = await tbl()
        .select('*')
        .eq('staff_user_id', staffId)
        .order('attendance_date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as StaffAttendanceLog[];
    },
  });

/**
 * Range query used by the Attendance & Hours analytics page.
 * Returns every attendance row in the window, optionally filtered to one staff.
 */
export const useStaffAttendanceRange = (
  startDate: string,
  endDate: string,
  staffId?: string,
) => {
  useRealtimeInvalidate('staff_attendance_logs', [KEY], 'rt-staff-attendance-range');
  return useQuery({
    queryKey: [...KEY, 'range', startDate, endDate, staffId ?? 'all'],
    queryFn: async (): Promise<StaffAttendanceLog[]> => {
      let q = tbl()
        .select('*')
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('attendance_date', { ascending: false });
      if (staffId) q = q.eq('staff_user_id', staffId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as StaffAttendanceLog[];
    },
  });
};

export const useStaffSignIn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      staff_user_id: string;
      location?: string | null;
      start_of_day_notes?: StartOfDayNotes | null;
      signed_in_by?: string | null;
    }) => {
      // Debug: confirm the action is firing with the expected identifiers.
      // eslint-disable-next-line no-console
      console.log('[attendance] sign-in click', {
        actor: input.signed_in_by,
        target: input.staff_user_id,
        at: new Date().toISOString(),
      });
      // Block double sign-in: if today's row is already in `signed_in`,
      // surface a clear message instead of silently re-stamping the time.
      const { data: existing, error: existingErr } = await tbl()
        .select('id,status,sign_out_time')
        .eq('staff_user_id', input.staff_user_id)
        .eq('attendance_date', todayStr())
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (existing && existing.status === 'signed_in' && !existing.sign_out_time) {
        throw new Error('Already signed in for today.');
      }
      const { data, error } = await tbl()
        .upsert(
          {
            staff_user_id: input.staff_user_id,
            attendance_date: todayStr(),
            sign_in_time: new Date().toISOString(),
            sign_out_time: null,
            duration_minutes: null,
            status: 'signed_in' as AttendanceStatus,
            location: input.location ?? null,
            start_of_day_notes: input.start_of_day_notes ?? null,
            signed_in_by: input.signed_in_by ?? null,
            signed_out_by: null,
          },
          { onConflict: 'staff_user_id,attendance_date' },
        )
        .select()
        .single();
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[attendance] sign-in failed', error);
        throw error;
      }
      // eslint-disable-next-line no-console
      console.log('[attendance] sign-in OK', { id: data?.id });
      return data as StaffAttendanceLog;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY });
      // Broadcast to all admins so the bell lights up the moment someone
      // signs in (proxy or self). Late arrivals get a warning severity.
      const signIn = row?.sign_in_time ? new Date(row.sign_in_time) : new Date();
      const isLate = signIn.getHours() > 9 || (signIn.getHours() === 9 && signIn.getMinutes() > 15);
      void emitNotification({
        category: 'ops',
        kind: isLate ? 'sign_in_late' : 'sign_in',
        severity: isLate ? 'warning' : 'info',
        title: isLate ? 'Late sign-in' : 'Staff signed in',
        body: row?.location ? `Location: ${row.location}` : null,
        subjectUserId: row?.staff_user_id ?? null,
        targetTable: 'staff_attendance_logs',
        targetId: row?.id ?? null,
        metadata: { sign_in_time: row?.sign_in_time, signed_in_by: row?.signed_in_by },
      });
    },
  });
};

export const useStaffSignOut = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      end_of_day_notes?: EndOfDayNotes | null;
      signed_out_by?: string | null;
    }) => {
      // eslint-disable-next-line no-console
      console.log('[attendance] sign-out click', {
        actor: input.signed_out_by,
        attendanceId: input.id,
        at: new Date().toISOString(),
      });
      const { data: existing, error: fetchErr } = await tbl()
        .select('sign_in_time,sign_out_time,status,staff_user_id')
        .eq('id', input.id)
        .single();
      if (fetchErr) throw fetchErr;
      if (existing.sign_out_time || existing.status === 'signed_out') {
        throw new Error('Already signed out for today.');
      }
      const signOut = new Date();
      const duration = existing.sign_in_time
        ? Math.max(1, Math.round((signOut.getTime() - new Date(existing.sign_in_time).getTime()) / 60000))
        : null;

      const { data, error } = await tbl()
        .update({
          sign_out_time: signOut.toISOString(),
          duration_minutes: duration,
          status: 'signed_out' as AttendanceStatus,
          end_of_day_notes: input.end_of_day_notes ?? null,
          signed_out_by: input.signed_out_by ?? null,
        })
        .eq('id', input.id)
        .select()
        .single();
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[attendance] sign-out failed', error);
        throw error;
      }
      // eslint-disable-next-line no-console
      console.log('[attendance] sign-out OK', { id: data?.id, target: data?.staff_user_id });
      return data as StaffAttendanceLog;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: KEY });
      const hours = row?.duration_minutes ? Math.round((row.duration_minutes / 60) * 10) / 10 : null;
      const longShift = (row?.duration_minutes ?? 0) >= 480; // 8h+
      void emitNotification({
        category: longShift ? 'recognition' : 'ops',
        kind: 'sign_out',
        severity: longShift ? 'success' : 'info',
        title: longShift ? 'Full shift completed' : 'Staff signed out',
        body: hours != null ? `Worked ${hours}h today` : null,
        subjectUserId: row?.staff_user_id ?? null,
        targetTable: 'staff_attendance_logs',
        targetId: row?.id ?? null,
        metadata: { duration_minutes: row?.duration_minutes, signed_out_by: row?.signed_out_by },
        includeSubject: longShift,
      });
    },
  });
};