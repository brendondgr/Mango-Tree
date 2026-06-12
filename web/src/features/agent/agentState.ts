import { create } from "zustand";
import type { ToolCall, ToolResult } from "./types";

export interface AgentRunState {
  status: "idle" | "running" | "error" | "done";
  currentNode: string;
  thinking: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  finalAnswer: string;
  error: string | null;
  reset: () => void;
  setNode: (node: string) => void;
  appendThinking: (delta: string) => void;
  addToolCall: (call: ToolCall) => void;
  addToolResult: (result: ToolResult) => void;
  setFinalAnswer: (answer: string) => void;
  setError: (error: string) => void;
  setStatus: (status: "idle" | "running" | "error" | "done") => void;
}

export const useAgentStore = create<AgentRunState>((set) => ({
  status: "idle",
  currentNode: "",
  thinking: "",
  toolCalls: [],
  toolResults: [],
  finalAnswer: "",
  error: null,
  reset: () =>
    set({
      status: "idle",
      currentNode: "",
      thinking: "",
      toolCalls: [],
      toolResults: [],
      finalAnswer: "",
      error: null,
    }),
  setNode: (node) => set({ currentNode: node }),
  appendThinking: (delta) => set((s) => ({ thinking: s.thinking + delta })),
  addToolCall: (call) => set((s) => ({ toolCalls: [...s.toolCalls, call] })),
  addToolResult: (result) =>
    set((s) => ({ toolResults: [...s.toolResults, result] })),
  setFinalAnswer: (answer) => set({ finalAnswer: answer, status: "done" }),
  setError: (error) => set({ error, status: "error" }),
  setStatus: (status) => set({ status }),
}));
