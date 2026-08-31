import { useWorkspaceStore } from "@/app/stores/workspaceStore";

import { AccountSettings } from "@mailbox/components/AccountSettings";
import { InboxView } from "@mailbox/components/InboxView";

import "@mailbox/styles/mailbox.css";

/**
 * Mailbox root.
 *
 * `containerType: inline-size` here is what lets everything below size itself
 * against the PANE rather than the viewport. The mailbox renders inside a
 * workspace pane the user narrows by dragging the chat sidebar open, so a
 * viewport media query answers the wrong question: at 1280px wide the pane can
 * still be 380px.
 *
 * It is the outermost container, not the only one. `@[45rem]:` resolves against
 * the NEAREST container ancestor, so a column that has to size itself by its own
 * width — the message list, the reading pane, the account form — establishes one
 * of its own. Measuring those off this element measures the whole workspace,
 * list column and docked customize panel included, which is how the reading pane
 * came to show Back and Close at once.
 */
export function MailboxWorkspace() {
  const view = useWorkspaceStore((s) => s.mailboxView);

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
      style={{ containerType: "inline-size" }}
    >
      {view === "settings" ? <AccountSettings /> : <InboxView />}
    </div>
  );
}
