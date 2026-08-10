import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface Product {
  id: string;
  name: string;
  category: string;
  selling_price: number;
  active: boolean;
  created_at: string;
  sku?: string | null;
  size_label?: string | null;
  unit_of_measure?: string | null;
  market_price?: number | null;
  promo_price?: number | null;
  min_price_threshold?: number | null;
  reorder_threshold?: number | null;
  inventory_tracking_enabled?: boolean;
  description?: string | null;
  // ── Public marketing layer ─────────────────────────────────────────
  short_description?: string | null;
  long_description?: string | null;
  usage_instructions?: string | null;
  ingredients_summary?: string | null;
  warnings?: string | null;
  suitable_for?: string | null;
  tagline?: string | null;
  hero_badge?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  secondary_image_url?: string | null;
  gallery_urls?: string[] | null;
  benefits?: string[] | null;
  skin_concerns?: string[] | null;
  faq?: Array<{ q: string; a: string }> | null;
  featured?: boolean;
  public_visible?: boolean;
  display_order?: number;
  public_slug?: string | null;
  frequency_of_use?: string | null;
  care_guidance?: string | null;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order' | null;
}

export interface ProductCost {
  id: string;
  product_id: string;
  batch_quantity: number;
  raw_material_cost: number;
  packaging_cost: number;
  operations_cost: number;
  total_cost: number;
  cost_per_unit: number;
  notes: string | null;
  created_at: string;
}

export interface InventoryBatch {
  id: string;
  product_id: string;
  product_cost_id: string | null;
  quantity_produced: number;
  quantity_remaining: number;
  cost_per_unit: number;
  notes: string | null;
  created_at: string;
  recipe_version_id?: string | null;
  total_batch_cost?: number | null;
  production_date?: string | null;
}

export interface ProductPerformance {
  product_id: string;
  name: string;
  category: string;
  selling_price: number;
  active: boolean;
  total_produced: number;
  total_sold: number;
  remaining_stock: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
}

export interface RecipeVersion {
  id: string;
  product_id: string;
  version_number: number;
  name: string | null;
  status: 'draft' | 'active' | 'archived';
  batch_quantity: number;
  wastage_percent: number;
  notes: string | null;
  activated_at: string | null;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_version_id: string;
  inventory_item_id: string;
  quantity: number;
  unit: string | null;
  unit_cost_snapshot: number;
}

export interface RecipeOverhead {
  id: string;
  recipe_version_id: string;
  kind: 'packaging' | 'manufacturing' | 'logistics' | 'other';
  label: string | null;
  amount: number;
}

export interface RecipeVersionCost {
  recipe_version_id: string;
  product_id: string;
  version_number: number;
  status: string;
  batch_quantity: number;
  wastage_percent: number;
  raw_material_cost: number;
  packaging_cost: number;
  manufacturing_cost: number;
  logistics_cost: number;
  other_cost: number;
  gross_batch_cost: number;
  effective_units: number;
  estimated_unit_cost: number;
}

export interface ProductPerformanceV2 {
  product_id: string;
  name: string;
  category: string;
  market_price: number | null;
  promo_price: number | null;
  min_price_threshold: number | null;
  reorder_threshold: number | null;
  active: boolean;
  units_produced: number;
  units_sold: number;
  units_remaining: number;
  asset_value_remaining: number;
  oldest_batch_at: string | null;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_margin_percent: number;
}

export const useProducts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['products'],
    enabled: !!user,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await (supabase as any)
        .from('products').select('*')
        .order('active', { ascending: false }).order('name');
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
};

export const useProductCosts = (productId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['product-costs', productId ?? 'all'],
    enabled: !!user,
    queryFn: async (): Promise<ProductCost[]> => {
      let q = (supabase as any).from('product_costs').select('*').order('created_at', { ascending: false });
      if (productId) q = q.eq('product_id', productId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProductCost[];
    },
  });
};

export const useInventoryBatches = (productId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inventory-batches', productId ?? 'all'],
    enabled: !!user,
    queryFn: async (): Promise<InventoryBatch[]> => {
      let q = (supabase as any).from('inventory_batches').select('*').order('created_at', { ascending: false });
      if (productId) q = q.eq('product_id', productId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InventoryBatch[];
    },
  });
};

