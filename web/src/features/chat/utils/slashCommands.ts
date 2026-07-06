/**
 * Client-side slash commands for the chat composer (see docs/tool-groups.md).
 *
 *   /tools            open the tool-toggle popover
 *   /enable <group>   enable a tool group for this chat
 *   /disable <group>  disable a tool group for this chat
 *
 * These are pure store mutations — no new endpoints. Group ids/labels are
 * validated against the fetched catalogue.
 */

import type { ToolGroupInfo } from "@/services/toolsClient";

export type SlashAction =
  | { kind: "tools" }
  | { kind: "enable"; group: string }
  | { kind: "disable"; group: string };

export interface SlashSuggestion {
  /** Display label (the completed command). */
  label: string;
  /** Secondary hint shown to the right. */
  hint: string;
  /** Text placed in the input when the suggestion is picked. */
  insert: string;
}

interface CommandDef {
  name: string;
  hint: string;
  needsGroup: boolean;
}

const COMMANDS: CommandDef[] = [
  { name: "/tools", hint: "Open the tool toggles", needsGroup: false },
  { name: "/enable", hint: "Enable a tool group", needsGroup: true },
  { name: "/disable", hint: "Disable a tool group", needsGroup: true },
];

/** True when the text is (the start of) a slash command worth intercepting. */
export function isSlashContext(text: string): boolean {
  return text.startsWith("/");
}

export function getSlashSuggestions(
  text: string,
  catalogue: ToolGroupInfo[],
  enabledGroups: string[],
): SlashSuggestion[] {
  if (!isSlashContext(text)) return [];

  const firstSpace = text.indexOf(" ");
  if (firstSpace === -1) {
    const partial = text.toLowerCase();
    return COMMANDS.filter((c) => c.name.startsWith(partial)).map((c) => ({
      label: c.name,
      hint: c.hint,
      insert: c.needsGroup ? `${c.name} ` : c.name,
    }));
  }

  const cmd = text.slice(0, firstSpace);
  const arg = text.slice(firstSpace + 1).trim().toLowerCase();
  if (cmd !== "/enable" && cmd !== "/disable") return [];

  const enabledSet = new Set(enabledGroups);
  return catalogue
    .filter((group) => {
      const matches =
        group.id.toLowerCase().startsWith(arg) ||
        group.label.toLowerCase().startsWith(arg);
      if (!matches) return false;
      // Only offer groups the command can actually change.
      return cmd === "/enable" ? !enabledSet.has(group.id) : enabledSet.has(group.id);
    })
    .map((group) => ({
      label: `${cmd} ${group.id}`,
      hint: group.label,
      insert: `${cmd} ${group.id}`,
    }));
}

export function resolveSlashCommand(
  text: string,
  catalogue: ToolGroupInfo[],
  _enabledGroups?: string[],
): SlashAction | null {
  const trimmed = text.trim();
  if (trimmed === "/tools") return { kind: "tools" };

  const match = /^\/(enable|disable)\s+(\S+)$/.exec(trimmed);
  if (!match) return null;

  const kind = match[1] as "enable" | "disable";
  const token = match[2]!.toLowerCase();
  const group = catalogue.find(
    (g) => g.id.toLowerCase() === token || g.label.toLowerCase() === token,
  );
  if (!group) return null;
  return { kind, group: group.id };
}
