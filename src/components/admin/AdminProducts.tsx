import { useMemo, useState } from 'react';
import {
  useProducts, useProductCosts, useInventoryBatches, useProductPerformance,
  useUpsertProduct, useDeleteProduct, useAddProductCost, useProduceBatch, useRecordProductSale,
  type Product,
} from '@/hooks/useProducts';
import RecipeManager from './RecipeManager';
import ProductEditorTabs from './ProductEditorTabs';
import { useRealStaff } from '@/hooks/useRealStaff';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FinishedGoodsIntakePanel from './FinishedGoodsIntakePanel';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Factory, ShoppingCart, Download } from 'lucide-react';
import { formatNaira } from '@/lib/finance';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const blank = { name: '', category: 'product', selling_price: 0, active: true } as Partial<Product>;

const AdminProducts = () => {
  const { data: products = [] } = useProducts();
  const { data: perf = [] } = useProductPerformance();
  const { data: batches = [] } = useInventoryBatches();
  const { data: costs = [] } = useProductCosts();
  const { data: staff = [] } = useRealStaff();

  const upsert = useUpsertProduct();
  const del = useDeleteProduct();
  const addCost = useAddProductCost();
  const produce = useProduceBatch();
  const sell = useRecordProductSale();

  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [costForm, setCostForm] = useState<{
    product_id: string; batch_quantity: number; raw_material_cost: number;
    packaging_cost: number; operations_cost: number; notes: string;
  } | null>(null);
  const [produceForm, setProduceForm] = useState<{ product_id: string; quantity: number; notes: string } | null>(null);
  const [saleForm, setSaleForm] = useState<{
    product_id: string; quantity: number; unit_price: number; attributed_staff_id: string; notes: string;
  } | null>(null);

  const totals = useMemo(() => perf.reduce(
    (a, p) => ({
      revenue: a.revenue + Number(p.total_revenue || 0),
      cost: a.cost + Number(p.total_cost || 0),
      profit: a.profit + Number(p.total_profit || 0),
      produced: a.produced + Number(p.total_produced || 0),
      sold: a.sold + Number(p.total_sold || 0),
    }),
    { revenue: 0, cost: 0, profit: 0, produced: 0, sold: 0 },
  ), [perf]);

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('XCAPE — Product Performance', 14, 18);
    doc.setFontSize(10);
    doc.text(new Date().toLocaleString(), 14, 25);
    autoTable(doc, {
      startY: 32,
      head: [['Product', 'Produced', 'Sold', 'Stock', 'Cost/Unit', 'Sell', 'Revenue', 'Cost', 'Profit']],
      body: perf.map((p) => [
        p.name,
        p.total_produced,
        p.total_sold,
        p.remaining_stock,
        formatNaira(p.total_sold > 0 ? p.total_cost / p.total_sold : 0),
        formatNaira(p.selling_price),
        formatNaira(p.total_revenue),
        formatNaira(p.total_cost),
        formatNaira(p.total_profit),
      ]),
      foot: [[
        'TOTAL',
        totals.produced, totals.sold, '',
        '', '',
        formatNaira(totals.revenue), formatNaira(totals.cost), formatNaira(totals.profit),
      ]],
      styles: { fontSize: 8 },
    });
    doc.save(`product-performance-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Inventory & Products</h2>
          <p className="text-sm text-muted-foreground">Costing, production, sales — true profit per product.</p>
        </div>
        <Button onClick={exportPdf} variant="outline"><Download className="w-4 h-4 mr-2" />Export PDF</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Revenue" value={formatNaira(totals.revenue)} />
        <StatCard label="Cost" value={formatNaira(totals.cost)} />
        <StatCard label="Profit" value={formatNaira(totals.profit)} accent />
        <StatCard label="Units sold / produced" value={`${totals.sold} / ${totals.produced}`} />
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
          <TabsTrigger value="costing">Costing</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="intake">Finished Goods Intake</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* PRODUCTS TAB */}
        <TabsContent value="products" className="space-y-3">
          <Button onClick={() => setEditing({ ...blank })}><Plus className="w-4 h-4 mr-1" />New product</Button>
          <div className="border rounded-lg divide-y">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">{p.name} {!p.active && <Badge variant="outline" className="ml-2">Inactive</Badge>}</div>
                  <div className="text-xs text-muted-foreground">{p.category} · Sell {formatNaira(p.selling_price)}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSaleForm({ product_id: p.id, quantity: 1, unit_price: p.selling_price, attributed_staff_id: staff[0]?.id ?? '', notes: '' })}>
                    <ShoppingCart className="w-4 h-4 mr-1" />Sell
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete?')) del.mutate(p.id); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No products yet.</p>}
          </div>
        </TabsContent>

        {/* RECIPES TAB */}
        <TabsContent value="recipes" className="space-y-3">
          {products.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Create a product first.</p>
          ) : (
            <RecipesByProduct products={products} />
          )}
        </TabsContent>

        {/* COSTING TAB */}
        <TabsContent value="costing" className="space-y-3">
          <Button disabled={products.length === 0} onClick={() => setCostForm({
            product_id: products[0]?.id ?? '', batch_quantity: 100,
            raw_material_cost: 0, packaging_cost: 0, operations_cost: 0, notes: '',
          })}><Plus className="w-4 h-4 mr-1" />Add costing</Button>
          <div className="border rounded-lg divide-y">
            {costs.map((c) => {
              const prod = products.find((p) => p.id === c.product_id);
              return (
                <div key={c.id} className="p-3 text-sm flex justify-between">
                  <div>
                    <div className="font-medium">{prod?.name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      Batch {c.batch_quantity} · Raw {formatNaira(c.raw_material_cost)} · Pkg {formatNaira(c.packaging_cost)} · Ops {formatNaira(c.operations_cost)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatNaira(c.cost_per_unit)}/unit</div>
                    <div className="text-xs text-muted-foreground">Total {formatNaira(c.total_cost)}</div>
                  </div>
                </div>
              );
            })}
            {costs.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No costing records yet.</p>}
          </div>
        </TabsContent>

        {/* INVENTORY TAB */}
        <TabsContent value="inventory" className="space-y-3">
          <Button disabled={products.length === 0} onClick={() => setProduceForm({ product_id: products[0]?.id ?? '', quantity: 100, notes: '' })}>
            <Factory className="w-4 h-4 mr-1" />Produce batch
          </Button>
          <div className="border rounded-lg divide-y">
            {batches.map((b) => {
              const prod = products.find((p) => p.id === b.product_id);
              return (
                <div key={b.id} className="p-3 text-sm flex justify-between">
                  <div>
                    <div className="font-medium">{prod?.name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">Produced {b.quantity_produced} · Cost {formatNaira(b.cost_per_unit)}/u · {new Date(b.created_at).toLocaleDateString()}</div>
                  </div>
                  <Badge variant={b.quantity_remaining > 0 ? 'default' : 'outline'}>{b.quantity_remaining} left</Badge>
                </div>
              );
            })}
            {batches.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No batches produced yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="intake" className="space-y-3">
          <FinishedGoodsIntakePanel />
        </TabsContent>

        {/* PERFORMANCE TAB */}
        <TabsContent value="performance">
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Product</th>
                  <th className="text-right p-2">Produced</th>
                  <th className="text-right p-2">Sold</th>
                  <th className="text-right p-2">Stock</th>
                  <th className="text-right p-2">Revenue</th>
                  <th className="text-right p-2">Cost</th>
                  <th className="text-right p-2">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {perf.map((p) => (
                  <tr key={p.product_id}>
                    <td className="p-2">{p.name}</td>
                    <td className="p-2 text-right">{p.total_produced}</td>
                    <td className="p-2 text-right">{p.total_sold}</td>
                    <td className="p-2 text-right">{p.remaining_stock}</td>
                    <td className="p-2 text-right">{formatNaira(p.total_revenue)}</td>
                    <td className="p-2 text-right">{formatNaira(p.total_cost)}</td>
                    <td className="p-2 text-right font-semibold">{formatNaira(p.total_profit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted font-semibold">
                <tr>
                  <td className="p-2">TOTAL</td>
                  <td className="p-2 text-right">{totals.produced}</td>
                  <td className="p-2 text-right">{totals.sold}</td>
                  <td className="p-2 text-right">—</td>
                  <td className="p-2 text-right">{formatNaira(totals.revenue)}</td>
                  <td className="p-2 text-right">{formatNaira(totals.cost)}</td>
                  <td className="p-2 text-right">{formatNaira(totals.profit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Product editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit product' : 'New product'}</DialogTitle>
            <DialogDescription>Operational settings, public website content, and media — one source of truth.</DialogDescription>
          </DialogHeader>
          {editing && <ProductEditorTabs value={editing} onChange={setEditing} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => { if (editing?.name) { upsert.mutate(editing as any, { onSuccess: () => setEditing(null) }); } }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cost editor */}
      <Dialog open={!!costForm} onOpenChange={(o) => !o && setCostForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add costing</DialogTitle>
            <DialogDescription>Records the true cost of producing one batch.</DialogDescription></DialogHeader>
          {costForm && (
            <div className="space-y-3">
              <div><Label>Product</Label>
                <Select value={costForm.product_id} onValueChange={(v) => setCostForm({ ...costForm, product_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Batch quantity</Label><Input type="number" value={costForm.batch_quantity} onChange={(e) => setCostForm({ ...costForm, batch_quantity: Number(e.target.value) })} /></div>
                <div><Label>Raw material (₦)</Label><Input type="number" value={costForm.raw_material_cost} onChange={(e) => setCostForm({ ...costForm, raw_material_cost: Number(e.target.value) })} /></div>
                <div><Label>Packaging (₦)</Label><Input type="number" value={costForm.packaging_cost} onChange={(e) => setCostForm({ ...costForm, packaging_cost: Number(e.target.value) })} /></div>
                <div><Label>Operations (₦)</Label><Input type="number" value={costForm.operations_cost} onChange={(e) => setCostForm({ ...costForm, operations_cost: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={costForm.notes} onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })} /></div>
              <div className="text-sm text-muted-foreground">
                Cost/unit ≈ {formatNaira((costForm.raw_material_cost + costForm.packaging_cost + costForm.operations_cost) / Math.max(1, costForm.batch_quantity))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCostForm(null)}>Cancel</Button>
            <Button onClick={() => { if (costForm) addCost.mutate(costForm, { onSuccess: () => setCostForm(null) }); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Produce batch */}
      <Dialog open={!!produceForm} onOpenChange={(o) => !o && setProduceForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Produce batch</DialogTitle>
            <DialogDescription>Creates inventory using the latest costing for this product.</DialogDescription></DialogHeader>
          {produceForm && (
            <div className="space-y-3">
              <div><Label>Product</Label>
                <Select value={produceForm.product_id} onValueChange={(v) => setProduceForm({ ...produceForm, product_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Quantity</Label><Input type="number" value={produceForm.quantity} onChange={(e) => setProduceForm({ ...produceForm, quantity: Number(e.target.value) })} /></div>
              <div><Label>Notes</Label><Textarea value={produceForm.notes} onChange={(e) => setProduceForm({ ...produceForm, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProduceForm(null)}>Cancel</Button>
            <Button onClick={() => { if (produceForm) produce.mutate(produceForm, { onSuccess: () => setProduceForm(null) }); }}>Produce</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale */}
      <Dialog open={!!saleForm} onOpenChange={(o) => !o && setSaleForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record product sale</DialogTitle>
            <DialogDescription>Creates a revenue entry, deducts FIFO stock, computes profit.</DialogDescription></DialogHeader>
          {saleForm && (
            <div className="space-y-3">
              <div><Label>Product</Label>
                <Select value={saleForm.product_id} onValueChange={(v) => {
                  const p = products.find((x) => x.id === v);
                  setSaleForm({ ...saleForm, product_id: v, unit_price: p?.selling_price ?? saleForm.unit_price });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Quantity</Label><Input type="number" value={saleForm.quantity} onChange={(e) => setSaleForm({ ...saleForm, quantity: Number(e.target.value) })} /></div>
                <div><Label>Unit price (₦)</Label><Input type="number" value={saleForm.unit_price} onChange={(e) => setSaleForm({ ...saleForm, unit_price: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Attributed staff</Label>
                <Select value={saleForm.attributed_staff_id} onValueChange={(v) => setSaleForm({ ...saleForm, attributed_staff_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Notes</Label><Textarea value={saleForm.notes} onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })} /></div>
              <div className="text-sm font-medium">Total: {formatNaira(saleForm.quantity * saleForm.unit_price)}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleForm(null)}>Cancel</Button>
            <Button onClick={() => { if (saleForm && saleForm.attributed_staff_id) sell.mutate(saleForm, { onSuccess: () => setSaleForm(null) }); }}>Record sale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={`border rounded-lg p-3 ${accent ? 'bg-primary/10 border-primary/40' : ''}`}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

export default AdminProducts;

const RecipesByProduct = ({ products }: { products: Product[] }) => {
  const [pid, setPid] = useState<string>(products[0]?.id ?? '');
  const product = products.find((p) => p.id === pid) ?? products[0];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Product</label>
        <select value={pid} onChange={(e) => setPid(e.target.value)}
                className="bg-surface border rounded-md px-3 py-1.5 text-sm">
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {product && <RecipeManager product={product} />}
    </div>
  );
};