export const useProductPerformance = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['product-performance'],
    enabled: !!user,
    queryFn: async (): Promise<ProductPerformance[]> => {
      const { data, error } = await (supabase as any)
        .from('product_performance').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as ProductPerformance[];
    },
  });
};

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['products'] });
  qc.invalidateQueries({ queryKey: ['product-costs'] });
  qc.invalidateQueries({ queryKey: ['inventory-batches'] });
  qc.invalidateQueries({ queryKey: ['product-performance'] });
  qc.invalidateQueries({ queryKey: ['finance-entries'] });
};

export const useUpsertProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<Product> & { name: string }) => {
      const payload: any = {
        name: p.name,
        category: p.category ?? 'product',
        selling_price: p.selling_price ?? 0,
        active: p.active ?? true,
        sku: p.sku ?? null,
        size_label: p.size_label ?? null,
        unit_of_measure: p.unit_of_measure ?? null,
        market_price: p.market_price ?? p.selling_price ?? 0,
        promo_price: p.promo_price ?? null,
        min_price_threshold: p.min_price_threshold ?? null,
        reorder_threshold: p.reorder_threshold ?? 0,
        inventory_tracking_enabled: p.inventory_tracking_enabled ?? true,
        description: p.description ?? null,
        // public marketing layer (only sent when explicitly set)
        short_description: p.short_description ?? null,
        long_description: p.long_description ?? null,
        usage_instructions: p.usage_instructions ?? null,
        ingredients_summary: p.ingredients_summary ?? null,
        warnings: p.warnings ?? null,
        suitable_for: p.suitable_for ?? null,
        tagline: p.tagline ?? null,
        hero_badge: p.hero_badge ?? null,
        image_url: p.image_url ?? null,
        thumbnail_url: p.thumbnail_url ?? null,
        secondary_image_url: p.secondary_image_url ?? null,
        gallery_urls: p.gallery_urls ?? [],
        benefits: p.benefits ?? [],
        skin_concerns: p.skin_concerns ?? [],
        faq: p.faq ?? [],
        featured: p.featured ?? false,
        public_visible: p.public_visible ?? false,
        display_order: p.display_order ?? 0,
        frequency_of_use: p.frequency_of_use ?? null,
        care_guidance: p.care_guidance ?? null,
        stock_status: p.stock_status ?? null,
      };
      if (p.id) {
        const { error } = await (supabase as any).from('products').update(payload).eq('id', p.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('products').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(qc); toast({ title: 'Product saved' }); },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(qc); toast({ title: 'Product removed' }); },
    onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });
};

export const useAddProductCost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      product_id: string; batch_quantity: number;
      raw_material_cost: number; packaging_cost: number; operations_cost: number;
      notes?: string;
    }) => {
      const { error } = await (supabase as any).from('product_costs').insert(input);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(qc); toast({ title: 'Costing recorded' }); },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });
};

export const useProduceBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { product_id: string; quantity: number; product_cost_id?: string; notes?: string }) => {
      const { data, error } = await (supabase as any).rpc('produce_inventory_batch', {
        _product_id: input.product_id,
        _quantity: input.quantity,
        _product_cost_id: input.product_cost_id ?? null,
        _notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { invalidateAll(qc); toast({ title: 'Batch produced', description: 'Inventory updated.' }); },
    onError: (e: any) => toast({ title: 'Production failed', description: e.message, variant: 'destructive' }),
  });
};

export const useRecordProductSale = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      product_id: string; quantity: number; unit_price: number;
      attributed_staff_id: string; client_id?: string; outreach_id?: string; notes?: string;
      payment_status?: 'paid' | 'pending';
      payment_method?: 'cash' | 'bank_transfer' | 'pos' | 'online';
      payment_reference?: string;
    }) => {
      if (!user) throw new Error('Not signed in');
      const total = Math.round(input.quantity * input.unit_price * 100) / 100;
      const { error } = await (supabase as any).from('finance_entries').insert({
        staff_user_id: user.id,
        kind: 'revenue',
        category: 'product_sale',
        amount: total,
        product_id: input.product_id,
        quantity: input.quantity,
        attributed_staff_id: input.attributed_staff_id,
        source_client_id: input.client_id ?? null,
        outreach_id: input.outreach_id ?? null,
        notes: input.notes ?? null,
        payment_status: input.payment_status ?? 'paid',
        payment_method: input.payment_method ?? null,
        payment_reference: input.payment_reference ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(qc); toast({ title: 'Sale recorded' }); },
    onError: (e: any) => toast({ title: 'Sale failed', description: e.message, variant: 'destructive' }),
  });
};

