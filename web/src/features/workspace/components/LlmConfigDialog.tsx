import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LlmConfigPanel } from "@/features/workspace/components/LlmConfigPanel";

interface LlmConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LlmConfigDialog({ open, onOpenChange }: LlmConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>LLM settings</DialogTitle>
          <DialogDescription>
            Configure the OpenAI-compatible endpoint used by chat.
          </DialogDescription>
        </DialogHeader>
        <LlmConfigPanel active={open} />
      </DialogContent>
    </Dialog>
  );
}
