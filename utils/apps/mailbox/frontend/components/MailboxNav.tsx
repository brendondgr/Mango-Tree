import { Inbox, Settings as SettingsIcon } from "lucide-react";

import { SegmentedControl } from "@/components/app-shell/SegmentedControl";
import { type MailboxView, useWorkspaceStore } from "@/app/stores/workspaceStore";

const SEGMENTS = [
  { value: "inbox" as MailboxView, label: "Inbox", icon: Inbox },
  { value: "settings" as MailboxView, label: "Settings", icon: SettingsIcon },
];

/**
 * Inbox / Settings switch, shared by both sections so the header rhythm does
 * not change when you move between them. Was a hand-rolled `.mailbox-tab` strip
 * with no tab semantics and no arrow-key movement.
 */
export function MailboxNav() {
  const view = useWorkspaceStore((s) => s.mailboxView);
  const setView = useWorkspaceStore((s) => s.setMailboxView);

  return (
    <SegmentedControl
      segments={SEGMENTS}
      value={view}
      onValueChange={setView}
      label="Mailbox sections"
    />
  );
}
