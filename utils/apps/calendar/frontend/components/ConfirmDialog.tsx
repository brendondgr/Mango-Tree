import { Loader2 } from "lucide-react";

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

/**
 * Destructive confirmation, replacing the two `window.confirm()` calls the
 * schedules view used. A native confirm cannot be themed, cannot say which
 * button is the dangerous one, is suppressible by the browser, and on several
 * mobile browsers renders a dialog the page cannot style or size — so the
 * "delete this schedule" prompt could arrive as an unreadable system sheet.
 *
 * `description` interpolates user-controlled text — a schedule filename, an
 * event title — so it is not a fixed two lines. In the header it could push the
 * footer past the dialog's max-height, leaving Cancel and Delete off screen with
 * nothing to scroll; in a `DialogBody` the long name scrolls and the buttons
 * stay pinned.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>{description}</DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
