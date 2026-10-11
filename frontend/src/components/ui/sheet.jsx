import { cloneElement, createContext, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

const SheetContext = createContext(null);

export function Sheet({ open, onOpenChange, children }) {
  return <SheetContext.Provider value={{ open, setOpen: onOpenChange }}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({ asChild, children }) {
  const { setOpen } = useContext(SheetContext);
  if (asChild) {
    return cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        setOpen(true);
      },
    });
  }
  return <button type="button" onClick={() => setOpen(true)}>{children}</button>;
}

const sidePosition = {
  left: "inset-y-0 left-0 h-full border-r",
  right: "inset-y-0 right-0 h-full border-l",
};

export function SheetContent({ side = "right", className, children }) {
  const { open, setOpen } = useContext(SheetContext);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, setOpen]);

  if (!open) return null;

  // Portal to <body> so ancestors with transforms/backdrop-filter (e.g. the navbar) don't clip the fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div role="dialog" aria-modal="true" className={cn("absolute max-w-[85vw] border-stone-200 bg-cream p-6 shadow-xl", sidePosition[side], className)}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 text-stone-500 hover:text-burgundy"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function SheetHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-2", className)} {...props} />;
}

export function SheetTitle({ className, children, ...props }) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props}>{children}</h2>;
}
