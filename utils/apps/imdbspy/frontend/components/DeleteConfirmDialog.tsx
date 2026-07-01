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
      <AlertDialogContent className="imdbspy-app">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from library?</AlertDialogTitle>
          <AlertDialogDescription>
            {item ? (
              <>
                This will permanently remove <strong>{item.title}</strong> and all
                associated reviews from your library.
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
