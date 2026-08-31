import { create } from "zustand";

/**
 * A one-shot handoff for text that something outside the composer wants to put
 * into it — currently the empty state's suggested prompts.
 *
 * A store rather than a prop because the composer is a sibling of the message
 * list, not a child, and remounting it with a new `key` would discard any
 * attachments already staged. `consume` clears as it reads, so the same
 * suggestion can be picked twice in a row and still take effect.
 */
interface ComposerDraftState {
  pending: string | null;
  suggest: (text: string) => void;
  consume: () => string | null;
}

export const useComposerDraftStore = create<ComposerDraftState>((set, get) => ({
  pending: null,
  suggest: (text) => set({ pending: text }),
  consume: () => {
    const { pending } = get();
    if (pending !== null) set({ pending: null });
    return pending;
  },
}));
