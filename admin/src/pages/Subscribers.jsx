import { useEffect, useMemo, useState } from "react";
import { Mail, Download, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "../lib/api";
import { useAdminData } from "../AdminData";
import { formatDate, downloadCsv } from "../lib/format";
import { Card, PageHeader, EmptyState, SearchInput, Button, ConfirmDialog } from "../components/ui";

export default function Subscribers() {
  const [subs, setSubs] = useState(null);
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const { reloadStats } = useAdminData();

  useEffect(() => {
    api.get("/admin/subscribers").then(r => setSubs(r.data)).catch(err => {
      toast.error(apiError(err, "Could not load subscribers"));
      setSubs([]);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (subs || []).filter(s => !q || s.email.includes(q));
  }, [subs, query]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(filtered.map(s => s.email).join(", "));
      toast.success(`${filtered.length} emails copied`);
    } catch {
      toast.error("Clipboard not available — use Export CSV instead");
    }
  };

  const confirmRemove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/subscribers/${encodeURIComponent(removing.email)}`);
      setSubs(list => list.filter(s => s.email !== removing.email));
      toast.success(`${removing.email} unsubscribed`);
      setRemoving(null);
      reloadStats();
    } catch (err) {
      toast.error(apiError(err, "Could not remove subscriber"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="subscribers-page">
      <PageHeader
        title="Newsletter subscribers"
        subtitle={subs ? `${subs.length} people signed up from the storefront` : "Email list"}
        actions={<>
          <Button variant="secondary" onClick={copyAll} disabled={!filtered.length}><Copy className="w-4 h-4" /> Copy emails</Button>
          <Button variant="secondary" disabled={!filtered.length}
            onClick={() => downloadCsv(`aurevia-subscribers-${new Date().toISOString().slice(0, 10)}.csv`, [["Email", "Subscribed"], ...filtered.map(s => [s.email, s.subscribed_at])])}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </>}
      />

      <div className="mb-4"><SearchInput value={query} onChange={setQuery} placeholder="Search email" /></div>

      <Card className="overflow-x-auto">
        {subs === null ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Mail} title={subs.length ? "No matches" : "No subscribers yet"}
            text={subs.length ? "Try a different search." : "Sign-ups from the home page and footer newsletter forms appear here."} />
        ) : (
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Subscribed</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.email} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-900">{s.email}</td>
                  <td className="px-4 py-3 text-stone-500">{formatDate(s.subscribed_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setRemoving(s)} title="Unsubscribe" className="p-1.5 text-stone-400 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog open={Boolean(removing)} title="Remove subscriber?" message={`${removing?.email} will no longer be on your newsletter list.`}
        confirmLabel="Remove" busy={busy} onCancel={() => setRemoving(null)} onConfirm={confirmRemove} />
    </div>
  );
}
