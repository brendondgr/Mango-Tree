import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { WorkspaceTabId } from "@/features/workspace/components/workspaceTabs";

export type MessageRole = "user" | "agent";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

const SIDEBAR_DEFAULT = 360;
const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 520;

interface WorkspaceState {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  lastWidth: number;
  isTyping: boolean;
  activeTab: WorkspaceTabId;
  messages: ChatMessage[];
  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setLastWidth: (width: number) => void;
  setIsTyping: (typing: boolean) => void;
  setActiveTab: (tab: WorkspaceTabId) => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;
  toggleSidebar: () => void;
}

export const SIDEBAR_CONSTRAINTS = {
  default: SIDEBAR_DEFAULT,
  min: SIDEBAR_MIN,
  max: SIDEBAR_MAX,
  collapseAt: 72,
} as const;

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      sidebarWidth: SIDEBAR_DEFAULT,
      sidebarCollapsed: false,
      lastWidth: SIDEBAR_DEFAULT,
      isTyping: false,
      activeTab: "overview",
      messages: [],

      setSidebarWidth: (width) => {
        const clamped = Math.max(
          SIDEBAR_MIN,
          Math.min(SIDEBAR_MAX, width),
        );
        set({ sidebarWidth: clamped, lastWidth: clamped, sidebarCollapsed: false });
      },

      setSidebarCollapsed: (collapsed) => {
        const state = get();
        if (collapsed && !state.sidebarCollapsed) {
          set({ lastWidth: state.sidebarWidth, sidebarCollapsed: true });
        } else {
          set({ sidebarCollapsed: collapsed });
        }
      },

      setLastWidth: (width) => set({ lastWidth: width }),

      setIsTyping: (typing) => set({ isTyping: typing }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id: crypto.randomUUID(),
              timestamp: new Date(),
            },
          ],
        })),

      clearMessages: () => set({ messages: [], isTyping: false }),

      toggleSidebar: () => {
        const state = get();
        if (state.sidebarCollapsed) {
          set({
            sidebarCollapsed: false,
            sidebarWidth: state.lastWidth || SIDEBAR_DEFAULT,
          });
        } else {
          set({
            lastWidth: state.sidebarWidth,
            sidebarCollapsed: true,
          });
        }
      },
    }),
    {
      name: "mango-workspace",
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        lastWidth: state.lastWidth,
        activeTab: state.activeTab,
      }),
    },
  ),
);
