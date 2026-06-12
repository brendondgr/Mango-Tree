import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ChatAttachment } from "@/features/chat/types/attachment";
import type { WorkspaceTabId } from "@/features/workspace/components/workspaceTabs";
import type { LlmUsage } from "@/services/llmTypes";

export type { ChatAttachment } from "@/features/chat/types/attachment";
export type MessageRole = "user" | "agent";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  attachments?: ChatAttachment[];
  thinking?: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export const SIDEBAR_DEFAULT = 360;
export const MAIN_PANEL_MIN = 200;

export function getSidebarMaxWidth(): number {
  if (typeof window === "undefined") return 1200;
  return Math.max(0, window.innerWidth - MAIN_PANEL_MIN);
}

export function clampSidebarWidth(width: number, maxWidth?: number): number {
  const max = maxWidth ?? getSidebarMaxWidth();
  return Math.max(0, Math.min(max, width));
}

function newChatSessionId(): string {
  return crypto.randomUUID();
}

export type SidebarMode = "chat" | "artifacts";

interface WorkspaceState {
  sidebarWidth: number;
  mobileDrawerOpen: boolean;
  lastWidth: number;
  isTyping: boolean;
  activeTab: WorkspaceTabId;
  sidebarMode: SidebarMode;
  selectedArtifactId: string | null;
  artifactNotice: string | null;
  chatSessionId: string;
  messages: ChatMessage[];
  lastKnownUsage: LlmUsage | null;
  setSidebarWidth: (width: number, maxWidth?: number) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  setLastWidth: (width: number) => void;
  setIsTyping: (typing: boolean) => void;
  setActiveTab: (tab: WorkspaceTabId) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setSelectedArtifactId: (id: string | null) => void;
  setArtifactNotice: (message: string | null) => void;
  expandSidebar: () => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp"> & { id?: string }) => string;
  appendToMessage: (
    id: string,
    delta: { content?: string; thinking?: string },
  ) => void;
  updateMessage: (
    id: string,
    update: Partial<
      Pick<ChatMessage, "content" | "thinking" | "isStreaming" | "attachments">
    >,
  ) => void;
  setLastKnownUsage: (usage: LlmUsage | null) => void;
  startNewChat: () => void;
  clearMessages: () => void;
  toggleSidebar: (mobile: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      sidebarWidth: SIDEBAR_DEFAULT,
      mobileDrawerOpen: false,
      lastWidth: SIDEBAR_DEFAULT,
      isTyping: false,
      activeTab: "overview",
      sidebarMode: "chat",
      selectedArtifactId: null,
      artifactNotice: null,
      chatSessionId: newChatSessionId(),
      messages: [],
      lastKnownUsage: null,

      setSidebarWidth: (width, maxWidth) => {
        const clamped = clampSidebarWidth(width, maxWidth);
        const updates: Partial<WorkspaceState> = { sidebarWidth: clamped };
        if (clamped > 0) {
          updates.lastWidth = clamped;
        }
        set(updates);
      },

      setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),

      setLastWidth: (width) => set({ lastWidth: width }),

      setIsTyping: (typing) => set({ isTyping: typing }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setSidebarMode: (mode) => set({ sidebarMode: mode }),

      setSelectedArtifactId: (id) => set({ selectedArtifactId: id }),

      setArtifactNotice: (message) => set({ artifactNotice: message }),

      expandSidebar: () => {
        const state = get();
        const isMobile =
          typeof window !== "undefined" &&
          window.matchMedia(`(max-width: ${820}px)`).matches;
        if (isMobile) {
          set({ mobileDrawerOpen: true });
          return;
        }
        if (state.sidebarWidth === 0) {
          set({ sidebarWidth: state.lastWidth || SIDEBAR_DEFAULT });
        }
      },

      addMessage: (message) => {
        const id = message.id ?? crypto.randomUUID();
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id,
              timestamp: new Date(),
            },
          ],
        }));
        return id;
      },

      appendToMessage: (id, delta) =>
        set((state) => ({
          messages: state.messages.map((message) => {
            if (message.id !== id) return message;
            return {
              ...message,
              content:
                delta.content !== undefined
                  ? message.content + delta.content
                  : message.content,
              thinking:
                delta.thinking !== undefined
                  ? (message.thinking ?? "") + delta.thinking
                  : message.thinking,
            };
          }),
        })),

      updateMessage: (id, update) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === id ? { ...message, ...update } : message,
          ),
        })),

      setLastKnownUsage: (usage) => set({ lastKnownUsage: usage }),

      startNewChat: () =>
        set({
          messages: [],
          isTyping: false,
          lastKnownUsage: null,
          chatSessionId: newChatSessionId(),
        }),

      clearMessages: () => get().startNewChat(),

      toggleSidebar: (mobile) => {
        if (mobile) {
          set((state) => ({ mobileDrawerOpen: !state.mobileDrawerOpen }));
          return;
        }
        const state = get();
        if (state.sidebarWidth > 0) {
          set({ lastWidth: state.sidebarWidth, sidebarWidth: 0 });
        } else {
          set({ sidebarWidth: state.lastWidth || SIDEBAR_DEFAULT });
        }
      },
    }),
    {
      name: "mango-workspace",
      partialize: (state) => ({
        lastWidth: state.lastWidth,
        activeTab: state.activeTab,
        sidebarMode: state.sidebarMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.sidebarWidth = state.lastWidth || SIDEBAR_DEFAULT;
        }
      },
    },
  ),
);

export function selectSidebarCollapsed(
  isMobile: boolean,
  state: Pick<WorkspaceState, "sidebarWidth" | "mobileDrawerOpen">,
): boolean {
  return isMobile ? !state.mobileDrawerOpen : state.sidebarWidth === 0;
}
