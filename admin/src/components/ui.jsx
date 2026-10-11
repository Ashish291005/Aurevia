import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { STATUS_META, PAYMENT_META } from "../lib/format";

export function Badge({ meta, testId }) {
  return (
    <span data-testid={testId} className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ring-inset ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

export const StatusBadge = ({ status }) => <Badge meta={STATUS_META[status] || STATUS_META.pending} testId="status-badge" />;
export const PaymentBadge = ({ status }) => <Badge meta={PAYMENT_META[status] || PAYMENT_META.unpaid} />;

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl text-stone-900">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Button({ variant = "primary", loading, className = "", children, ...props }) {
  const styles = {
    primary: "bg-burgundy text-white hover:bg-burgundy-dark",
    secondary: "border border-stone-300 bg-white text-stone-700 hover:border-gold hover:text-burgundy",
    danger: "bg-red-700 text-white hover:bg-red-800",
    ghost: "text-stone-600 hover:text-burgundy",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 text-xs tracking-[0.12em] uppercase font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className = "", children }) {
  return <div className={`bg-white border border-stone-200 rounded-lg ${className}`}>{children}</div>;
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="text-center py-16 px-6">
      {Icon && <Icon className="w-10 h-10 text-stone-300 mx-auto mb-3" />}
      <p className="font-heading text-2xl text-stone-800">{title}</p>
      {text && <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, testId }) {
  return (
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      data-testid={testId}
      className="h-10 w-full sm:w-72 border border-stone-300 rounded-md bg-white px-3 text-sm outline-none focus:border-gold"
    />
  );
}

export function Select({ value, onChange, options, className = "", ...props }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`h-10 border border-stone-300 rounded-md bg-white px-3 text-sm outline-none focus:border-gold ${className}`} {...props}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function useModalBehaviour(open, onClose, locked) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && !locked && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose, locked]);
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger = true, busy, onConfirm, onCancel }) {
  useModalBehaviour(open, onCancel, busy);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !busy && onCancel()} />
      <div role="alertdialog" aria-modal="true" className="relative bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
        <h2 className="font-heading text-2xl text-stone-900 mb-2">{title}</h2>
        <div className="text-sm text-stone-600 mb-6">{message}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy} data-testid="confirm-dialog-btn">{confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = "max-w-2xl" }) {
  useModalBehaviour(open, onClose, false);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside role="dialog" aria-modal="true" className={`absolute right-0 top-0 h-full w-full ${width} bg-stone-50 shadow-2xl flex flex-col`}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-stone-200 bg-white">
          <div className="min-w-0">
            <h2 className="font-heading text-2xl text-stone-900 truncate">{title}</h2>
            {subtitle && <div className="text-xs text-stone-500 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-stone-500 hover:text-burgundy"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="border-t border-stone-200 bg-white px-6 py-4">{footer}</div>}
      </aside>
    </div>,
    document.body
  );
}
