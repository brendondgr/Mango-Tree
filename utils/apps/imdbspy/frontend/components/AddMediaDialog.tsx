import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { useAddMedia } from "@imdbspy/hooks/useImdbspy";

interface AddMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMediaDialog({ open, onOpenChange }: AddMediaDialogProps) {
  const addMedia = useAddMedia();
  const [text, setText] = useState("");
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Array<{ url: string; message: string }>>([]);

  useEffect(() => {
    if (!open) return;
    setText("");
    setResultMsg(null);
    setErrors([]);
  }, [open]);

  const handleSubmit = () => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    setResultMsg(null);
    setErrors([]);

    addMedia.mutate(lines, {
      onSuccess: (result) => {
        setResultMsg(`Added ${result.added.length} title${result.added.length !== 1 ? "s" : ""}.`);
        setErrors(result.errors);
        if (result.errors.length === 0 && result.added.length > 0) {
          onOpenChange(false);
        } else {
          setText("");
        }
      },
      onError: (err) => {
        setErrors([{ url: "", message: (err as Error).message }]);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="imdbspy-app max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Titles</DialogTitle>
          <DialogDescription>
            Paste one or more IMDb URLs or IDs (e.g. tt0111161), one per line.
          </DialogDescription>
        </DialogHeader>

        <div className="imdbspy-dialog-body">
          <div className="imdbspy-field">
            <Label htmlFor="imdbspy-add-urls">IMDb URLs / IDs</Label>
            <textarea
              id="imdbspy-add-urls"
              className="imdbspy-textarea"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"https://www.imdb.com/title/tt0111161/\ntt0468569"}
              disabled={addMedia.isPending}
              autoFocus
            />
          </div>

          {resultMsg && errors.length === 0 ? (
            <div className="imdbspy-success-summary">{resultMsg}</div>
          ) : null}

          {errors.length > 0 ? (
            <div className="imdbspy-error-list">
              {resultMsg ? (
                <p className="text-sm font-semibold">{resultMsg} The following had errors:</p>
              ) : null}
              {errors.map((e, i) => (
                <p key={i} className="imdbspy-error-item">
                  {e.url ? <strong>{e.url}:</strong> : null} {e.message}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addMedia.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={addMedia.isPending || !text.trim()}>
            {addMedia.isPending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
