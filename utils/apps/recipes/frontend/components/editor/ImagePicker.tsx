import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The recipe's images: paste a URL, or upload a file.
 *
 * Two fixes over the old markup. The upload control was a `<label>` wrapping a
 * hidden file input, which no keyboard can reach; it is now a real button that
 * clicks the input. And each thumbnail's remove control was a 17px dot in the
 * corner — below any usable target at any pointer size — replaced by a strip
 * under the image that is a full 44px on the compact shell and never drops
 * below the `Button size="sm"` rhythm on the expanded one — it deletes an
 * image, so it must not be the smallest target on the screen.
 */
export interface ImagePickerProps {
  images: string[];
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
  onUpload: (file: File) => Promise<void>;
}

export function ImagePicker({ images, onAdd, onRemove, onUpload }: ImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const runUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium leading-none">Images</legend>

      {images.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {images.map((url) => (
            <li
              key={url}
              className="w-20 overflow-hidden rounded-[var(--radius-md)] border border-border bg-card"
            >
              <img src={url} alt="" className="h-20 w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(url)}
                className={cn(
                  "flex h-11 w-full items-center justify-center border-t border-border",
                  "text-muted-foreground transition-colors app:h-8",
                  "hover:bg-destructive/10 hover:text-destructive",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                )}
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">Remove image</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          aria-label="Image URL"
          className="min-w-[10rem] flex-1"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="Paste image URL…"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (draftUrl.trim()) {
              onAdd(draftUrl.trim());
              setDraftUrl("");
            }
          }}
        >
          <ImagePlus className="h-4 w-4" />
          Add
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void runUpload(e.target.files?.[0]);
            // Re-selecting the same file must fire change again.
            e.target.value = "";
          }}
        />
      </div>
    </fieldset>
  );
}