// ============ PHASE 2: Recipes + production batch v2 ============

export const useRecipeVersions = (productId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recipe-versions', productId ?? 'all'],
    enabled: !!user,
    queryFn: async (): Promise<RecipeVersion[]> => {
      let q = (supabase as any).from('recipe_versions').select('*')
        .order('product_id').order('version_number', { ascending: false });
      if (productId) q = q.eq('product_id', productId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RecipeVersion[];
    },
  });
};

export const useRecipeVersionCosts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recipe-version-costs'],
    enabled: !!user,
    queryFn: async (): Promise<RecipeVersionCost[]> => {
      const { data, error } = await (supabase as any).from('recipe_version_costs').select('*');
      if (error) throw error;
      return (data ?? []) as RecipeVersionCost[];
    },
  });
};

export const useRecipeIngredients = (recipeVersionId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recipe-ingredients', recipeVersionId ?? 'all'],
    enabled: !!user && !!recipeVersionId,
    queryFn: async (): Promise<RecipeIngredient[]> => {
      const { data, error } = await (supabase as any).from('recipe_ingredients')
        .select('*').eq('recipe_version_id', recipeVersionId);
      if (error) throw error;
      return (data ?? []) as RecipeIngredient[];
    },
  });
};

export const useRecipeOverheads = (recipeVersionId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recipe-overheads', recipeVersionId ?? 'all'],
    enabled: !!user && !!recipeVersionId,
    queryFn: async (): Promise<RecipeOverhead[]> => {
      const { data, error } = await (supabase as any).from('recipe_overheads')
        .select('*').eq('recipe_version_id', recipeVersionId);
      if (error) throw error;
      return (data ?? []) as RecipeOverhead[];
    },
  });
};

export const useProductPerformanceV2 = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['product-performance-v2'],
    enabled: !!user,
    queryFn: async (): Promise<ProductPerformanceV2[]> => {
      const { data, error } = await (supabase as any).from('product_performance_v2').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as ProductPerformanceV2[];
    },
  });
};

const invalidateRecipes = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['recipe-versions'] });
  qc.invalidateQueries({ queryKey: ['recipe-ingredients'] });
  qc.invalidateQueries({ queryKey: ['recipe-overheads'] });
  qc.invalidateQueries({ queryKey: ['recipe-version-costs'] });
  invalidateAll(qc);
};

export const useCreateRecipeVersion = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      name?: string;
      batch_quantity: number;
      wastage_percent?: number;
      notes?: string;
    }) => {
      const { data: existing } = await (supabase as any).from('recipe_versions')
        .select('version_number').eq('product_id', input.product_id)
        .order('version_number', { ascending: false }).limit(1);
      const next = ((existing?.[0]?.version_number as number | undefined) ?? 0) + 1;
      const { data, error } = await (supabase as any).from('recipe_versions').insert({
        product_id: input.product_id,
        version_number: next,
        name: input.name ?? `v${next}`,
        batch_quantity: input.batch_quantity,
        wastage_percent: input.wastage_percent ?? 0,
        notes: input.notes ?? null,
        created_by: user?.id ?? null,
      }).select('id').single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: () => { invalidateRecipes(qc); toast({ title: 'Recipe version created' }); },
    onError: (e: any) => toast({ title: 'Create failed', description: e.message, variant: 'destructive' }),
  });
};

export const useUpdateRecipeVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<RecipeVersion>) => {
      const { id, ...rest } = input;
      const { error } = await (supabase as any).from('recipe_versions').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateRecipes(qc),
    onError: (e: any) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });
};

