import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductSalesByStaffRow {
  staff_user_id: string;
  product_id: string;
  product_name: string | null;
  size_label: string | null;
  sale_count: number;
  paid_count: number;
  pending_count: number;
  units_sold: number;
  gross_revenue: number;
  last_sold_at: string | null;
}

/**
 * Per-(attributed_staff, product) sales aggregate.
 * Sourced from `product_sales_by_staff` view — always keys on attributed_staff_id (Sold by).
 */
export const useSalesByStaff = () =>
  useQuery({
    queryKey: ['product-sales-by-staff'],
    queryFn: async (): Promise<ProductSalesByStaffRow[]> => {
      const { data, error } = await (supabase as any)
        .from('product_sales_by_staff')
        .select('*');
      if (error) throw error;
      return (data ?? []) as ProductSalesByStaffRow[];
    },
    staleTime: 60_000,
  });