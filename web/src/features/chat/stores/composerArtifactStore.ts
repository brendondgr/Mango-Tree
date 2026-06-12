import { create } from "zustand";

interface ComposerArtifactState {
  queue: string[];
  enqueueArtifact: (artifactId: string) => void;
  dequeueAll: () => string[];
}

export const useComposerArtifactStore = create<ComposerArtifactState>((set, get) => ({
  queue: [],

  enqueueArtifact: (artifactId) => {
    set((state) => {
      if (state.queue.includes(artifactId)) {
        return state;
      }
      return { queue: [...state.queue, artifactId] };
    });
  },

  dequeueAll: () => {
    const { queue } = get();
    set({ queue: [] });
    return queue;
  },
}));
