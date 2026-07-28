import { createContext, useContext } from "react";
import type { ChatPhase, ChatState } from "../types/chat";

export type ChatActions = {
  sendMessage: (prompt: string) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  cancelResponse: () => void;
  startNewConversation: () => void;
  loadConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
  deleteConversation: (conversationId: string) => void;
};

export const ChatStateContext = createContext<ChatState | null>(null);
export const ChatPhaseContext = createContext<ChatPhase | null>(null);
export const ChatActionsContext = createContext<ChatActions | null>(null);

export function useChatState() {
  const context = useContext(ChatStateContext);

  if (!context) {
    throw new Error("useChatState must be used inside ChatProvider");
  }

  return context;
}

export function useChatPhase() {
  const context = useContext(ChatPhaseContext);

  if (!context) {
    throw new Error("useChatPhase must be used inside ChatProvider");
  }

  return context;
}

export function useChatActions() {
  const context = useContext(ChatActionsContext);

  if (!context) {
    throw new Error("useChatActions must be used inside ChatProvider");
  }

  return context;
}
