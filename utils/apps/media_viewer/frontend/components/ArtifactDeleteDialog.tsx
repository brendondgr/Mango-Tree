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
import type { ArtifactRecord } from "@/types/mediaViewer";

interface ArtifactDeleteDialogProps {
  artifact: ArtifactRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function ArtifactDeleteDialog({
  artifact,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: ArtifactDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete artifact?</AlertDialogTitle>
          <AlertDialogDescription>
            {artifact
              ? `"${artifact.filename}" will be removed from local storage. This cannot be undone.`
              : "This artifact will be removed from local storage."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
