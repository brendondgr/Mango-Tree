import { create } from "zustand";
import type { ToolCall, ToolResult, ChatReference, ToolGroupSelection } from "./types";

export interface AgentRunState {
  status: "idle" | "running" | "error" | "done";
  currentNode: string;
  thinking: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  toolSelection: ToolGroupSelection | null;
  finalAnswer: string;
  references: ChatReference[];
  error: string | null;
  reset: () => void;
  setNode: (node: string) => void;
  appendThinking: (delta: string) => void;
  addToolCall: (call: ToolCall) => void;
  addToolResult: (result: ToolResult) => void;
  setToolSelection: (selection: ToolGroupSelection) => void;
  setFinalAnswer: (answer: string, references?: ChatReference[]) => void;
  setError: (error: string) => void;
  setStatus: (status: "idle" | "running" | "error" | "done") => void;
}

export const useAgentStore = create<AgentRunState>((set) => ({
  status: "idle",
  currentNode: "",
  thinking: "",
  toolCalls: [],
  toolResults: [],
  toolSelection: null,
  finalAnswer: "",
  references: [],
  error: null,
  reset: () =>
    set({
      status: "idle",
      currentNode: "",
      thinking: "",
      toolCalls: [],
      toolResults: [],
      toolSelection: null,
      finalAnswer: "",
      references: [],
      error: null,
    }),
  setNode: (node) => set({ currentNode: node }),
  appendThinking: (delta) => set((s) => ({ thinking: s.thinking + delta })),
  addToolCall: (call) => set((s) => ({ toolCalls: [...s.toolCalls, call] })),
  addToolResult: (result) =>
    set((s) => ({ toolResults: [...s.toolResults, result] })),
  setToolSelection: (selection) => set({ toolSelection: selection }),
  setFinalAnswer: (answer, references = []) =>
    set({ finalAnswer: answer, references, status: "done" }),
  setError: (error) => set({ error, status: "error" }),
  setStatus: (status) => set({ status }),
}));
