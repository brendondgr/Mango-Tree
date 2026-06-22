import { Inbox, Settings as SettingsIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { type MailboxView, useWorkspaceStore } from "@/app/stores/workspaceStore";

import { AccountSettings } from "@mailbox/components/AccountSettings";
import { InboxView } from "@mailbox/components/InboxView";

import "@mailbox/styles/mailbox.css";

const NAV: Array<{ id: MailboxView; label: string; icon: LucideIcon }> = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function MailboxWorkspace() {
  const view = useWorkspaceStore((s) => s.mailboxView);
  const setView = useWorkspaceStore((s) => s.setMailboxView);

  return (
    <div className="mailbox-app flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <nav className="flex items-center gap-1.5" aria-label="Mailbox sections">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="mailbox-tab"
                data-active={active}
                aria-current={active ? "page" : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {view === "settings" ? <AccountSettings /> : <InboxView />}
      </div>
    </div>
  );
}
