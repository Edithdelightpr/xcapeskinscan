import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_ALIGNMENTS,
  type ProtocolAlignment,
  type ProtocolArea,
  type ProtocolCategory,
} from '@/lib/xcapeRules/protocol';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Admin-editable XCAPE product alignment (category → product → face/body).
 * The row shape is normalized so one product can serve several concerns;
 * the deterministic resolver consumes the SKU-based projection.
 */

export interface ProductAlignmentRow {
  id: string;
  category: ProtocolCategory;
  product_id: string;
  area: ProtocolArea;
  dose_multiplier: number;
  is_active: boolean;
  sort_order: number;
  product: { id: string; name: string; sku: string | null } | null;
}

const KEY = ['xcape-product-alignments'] as const;

export const useProductAlignments = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ProductAlignmentRow[]> => {
      const { data, error } = await (supabase as any)
        .from('xcape_product_alignments')
        .select('*, product:products(id,name,sku)')
        .order('category', { ascending: true })
        .order('area', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductAlignmentRow[];
    },
  });

/** Project DB rows onto the pure resolver's alignment shape. */
export const toProtocolAlignments = (rows: ProductAlignmentRow[]): ProtocolAlignment[] =>
  rows
    .filter((r) => r.product?.sku)
    .map((r) => ({
      category: r.category,
      area: r.area,
      product_sku: r.product!.sku!,
      product_name: r.product!.name,
      dose_multiplier: Number(r.dose_multiplier),
      is_active: r.is_active,
      sort_order: r.sort_order,
    }));

/**
 * Alignment for the resolver — the admin map when it is populated, the
 * confirmed default otherwise (so the protocol never silently goes blank).
 */
export const useProtocolAlignments = () => {
  const { data, isLoading } = useProductAlignments();
  const alignments = useMemo(() => {
    const mapped = toProtocolAlignments(data ?? []);
    return mapped.length > 0 ? mapped : DEFAULT_ALIGNMENTS;
  }, [data]);
  return { alignments, isLoading };
};

export interface SaveAlignmentInput {
  id?: string;
  category: ProtocolCategory;
  product_id: string;
  area: ProtocolArea;
  dose_multiplier: number;
  is_active: boolean;
  sort_order: number;
}

export const useSaveProductAlignment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveAlignmentInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { id, ...rest } = input;
      const q = id
        ? (supabase as any).from('xcape_product_alignments').update(rest).eq('id', id)
        : (supabase as any)
            .from('xcape_product_alignments')
            .insert({ ...rest, created_by: userData.user?.id ?? null });
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteProductAlignment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('xcape_product_alignments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
