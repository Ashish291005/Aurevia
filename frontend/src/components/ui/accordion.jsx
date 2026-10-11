import { createContext, useContext, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

const AccordionContext = createContext(null);
const ItemContext = createContext(null);

// Supports type="single" (optionally collapsible) and type="multiple".
export function Accordion({ type = "single", collapsible = false, className, children }) {
  const [openValues, setOpenValues] = useState([]);

  const toggle = (value) => {
    setOpenValues(prev => {
      const isOpen = prev.includes(value);
      if (type === "multiple") return isOpen ? prev.filter(v => v !== value) : [...prev, value];
      if (isOpen) return collapsible ? [] : prev;
      return [value];
    });
  };

  return (
    <AccordionContext.Provider value={{ openValues, toggle }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({ value, className, children }) {
  const { openValues } = useContext(AccordionContext);
  return (
    <ItemContext.Provider value={{ value, open: openValues.includes(value) }}>
      <div className={cn("border-b", className)}>{children}</div>
    </ItemContext.Provider>
  );
}

export function AccordionTrigger({ className, children, ...props }) {
  const { toggle } = useContext(AccordionContext);
  const { value, open } = useContext(ItemContext);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => toggle(value)}
      className={cn("flex w-full items-center justify-between py-4 font-medium transition-all hover:underline", className)}
      {...props}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", open && "rotate-180")} />
    </button>
  );
}

export function AccordionContent({ className, children }) {
  const { open } = useContext(ItemContext);
  if (!open) return null;
  return <div className={cn("pb-4 pt-0 text-sm", className)}>{children}</div>;
}
