import { cn } from "../../lib/utils";

export function Badge({ className, ...props }) {
  return (
    <span
      className={cn("inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold font-body", className)}
      {...props}
    />
  );
}
