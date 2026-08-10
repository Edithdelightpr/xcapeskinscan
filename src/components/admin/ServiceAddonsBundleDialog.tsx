import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Puzzle } from 'lucide-react';
import { toast } from 'sonner';
import { formatNaira } from '@/lib/finance';
import { useServices, type ServiceRow } from '@/hooks/useServices';
import {
  useServiceAddonLinks,
  useServiceBundleItems,
  useUpsertAddonLink,
  useDeleteAddonLink,
  useUpsertBundleItem,
  useDeleteBundleItem,
  useSetServiceMenuRole,
} from '@/hooks/useServiceMenuLinks';

interface Props {
  service: ServiceRow | null;
  onClose: () => void;
}

/**
 * Admin editor for the public menu structure of a single service:
 *  - menu role (core option / optional add-on / bundle)
 *  - which add-ons are offered under this core option (price, visibility, order)
 *  - which treatments are included in this bundle
 */
const ServiceAddonsBundleDialog = ({ service, onClose }: Props) => {
  const { data: allServices = [] } = useServices();
  const { data: links = [] } = useServiceAddonLinks(service ? { coreServiceId: service.id } : undefined);
  const { data: bundleItems = [] } = useServiceBundleItems(service ? { bundleServiceId: service.id } : undefined);
  const upsertLink = useUpsertAddonLink();
  const deleteLink = useDeleteAddonLink();
  const upsertItem = useUpsertBundleItem();
  const deleteItem = useDeleteBundleItem();
  const setRole = useSetServiceMenuRole();

  const [newAddonId, setNewAddonId] = useState('');
  const [newComponentId, setNewComponentId] = useState('');

  const sameCategory = useMemo(
    () => allServices.filter((s) => s.category_id === service?.category_id && s.id !== service?.id),
    [allServices, service],
  );
  const addonCandidates = useMemo(
    () => sameCategory.filter((s) => !links.some((l) => l.addon_service_id === s.id)),
    [sameCategory, links],
  );
  const componentCandidates = useMemo(
    () => sameCategory.filter((s) => !bundleItems.some((b) => b.component_service_id === s.id)),
    [sameCategory, bundleItems],
  );

  if (!service) return null;
  const role = service.menu_role ?? 'core';
  const nameOf = (id: string) => allServices.find((s) => s.id === id)?.name ?? 'Unknown';
  const priceOf = (id: string) => Number(allServices.find((s) => s.id === id)?.price_per_session) || 0;

  const handleRole = async (value: string) => {
    try {
      await setRole.mutateAsync({ id: service.id, menu_role: value as 'core' | 'addon' | 'bundle' });
      toast.success('Menu role updated');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const addAddon = async () => {
    if (!newAddonId) return;
    try {
      await upsertLink.mutateAsync({
        core_service_id: service.id,
        addon_service_id: newAddonId,
        sort_order: links.length,
      });
      setNewAddonId('');
      toast.success('Add-on linked');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const addComponent = async () => {
    if (!newComponentId) return;
    try {
      await upsertItem.mutateAsync({
        bundle_service_id: service.id,
        component_service_id: newComponentId,
        sort_order: bundleItems.length,
      });
      setNewComponentId('');
      toast.success('Inclusion added');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={!!service} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-primary" /> Add-ons & bundle · {service.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Menu role</Label>
            <Select value={role} onValueChange={handleRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="core">Core option — shown on the public menu</SelectItem>
                <SelectItem value="addon">Optional add-on — hidden from menus, offered under core options</SelectItem>
                <SelectItem value="bundle">Bundle — shown on the menu with its own fixed price</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Add-ons keep their own page and price; they simply stop appearing as separate menu options.
            </p>
          </div>

          {role !== 'addon' && role !== 'bundle' && (
            <div className="space-y-3">
              <Label>Optional add-ons offered with this treatment</Label>
              {links.length === 0 && (
                <p className="text-xs text-muted-foreground">No add-ons linked yet.</p>
              )}
              {links.map((l) => (
                <div key={l.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{nameOf(l.addon_service_id)}</span>
                    <Button variant="ghost" size="icon" onClick={() => deleteLink.mutate(l.id)} aria-label="Remove add-on">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <Label className="text-[11px]">Price override</Label>
                      <Input
                        type="number"
                        placeholder={String(priceOf(l.addon_service_id))}
                        defaultValue={l.price_override ?? ''}
                        onBlur={(e) =>
                          upsertLink.mutate({
                            ...l,
                            price_override: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Blank = {formatNaira(priceOf(l.addon_service_id))}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px]">Order</Label>
                      <Input
                        type="number"
                        defaultValue={l.sort_order}
                        onBlur={(e) => upsertLink.mutate({ ...l, sort_order: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-2">
                      <Switch
                        checked={l.visible}
                        onCheckedChange={(v) => upsertLink.mutate({ ...l, visible: v })}
                      />
                      <span className="text-xs text-muted-foreground">Visible</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Select value={newAddonId} onValueChange={setNewAddonId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Choose a treatment to offer as an add-on" /></SelectTrigger>
                  <SelectContent>
                    {addonCandidates.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} · {formatNaira(Number(s.price_per_session) || 0)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addAddon} disabled={!newAddonId}><Plus className="w-4 h-4 mr-1" /> Add</Button>
              </div>
            </div>
          )}

          {role === 'bundle' && (
            <div className="space-y-3">
              <Label>Treatments included in this bundle</Label>
              {bundleItems.length === 0 && (
                <p className="text-xs text-muted-foreground">No inclusions yet.</p>
              )}
              {bundleItems.map((b) => (
                <div key={b.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{nameOf(b.component_service_id)}</span>
                    <Button variant="ghost" size="icon" onClick={() => deleteItem.mutate(b.id)} aria-label="Remove inclusion">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[11px]">Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        defaultValue={b.quantity}
                        onBlur={(e) => upsertItem.mutate({ ...b, quantity: Math.max(1, Number(e.target.value) || 1) })}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Order</Label>
                      <Input
                        type="number"
                        defaultValue={b.sort_order}
                        onBlur={(e) => upsertItem.mutate({ ...b, sort_order: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Display note</Label>
                      <Input
                        defaultValue={b.display_note ?? ''}
                        onBlur={(e) => upsertItem.mutate({ ...b, display_note: e.target.value || null })}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Select value={newComponentId} onValueChange={setNewComponentId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Choose a treatment to include" /></SelectTrigger>
                  <SelectContent>
                    {componentCandidates.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} · {formatNaira(Number(s.price_per_session) || 0)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addComponent} disabled={!newComponentId}><Plus className="w-4 h-4 mr-1" /> Add</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The bundle is sold at its own price (set on the treatment record). Inclusions are display only.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceAddonsBundleDialog;
