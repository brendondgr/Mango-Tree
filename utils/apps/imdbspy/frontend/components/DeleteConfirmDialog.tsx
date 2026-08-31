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
import type { MediaItem } from "@/types/imdbspy";

import { useDeleteMedia } from "@imdbspy/hooks/useImdbspy";

interface DeleteConfirmDialogProps {
  item: MediaItem | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * The confirmation step for the destructive action.
 *
 * It is reached from a permanent, labelled Remove button in the card and row
 * action rows — not from an invisible hover-only overlay on the poster, which
 * is what a touch user used to hit by accident.
 */
export function DeleteConfirmDialog({ item, onOpenChange }: DeleteConfirmDialogProps) {
  const deleteMedia = useDeleteMedia();

  const handleConfirm = () => {
    if (!item) return;
    deleteMedia.mutate(item.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <AlertDialog open={item !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto sm:w-full">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from library?</AlertDialogTitle>
          <AlertDialogDescription>
            {item ? (
              <>
                This will permanently remove{" "}
                <strong className="font-semibold text-foreground">{item.title}</strong>{" "}
                and all associated reviews from your library. This cannot be undone.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMedia.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMedia.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMedia.isPending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
