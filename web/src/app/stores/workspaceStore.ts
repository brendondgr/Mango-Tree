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

export const EPHEMERAL_ARTIFACT_TAB_LABEL = "Artifacts";

export type EphemeralTab = {
  id: string;
  kind: "artifact";
  artifactId: string;
  tabLabel: typeof EPHEMERAL_ARTIFACT_TAB_LABEL;
};

export type MailboxView = "inbox" | "settings";
export type MailboxDensity = "compact" | "modern";

export type MailboxTextSize = "sm" | "md" | "lg";

/** Persistent inbox display preferences — the "dynamic config" that survives
 *  sessions (stored in localStorage alongside the rest of the workspace). */
export interface MailboxPrefs {
  // show / hide fields
  showProviderIcon: boolean;
  showSnippet: boolean; // the description / preview text
  showDate: boolean;
  showAccountBadge: boolean;
  showProviderBadge: boolean;
  showUnreadBadge: boolean;
  // sizing
  textSize: MailboxTextSize;
  tightRows: boolean; // extra-compact row spacing
  fromWidth: number; // px — "From" column width (compact)
  subjectWidth: number; // px — "Title" column width (compact)
  snippetWidth: number; // px — "Description" max width (compact); 0 = fill
  listWidth: number; // px — list column width (modern split view)
  // how many messages to load per account
  loadLimit: number | "all";
}

export const MAILBOX_PREFS_DEFAULT: MailboxPrefs = {
  showProviderIcon: true,
  showSnippet: true,
  showDate: true,
  showAccountBadge: true,
  showProviderBadge: true,
  showUnreadBadge: true,
  textSize: "md",
  tightRows: false,
  fromWidth: 140,
  subjectWidth: 200,
  snippetWidth: 0,
  listWidth: 440,
  loadLimit: "all",
};

export type ProjectManagerView = "board" | "timeline" | "deadlines";

export type CalendarView = "calendar" | "schedules";

export type RecipesView = "browse" | "editor";

export type ExerciseView =
  | "dashboard"
  | "workouts"
  | "routines"
  | "equipment"
  | "history";

export interface SessionExercise {
  id: string;
  name: string;
  plannedSets: number;
  plannedReps: number;
  plannedWeight: number | null;
  done: boolean;
  actualReps: number;
  weight: number;
  equipmentIds: string[];
  note: string;
}

export interface ExerciseSession {
  workoutId: string;
  workoutName: string;
  startedAt: number;
  exercises: SessionExercise[];
}

export type WorkspaceTabValue =
  | WorkspaceTabId
  | `ephemeral:${string}`
  | `app:${string}`;

export function appTabValue(id: string): `app:${string}` {
  return `app:${id}`;
}

export function isAppWorkspaceTab(value: string): value is `app:${string}` {
  return value.startsWith("app:");
}

export function appIdFromTab(value: `app:${string}`): string {
  return value.slice("app:".length);
}

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
  /** Ids of apps with an open workspace tab, in tab order. */
  openAppIds: string[];
  exerciseView: ExerciseView;
  exerciseSession: ExerciseSession | null;
  mailboxView: MailboxView;
  mailboxDensity: MailboxDensity;
  mailboxAccountId: string | null;
  mailboxPrefs: MailboxPrefs;
  projectManagerView: ProjectManagerView;
  calendarView: CalendarView;
  recipesView: RecipesView;
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
  openAppTab: (appId: string) => void;
  closeAppTab: (appId: string) => void;
  setExerciseView: (view: ExerciseView) => void;
  setMailboxView: (view: MailboxView) => void;
  setMailboxDensity: (density: MailboxDensity) => void;
  setMailboxAccountId: (accountId: string | null) => void;
  setMailboxPrefs: (patch: Partial<MailboxPrefs>) => void;
  resetMailboxPrefs: () => void;
  setProjectManagerView: (view: ProjectManagerView) => void;
  setCalendarView: (view: CalendarView) => void;
  setRecipesView: (view: RecipesView) => void;
  startExerciseSession: (session: ExerciseSession) => void;
  updateSessionExercise: (index: number, changes: Partial<SessionExercise>) => void;
  endExerciseSession: () => void;
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
      activeTab: "apps",
      activeWorkspaceTab: "apps",
      ephemeralTab: null,
      openAppIds: [],
      exerciseView: "dashboard",
      exerciseSession: null,
      mailboxView: "inbox",
      mailboxDensity: "modern",
      mailboxAccountId: null,
      mailboxPrefs: MAILBOX_PREFS_DEFAULT,
      projectManagerView: "board",
      calendarView: "calendar",
      recipesView: "browse",
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
        if (isEphemeralWorkspaceTab(tab) || isAppWorkspaceTab(tab)) {
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

      openAppTab: (appId) =>
        set((state) => ({
          openAppIds: state.openAppIds.includes(appId)
            ? state.openAppIds
            : [...state.openAppIds, appId],
          activeWorkspaceTab: appTabValue(appId),
        })),

      closeAppTab: (appId) => {
        const { activeWorkspaceTab, activeTab, openAppIds } = get();
        set({
          openAppIds: openAppIds.filter((id) => id !== appId),
          activeWorkspaceTab:
            activeWorkspaceTab === appTabValue(appId)
              ? activeTab
              : activeWorkspaceTab,
        });
      },

      setExerciseView: (view) => set({ exerciseView: view }),

      setMailboxView: (view) => set({ mailboxView: view }),

      setMailboxDensity: (density) => set({ mailboxDensity: density }),

      setMailboxAccountId: (accountId) => set({ mailboxAccountId: accountId }),

      setMailboxPrefs: (patch) =>
        set((state) => ({ mailboxPrefs: { ...state.mailboxPrefs, ...patch } })),

      resetMailboxPrefs: () => set({ mailboxPrefs: MAILBOX_PREFS_DEFAULT }),

      setProjectManagerView: (view) => set({ projectManagerView: view }),

      setCalendarView: (view) => set({ calendarView: view }),

      setRecipesView: (view) => set({ recipesView: view }),

      startExerciseSession: (session) => set({ exerciseSession: session }),

      updateSessionExercise: (index, changes) =>
        set((state) => {
          if (!state.exerciseSession) return {};
          return {
            exerciseSession: {
              ...state.exerciseSession,
              exercises: state.exerciseSession.exercises.map((ex, i) =>
                i === index ? { ...ex, ...changes } : ex,
              ),
            },
          };
        }),

      endExerciseSession: () => set({ exerciseSession: null }),

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
        artifactGridColumns: state.artifactGridColumns,
        viewerMediaFraction: state.viewerMediaFraction,
        exerciseView: state.exerciseView,
        mailboxView: state.mailboxView,
        mailboxDensity: state.mailboxDensity,
        mailboxPrefs: state.mailboxPrefs,
        projectManagerView: state.projectManagerView,
        calendarView: state.calendarView,
        recipesView: state.recipesView,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.sidebarWidth = state.lastWidth || SIDEBAR_DEFAULT;
          state.ephemeralTab = null;
          state.openAppIds = [];
          // Drop any stale pinned tab persisted before the Apps home existed.
          if (state.activeTab !== "apps") {
            state.activeTab = "apps";
          }
          state.activeWorkspaceTab = state.activeTab;
          // merge defaults so prefs added in later versions are populated
          state.mailboxPrefs = { ...MAILBOX_PREFS_DEFAULT, ...(state.mailboxPrefs ?? {}) };
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
