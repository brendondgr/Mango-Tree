import { Loader2 } from "lucide-react";
import type { RefObject } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One confirmation surface for both delete entry points.
 *
 * This used to render two hand-built layouts: a card-sized overlay pinned over
 * the tile with `absolute inset-0 z-10`, and an inline row in the properties
 * footer. Neither trapped focus, neither closed on Escape, and the tile variant
 * unmounted the very button the keyboard user had just activated, dropping
 * focus to the document. The shared AlertDialog gives all of that for free, and
 * removes the bespoke z-index at the same time.
 */
interface ArtifactDeleteConfirmProps {
  open: boolean;
  filename: string;
  isPending: boolean;
  error?: unknown;
  /**
   * The control that opened this dialog. Only read on close, to find out
   * whether it is still in the document.
   */
  triggerRef?: RefObject<HTMLElement | null>;
  /**
   * Focus target for when the trigger did not survive the delete. Must be an
   * element that outlives the deleted artifact — the grid container, say.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}

/** The skip link's landing pad in the app shell; outlives every workspace tab. */
function shellFallbackFocusTarget(): HTMLElement | null {
  return document.getElementById("main-content");
}

export function ArtifactDeleteConfirm({
  open,
  filename,
  isPending,
  error,
  triggerRef,
  returnFocusRef,
  onCancel,
  onConfirm,
}: ArtifactDeleteConfirmProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // A delete in flight should not be dismissed out from under itself.
        if (!next && !isPending) onCancel();
      }}
    >
      <AlertDialogContent
        // A long unbroken name (hash-named files are the norm here) or a long
        // server error would otherwise grow the box past the viewport, taking
        // Cancel and Delete off-screen with nothing to scroll.
        className="flex max-h-[calc(100dvh-2rem)] flex-col"
        onCloseAutoFocus={(event) => {
          // Radix aims its own restore at the AlertDialogTrigger, and this
          // dialog is controlled with no trigger, so its default lands focus
          // on <body> — on cancel as well as on delete. Aim it by hand: back
          // at the button that opened this while that button is still in the
          // document, and at a survivor once a successful delete has
          // unmounted it, since focus() on a detached node is a silent no-op.
          const target =
            (triggerRef?.current?.isConnected ? triggerRef.current : null) ??
            (returnFocusRef?.current?.isConnected
              ? returnFocusRef.current
              : null) ??
            shellFallbackFocusTarget();
          if (!target) return;
          event.preventDefault();
          target.focus();
        }}
      >
        {/* Header and error scroll; the footer stays pinned. */}
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete artifact?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="break-all font-medium text-foreground">
                {filename}
              </span>{" "}
              will be removed permanently. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error != null && (
            <p role="alert" className="break-words text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Could not delete this artifact."}
            </p>
          )}
        </div>

        <AlertDialogFooter className="shrink-0">
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "destructive" }))}
            disabled={isPending}
            onClick={(event) => {
              // Keep the dialog mounted while the request is in flight; the
              // delete flow closes it once the mutation resolves.
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
