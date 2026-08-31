import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

import { Textarea } from "@imdbspy/components/Textarea";
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
        setResultMsg(
          `Added ${result.added.length} title${result.added.length !== 1 ? "s" : ""}.`,
        );
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add titles</DialogTitle>
          <DialogDescription>
            Paste one or more IMDb URLs or IDs (e.g. tt0111161), one per line.
          </DialogDescription>
        </DialogHeader>

        {/* DialogBody scrolls while the title and the Add button stay pinned —
            without it a long error list pushes both off a short viewport. */}
        <DialogBody className="space-y-4">
          <Field
            label="IMDb URLs or IDs"
            hint="One per line. A full URL or a bare tt id both work."
          >
            <Textarea
              rows={5}
              className="min-h-24"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"https://www.imdb.com/title/tt0111161/\ntt0468569"}
              disabled={addMedia.isPending}
              autoFocus
            />
          </Field>

          {resultMsg && errors.length === 0 ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[hsl(var(--category-mint)/0.5)] bg-[hsl(var(--category-mint)/0.16)] px-3 py-2 text-sm font-medium text-foreground"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {resultMsg}
            </p>
          ) : null}

          {errors.length > 0 ? (
            <div
              role="alert"
              className="space-y-1.5 rounded-[var(--radius-md)] border border-destructive/50 bg-destructive/10 px-3 py-2"
            >
              <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                {resultMsg
                  ? `${resultMsg} The following had errors:`
                  : "Could not add these titles:"}
              </p>
              <ul className="space-y-1 pl-6 text-sm text-foreground">
                {errors.map((e, i) => (
                  <li key={i}>
                    {e.url ? <strong className="font-semibold">{e.url}: </strong> : null}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogBody>

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
