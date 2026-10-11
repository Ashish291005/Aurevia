import { ArrowUp, ArrowDown, Pencil, Trash2, Eye, EyeOff } from "lucide-react";

// Shared row controls for ordered storefront content: move, show/hide, edit, delete.
export default function RowActions({ index, total, item, onMove, onToggle, onEdit, onDelete, deleteDisabledReason }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button onClick={() => onMove(index, -1)} disabled={index === 0} title="Move up" aria-label="Move up" className="p-2 text-stone-400 hover:text-burgundy disabled:opacity-25"><ArrowUp className="w-4 h-4" /></button>
      <button onClick={() => onMove(index, 1)} disabled={index === total - 1} title="Move down" aria-label="Move down" className="p-2 text-stone-400 hover:text-burgundy disabled:opacity-25"><ArrowDown className="w-4 h-4" /></button>
      <button onClick={() => onToggle(item)} title={item.active ? "Visible — click to hide" : "Hidden — click to show"} aria-label={item.active ? "Hide" : "Show"}
        className={`p-2 ${item.active ? "text-emerald-700 hover:text-stone-500" : "text-stone-400 hover:text-burgundy"}`}>
        {item.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
      <button onClick={() => onEdit(item)} title="Edit" aria-label="Edit" className="p-2 text-stone-400 hover:text-burgundy"><Pencil className="w-4 h-4" /></button>
      <button onClick={() => onDelete(item)} disabled={Boolean(deleteDisabledReason)} title={deleteDisabledReason || "Delete"} aria-label="Delete"
        className="p-2 text-stone-400 hover:text-red-700 disabled:opacity-25 disabled:hover:text-stone-400"><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}
