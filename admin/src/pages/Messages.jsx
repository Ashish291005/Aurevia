import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Mail, Trash2, Circle, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "../lib/api";
import { useAdminData } from "../AdminData";
import { formatDate, timeAgo } from "../lib/format";
import { Card, PageHeader, EmptyState, SearchInput, Button, ConfirmDialog } from "../components/ui";

export default function Messages() {
  const [messages, setMessages] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const { reloadStats } = useAdminData();

  useEffect(() => {
    api.get("/admin/messages").then(r => setMessages(r.data)).catch(err => {
      toast.error(apiError(err, "Could not load messages"));
      setMessages([]);
    });
  }, []);

  const setRead = async (m, read, silent = false) => {
    setMessages(list => list.map(x => (x.id === m.id ? { ...x, read } : x)));
    try {
      await api.patch(`/admin/messages/${m.id}`, { read });
      reloadStats();
      if (!silent) toast.success(read ? "Marked as read" : "Marked as unread");
    } catch (err) {
      setMessages(list => list.map(x => (x.id === m.id ? { ...x, read: !read } : x)));
      toast.error(apiError(err, "Update failed"));
    }
  };

  const toggleOpen = (m) => {
    setOpenId(id => (id === m.id ? null : m.id));
    if (!m.read) setRead(m, true, true);
  };

  const markAllRead = async () => {
    const unread = messages.filter(m => !m.read);
    await Promise.all(unread.map(m => api.patch(`/admin/messages/${m.id}`, { read: true }).catch(() => {})));
    setMessages(list => list.map(m => ({ ...m, read: true })));
    reloadStats();
    toast.success(`${unread.length} marked as read`);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/messages/${deleting.id}`);
      setMessages(list => list.filter(m => m.id !== deleting.id));
      toast.success("Message deleted");
      setDeleting(null);
      reloadStats();
    } catch (err) {
      toast.error(apiError(err, "Delete failed"));
    } finally {
      setBusy(false);
    }
  };

  const unreadCount = (messages || []).filter(m => !m.read).length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (messages || []).filter(m =>
      (filter === "all" || (filter === "unread" ? !m.read : m.read)) &&
      (!q || m.name.toLowerCase().includes(q) || m.email.includes(q) || m.message.toLowerCase().includes(q))
    );
  }, [messages, filter, query]);

  return (
    <div data-testid="messages-page">
      <PageHeader
        title="Messages"
        subtitle="Enquiries sent through the storefront contact form."
        actions={unreadCount > 0 && <Button variant="secondary" onClick={markAllRead}><CheckCheck className="w-4 h-4" /> Mark all read</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-4">
        <div className="flex rounded-md border border-stone-300 bg-white overflow-hidden text-sm">
          {[["all", "All"], ["unread", `Unread (${unreadCount})`], ["read", "Read"]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 h-10 ${filter === key ? "bg-burgundy text-white" : "text-stone-600 hover:bg-stone-50"}`}>{label}</button>
          ))}
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search messages" />
      </div>

      <Card>
        {messages === null ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading messages...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={MessageSquare} title={messages.length ? "Nothing here" : "No messages yet"}
            text={messages.length ? "No messages match this filter." : "Messages from the contact page will arrive here."} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {filtered.map(m => {
              const open = openId === m.id;
              return (
                <li key={m.id} data-testid={`message-${m.id}`}>
                  <button onClick={() => toggleOpen(m)} aria-expanded={open} className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-stone-50">
                    <Circle className={`w-2.5 h-2.5 mt-1.5 shrink-0 ${m.read ? "text-transparent" : "text-burgundy fill-burgundy"}`} aria-label={m.read ? "Read" : "Unread"} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className={`truncate ${m.read ? "text-stone-700" : "text-stone-900 font-semibold"}`}>{m.name} <span className="font-normal text-xs text-stone-400">{m.email}</span></p>
                        <span className="text-xs text-stone-400 whitespace-nowrap" title={formatDate(m.submitted_at, true)}>{timeAgo(m.submitted_at)}</span>
                      </div>
                      <p className={`text-sm text-stone-500 ${open ? "whitespace-pre-wrap text-stone-700 mt-2" : "truncate"}`}>{m.message}</p>
                    </div>
                  </button>
                  {open && (
                    <div className="flex flex-wrap gap-2 px-4 pb-4 pl-10">
                      <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Aurevia")}`}
                        className="inline-flex items-center gap-2 h-9 px-3 text-xs uppercase tracking-wider font-semibold bg-burgundy text-white hover:bg-burgundy-dark">
                        <Mail className="w-4 h-4" /> Reply by email
                      </a>
                      <Button variant="secondary" className="h-9" onClick={() => setRead(m, !m.read)}>{m.read ? "Mark unread" : "Mark read"}</Button>
                      <Button variant="ghost" className="h-9 text-red-700 hover:text-red-800" onClick={() => setDeleting(m)}><Trash2 className="w-4 h-4" /> Delete</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog open={Boolean(deleting)} title="Delete message?" message={`The message from ${deleting?.name} will be permanently deleted.`}
        confirmLabel="Delete" busy={busy} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />
    </div>
  );
}
