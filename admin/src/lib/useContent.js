import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "./api";

// CRUD + ordering for storefront content collections (slides, categories, offers).
export function useContent(kind, label) {
  const [items, setItems] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/${kind}`);
      setItems(data);
    } catch (err) {
      toast.error(apiError(err, `Could not load ${kind}`));
      setItems([]);
    }
  }, [kind]);

  useEffect(() => { load(); }, [load]);

  const save = async (item, payload) => {
    setSaving(true);
    try {
      if (item?.id) await api.put(`/admin/${kind}/${item.id}`, payload);
      else await api.post(`/admin/${kind}`, payload);
      toast.success(item?.id ? `${label} updated` : `${label} added`);
      await load();
      return true;
    } catch (err) {
      toast.error(apiError(err, `Could not save ${label.toLowerCase()}`));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    try {
      await api.delete(`/admin/${kind}/${item.id}`);
      toast.success(`${label} deleted`);
      await load();
      return true;
    } catch (err) {
      toast.error(apiError(err, "Delete failed"));
      return false;
    }
  };

  const move = async (index, delta) => {
    const target = index + delta;
    if (!items || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      const { data } = await api.post(`/admin/${kind}/reorder`, { ids: next.map(i => i.id) });
      setItems(prev => data.map(d => ({ ...prev.find(p => p.id === d.id), ...d })));
    } catch (err) {
      toast.error(apiError(err, "Could not reorder"));
      load();
    }
  };

  const toggleActive = async (item, editableFields) => {
    const payload = Object.fromEntries(editableFields.map(f => [f, item[f]]));
    await save(item, { ...payload, active: !item.active });
  };

  return { items, saving, load, save, remove, move, toggleActive };
}
