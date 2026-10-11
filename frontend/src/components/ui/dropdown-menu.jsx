import { cloneElement, createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

const DropdownContext = createContext(null);

export function DropdownMenu({ children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={rootRef} className="relative">{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({ asChild, children }) {
  const { open, setOpen } = useContext(DropdownContext);
  const toggle = () => setOpen(!open);
  if (asChild) {
    return cloneElement(children, {
      "aria-expanded": open,
      onClick: (e) => {
        children.props.onClick?.(e);
        toggle();
      },
    });
  }
  return <button type="button" aria-expanded={open} onClick={toggle}>{children}</button>;
}

export function DropdownMenuContent({ align = "start", className, children }) {
  const { open } = useContext(DropdownContext);
  if (!open) return null;
  return (
    <div
      role="menu"
      className={cn(
        "absolute top-full z-50 mt-2 min-w-[8rem] border border-stone-200 bg-white py-1 shadow-lg",
        align === "end" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ className, onClick, ...props }) {
  const { setOpen } = useContext(DropdownContext);
  return (
    <div
      role="menuitem"
      tabIndex={-1}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      className={cn("flex cursor-pointer select-none items-center px-3 py-2 text-sm text-stone-700 hover:bg-stone-100", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className }) {
  return <div role="separator" className={cn("my-1 h-px bg-stone-200", className)} />;
}
