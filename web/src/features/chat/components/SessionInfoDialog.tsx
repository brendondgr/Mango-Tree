import { useLlmConfigStore } from "@/app/stores/llmConfigStore";
import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SessionInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SessionInfoDialog({ open, onOpenChange }: SessionInfoDialogProps) {
  const chatSessionId = useWorkspaceStore((s) => s.chatSessionId);
  const messages = useWorkspaceStore((s) => s.messages);
  const isTyping = useWorkspaceStore((s) => s.isTyping);
  const llmConfig = useLlmConfigStore((s) => s.config);

  const userCount = messages.filter((message) => message.role === "user").length;
  const agentCount = messages.filter((message) => message.role === "agent").length;
  const startedAt =
    messages.length > 0
      ? formatTimestamp(messages[0]!.timestamp)
      : "Not started";

  const rows = [
    { label: "Session ID", value: chatSessionId },
    { label: "Started", value: startedAt },
    {
      label: "Messages",
      value: `${messages.length} total (${userCount} user, ${agentCount} agent)`,
    },
    { label: "Status", value: isTyping ? "Generating…" : "Idle" },
    { label: "Model", value: llmConfig.model },
    { label: "Endpoint", value: llmConfig.baseUrl },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session info</DialogTitle>
          <DialogDescription>
            Local chat session details for this workspace.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-3 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="break-all font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
