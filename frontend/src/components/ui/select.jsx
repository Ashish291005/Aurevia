import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

const SelectContext = createContext(null);

export function Select({ value, onValueChange, children }) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState({});
  const rootRef = useRef(null);
  const listboxId = useId();

  const registerLabel = useCallback((itemValue, label) => {
    setLabels(prev => (prev[itemValue] === label ? prev : { ...prev, [itemValue]: label }));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const select = (v) => {
    onValueChange?.(v);
    setOpen(false);
  };

  return (
    <SelectContext.Provider value={{ value, select, open, setOpen, labels, registerLabel, listboxId }}>
      <div ref={rootRef} className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className, children, ...props }) {
  const { open, setOpen, listboxId } = useContext(SelectContext);
  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-controls={listboxId}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-11 w-full items-center justify-between border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-gold",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", open && "rotate-180")} />
    </button>
  );
}

export function SelectValue({ placeholder }) {
  const { value, labels } = useContext(SelectContext);
  const label = value ? labels[value] ?? value : null;
  return <span className={cn("truncate", !label && "text-stone-400")}>{label ?? placeholder}</span>;
}

export function SelectContent({ className, children }) {
  const { open, listboxId } = useContext(SelectContext);
  // Always rendered so items can register their labels; hidden while closed.
  return (
    <div
      id={listboxId}
      role="listbox"
      hidden={!open}
      className={cn("absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto border border-stone-200 bg-white py-1 shadow-lg", className)}
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, className, children }) {
  const ctx = useContext(SelectContext);
  const { registerLabel } = ctx;
  const selected = ctx.value === value;

  useEffect(() => {
    registerLabel(value, typeof children === "string" ? children : String(value));
  }, [value, children, registerLabel]);

  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={() => ctx.select(value)}
      className={cn(
        "relative flex cursor-pointer select-none items-center py-2 pl-8 pr-3 text-sm text-stone-700 hover:bg-stone-100 hover:text-burgundy",
        selected && "text-burgundy font-semibold",
        className
      )}
    >
      {selected && <Check className="absolute left-2.5 h-4 w-4" />}
      {children}
    </div>
  );
}
