import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ChatAttachment } from "@/features/chat/types/attachment";
import type { ChatReference } from "@/features/agent/types";
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
  toolCalls?: { id: string; name: string; arguments: Record<string, any> }[];
  toolResults?: {
    tool: string;
    call_id: string;
    success: boolean;
    result: Record<string, any>;
    summary: string;
    artifact_ids: string[];
  }[];
  currentNode?: string;
  references?: ChatReference[];
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

export const EPHEMERAL_ARTIFACT_TAB_LABEL = "Artifacts";

export type EphemeralTab = {
  id: string;
  kind: "artifact";
  artifactId: string;
  tabLabel: typeof EPHEMERAL_ARTIFACT_TAB_LABEL;
};

export const EXERCISE_WORKSPACE_TAB = "app:exercise";
export const EXERCISE_TAB_LABEL = "Exercise";

export type ExerciseView =
  | "dashboard"
  | "workouts"
  | "routines"
  | "equipment"
  | "history";

export type WorkspaceTabValue =
  | WorkspaceTabId
  | `ephemeral:${string}`
  | typeof EXERCISE_WORKSPACE_TAB;

export const VIEWER_MEDIA_FRACTION_DEFAULT = 0.5;
export const VIEWER_MEDIA_FRACTION_MIN = 0.2;
export const VIEWER_MEDIA_FRACTION_MAX = 0.8;
export const ARTIFACT_GRID_COLUMNS_DEFAULT = 4;

export function ephemeralTabValue(id: string): `ephemeral:${string}` {
  return `ephemeral:${id}`;
}

export function isEphemeralWorkspaceTab(
  value: string,
): value is `ephemeral:${string}` {
  return value.startsWith("ephemeral:");
}

export function clampViewerMediaFraction(fraction: number): number {
  return Math.max(
    VIEWER_MEDIA_FRACTION_MIN,
    Math.min(VIEWER_MEDIA_FRACTION_MAX, fraction),
  );
}

interface WorkspaceState {
  sidebarWidth: number;
  mobileDrawerOpen: boolean;
  lastWidth: number;
  isTyping: boolean;
  activeTab: WorkspaceTabId;
  activeWorkspaceTab: WorkspaceTabValue;
  ephemeralTab: EphemeralTab | null;
  exerciseTabOpen: boolean;
  exerciseView: ExerciseView;
  sidebarMode: SidebarMode;
  artifactGridColumns: number;
  viewerMediaFraction: number;
  artifactNotice: string | null;
  chatSessionId: string;
  messages: ChatMessage[];
  lastKnownUsage: LlmUsage | null;
  setSidebarWidth: (width: number, maxWidth?: number) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  setLastWidth: (width: number) => void;
  setIsTyping: (typing: boolean) => void;
  setActiveTab: (tab: WorkspaceTabId) => void;
  setPinnedTab: (tab: WorkspaceTabId) => void;
  setActiveWorkspaceTab: (tab: WorkspaceTabValue) => void;
  openArtifactTab: (artifactId: string) => void;
  closeEphemeralTab: () => void;
  openExerciseTab: () => void;
  closeExerciseTab: () => void;
  setExerciseView: (view: ExerciseView) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setArtifactGridColumns: (columns: number) => void;
  setViewerMediaFraction: (fraction: number) => void;
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
      Pick<
        ChatMessage,
        | "content"
        | "thinking"
        | "isStreaming"
        | "attachments"
        | "toolCalls"
        | "toolResults"
        | "currentNode"
        | "references"
      >
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
      activeWorkspaceTab: "overview",
      ephemeralTab: null,
      exerciseTabOpen: false,
      exerciseView: "dashboard",
      sidebarMode: "chat",
      artifactGridColumns: ARTIFACT_GRID_COLUMNS_DEFAULT,
      viewerMediaFraction: VIEWER_MEDIA_FRACTION_DEFAULT,
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

      setPinnedTab: (tab) =>
        set({
          ephemeralTab: null,
          activeTab: tab,
          activeWorkspaceTab: tab,
        }),

      setActiveTab: (tab) => get().setPinnedTab(tab),

      setActiveWorkspaceTab: (tab) => {
        if (isEphemeralWorkspaceTab(tab) || tab === EXERCISE_WORKSPACE_TAB) {
          set({ activeWorkspaceTab: tab });
          return;
        }
        get().setPinnedTab(tab);
      },

      openArtifactTab: (artifactId) => {
        const id = crypto.randomUUID();
        set({
          ephemeralTab: {
            id,
            kind: "artifact",
            artifactId,
            tabLabel: EPHEMERAL_ARTIFACT_TAB_LABEL,
          },
          activeWorkspaceTab: ephemeralTabValue(id),
        });
      },

      closeEphemeralTab: () => {
        const { activeTab } = get();
        set({
          ephemeralTab: null,
          activeWorkspaceTab: activeTab,
        });
      },

      openExerciseTab: () =>
        set({
          exerciseTabOpen: true,
          activeWorkspaceTab: EXERCISE_WORKSPACE_TAB,
        }),

      closeExerciseTab: () => {
        const { activeWorkspaceTab, activeTab } = get();
        set({
          exerciseTabOpen: false,
          activeWorkspaceTab:
            activeWorkspaceTab === EXERCISE_WORKSPACE_TAB
              ? activeTab
              : activeWorkspaceTab,
        });
      },

      setExerciseView: (view) => set({ exerciseView: view }),

      setSidebarMode: (mode) => set({ sidebarMode: mode }),

      setArtifactGridColumns: (columns) =>
        set({
          artifactGridColumns: Math.max(1, Math.min(5, Math.round(columns))),
        }),

      setViewerMediaFraction: (fraction) =>
        set({ viewerMediaFraction: clampViewerMediaFraction(fraction) }),

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
        artifactGridColumns: state.artifactGridColumns,
        viewerMediaFraction: state.viewerMediaFraction,
        exerciseView: state.exerciseView,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.sidebarWidth = state.lastWidth || SIDEBAR_DEFAULT;
          state.ephemeralTab = null;
          state.exerciseTabOpen = false;
          state.activeWorkspaceTab = state.activeTab;
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