export const useUpsertRecipeIngredient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RecipeIngredient> & { recipe_version_id: string; inventory_item_id: string; quantity: number }) => {
      const payload: any = {
        recipe_version_id: input.recipe_version_id,
        inventory_item_id: input.inventory_item_id,
        quantity: input.quantity,
        unit: input.unit ?? null,
        unit_cost_snapshot: input.unit_cost_snapshot ?? 0,
      };
      if (input.id) {
        const { error } = await (supabase as any).from('recipe_ingredients').update(payload).eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('recipe_ingredients').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateRecipes(qc),
    onError: (e: any) => toast({ title: 'Ingredient save failed', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteRecipeIngredient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('recipe_ingredients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateRecipes(qc),
  });
};

export const useUpsertRecipeOverhead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RecipeOverhead> & { recipe_version_id: string; kind: RecipeOverhead['kind']; amount: number }) => {
      const payload: any = {
        recipe_version_id: input.recipe_version_id,
        kind: input.kind,
        label: input.label ?? null,
        amount: input.amount,
      };
      if (input.id) {
        const { error } = await (supabase as any).from('recipe_overheads').update(payload).eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('recipe_overheads').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateRecipes(qc),
    onError: (e: any) => toast({ title: 'Overhead save failed', description: e.message, variant: 'destructive' }),
  });
};

export const useDeleteRecipeOverhead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('recipe_overheads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateRecipes(qc),
  });
};

export const useActivateRecipeVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recipe_version_id: string) => {
      const { error } = await (supabase as any).rpc('activate_recipe_version', { _recipe_version_id: recipe_version_id });
      if (error) throw error;
    },
    onSuccess: () => { invalidateRecipes(qc); toast({ title: 'Recipe activated', description: 'Ingredient unit costs locked.' }); },
    onError: (e: any) => toast({ title: 'Activate failed', description: e.message, variant: 'destructive' }),
  });
};

export const useProduceBatchV2 = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { recipe_version_id: string; quantity_produced: number; notes?: string }) => {
      const { data, error } = await (supabase as any).rpc('produce_batch_v2', {
        _recipe_version_id: input.recipe_version_id,
        _quantity_produced: input.quantity_produced,
        _notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      invalidateRecipes(qc);
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['inventory-estimates'] });
      qc.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast({ title: 'Batch produced', description: 'Inventory asset updated.' });
    },
    onError: (e: any) => toast({ title: 'Production failed', description: e.message, variant: 'destructive' }),
  });
};

// ───────────────────────────────────────────────────────────────────────────
// Public marketing layer
// ───────────────────────────────────────────────────────────────────────────

/** Anon-safe: only returns active + publicly-visible products. */
export const usePublicProducts = (opts?: { featuredOnly?: boolean; limit?: number }) =>
  useQuery({
    queryKey: ['public-products', opts?.featuredOnly ? 'featured' : 'all', opts?.limit ?? null] as const,
    queryFn: async (): Promise<Product[]> => {
      let q = (supabase as any)
        .from('products')
        .select('*')
        .eq('active', true)
        .eq('public_visible', true)
        .order('featured', { ascending: false })
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (opts?.featuredOnly) q = q.eq('featured', true);
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

export const usePublicProductBySlug = (slug?: string) =>
  useQuery({
    queryKey: ['public-product', slug] as const,
    enabled: !!slug,
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await (supabase as any)
        .from('products')
        .select('*')
        .eq('public_slug', slug)
        .eq('active', true)
        .eq('public_visible', true)
        .maybeSingle();
      if (error) throw error;
      return (data as Product) ?? null;
    },
  });

export const useUploadProductMedia = () => {
  return useMutation({
    mutationFn: async (input: { file: File; productId: string; kind: 'thumbnail' | 'hero' | 'gallery' | 'secondary' }) => {
      const ext = input.file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${input.productId}/${input.kind}/${crypto.randomUUID()}.${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from('product-media')
        .upload(path, input.file, { cacheControl: '3600', upsert: false, contentType: input.file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('product-media').getPublicUrl(path);
      return { path, url: data.publicUrl };
    },
    onError: (e: any) => toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }),
  });
};