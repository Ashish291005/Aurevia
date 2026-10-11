import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export const Input = forwardRef(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-body text-stone-900",
        "placeholder:text-stone-400 outline-none transition-colors focus:border-gold",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
