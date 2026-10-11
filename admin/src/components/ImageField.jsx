import { useRef, useState } from "react";
import { Upload, Loader2, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "../lib/api";
import { Input } from "./Input";

// Single image: upload a file or paste a URL, with a live preview.
export default function ImageField({ value, onChange, aspect = "aspect-video", hint, testId }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await api.post("/admin/upload", body);
      onChange(data.url);
    } catch (err) {
      toast.error(apiError(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className={`relative ${aspect} w-full overflow-hidden rounded-md border border-stone-200 bg-stone-100`}>
        {value ? (
          <>
            <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <button type="button" onClick={() => onChange("")} aria-label="Remove image" className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-stone-600 hover:text-red-600 shadow"><X className="w-4 h-4" /></button>
          </>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-400 hover:text-burgundy">
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-7 h-7" />}
            <span className="text-xs">{uploading ? "Uploading..." : "Click to upload an image"}</span>
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="...or paste an image URL" className="rounded-md" data-testid={testId} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="shrink-0 inline-flex items-center gap-2 px-3 border border-stone-300 rounded-md bg-white text-xs uppercase tracking-wider text-stone-700 hover:border-gold disabled:opacity-50">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
        </button>
        <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => upload(e.target.files?.[0])} />
      </div>
      {hint && <p className="text-xs text-stone-400">{hint}</p>}
    </div>
  );
}
