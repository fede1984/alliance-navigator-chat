import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { streamChatResponse } from "../api/chatStream";
import { chatReducer, initialState } from "../state/chatReducer";
import type { ChatMessage, ChatState } from "../types/chat";
import {
  ChatActionsContext,
  ChatPhaseContext,
  ChatStateContext,
  type ChatActions,
} from "./chatContext";

type ChatProviderProps = {
  children: ReactNode;
};

type ActiveRequest = {
  controller: AbortController;
  messageId: string;
};

const STORAGE_KEY = "alliance-navigator-chat-state";

function getInitialState(): ChatState {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (!savedState) return initialState;

    const parsed = JSON.parse(savedState) as Partial<ChatState>;
    return {
      ...initialState,
      conversationId: parsed.conversationId ?? null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      conversations: Array.isArray(parsed.conversations)
        ? parsed.conversations
        : [],
    };
  } catch {
    return initialState;
  }
}

function createMessage(
  role: ChatMessage["role"],
  requestId: string,
  content = ""
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    requestId,
    role,
    status: role === "user" ? "complete" : "streaming",
    content,
    citations: [],
    cards: [],
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The assistant could not complete the response.";
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [state, dispatch] = useReducer(
    chatReducer,
    initialState,
    getInitialState
  );
  const stateRef = useRef<ChatState>(state);
  const activeRequestRef = useRef<ActiveRequest | null>(null);

  // Event handlers need the latest state without changing identity per token.
  stateRef.current = state;

  const consumeStream = useCallback(
    async (
      prompt: string,
      messageId: string,
      conversationId: string
    ) => {
      const controller = new AbortController();
      activeRequestRef.current = { controller, messageId };

      try {
        for await (const event of streamChatResponse(
          { prompt, conversationId },
          controller.signal
        )) {
          dispatch({
            type: "stream_event_received",
            payload: { messageId, event },
          });
        }

        dispatch({
          type: "assistant_completed",
          payload: {
            messageId,
            conversationId,
          },
        });
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          dispatch({
            type: "assistant_cancelled",
            payload: { messageId },
          });
        } else {
          dispatch({
            type: "assistant_failed",
            payload: { messageId, error: getErrorMessage(error) },
          });
        }
      } finally {
        if (activeRequestRef.current?.messageId === messageId) {
          activeRequestRef.current = null;
        }
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (activeRequestRef.current) {
        return;
      }

      const requestId = crypto.randomUUID();
      const userMessage = createMessage("user", requestId, prompt);
      const assistantMessage = createMessage("assistant", requestId);
      // Use the request ID for the first turn so retries retain the same
      // backend conversation even if the initial stream fails.
      const conversationId =
        stateRef.current.conversationId ?? requestId;

      dispatch({
        type: "request_started",
        payload: { userMessage, assistantMessage, conversationId },
      });

      await consumeStream(prompt, assistantMessage.id, conversationId);
    },
    [consumeStream]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      if (activeRequestRef.current) {
        return;
      }

      const failedMessage = stateRef.current.messages.find(
        (message) =>
          message.id === messageId && message.status === "error"
      );
      const originalMessage = stateRef.current.messages.find(
        (message) =>
          message.requestId === failedMessage?.requestId &&
          message.role === "user"
      );

      if (!failedMessage || !originalMessage) {
        return;
      }

      dispatch({ type: "retry_started", payload: { messageId } });
      await consumeStream(
        originalMessage.content,
        messageId,
        stateRef.current.conversationId ?? originalMessage.requestId
      );
    },
    [consumeStream]
  );

  const cancelResponse = useCallback(() => {
    activeRequestRef.current?.controller.abort();
  }, []);

  const startNewConversation = useCallback(() => {
    activeRequestRef.current?.controller.abort();
    dispatch({ type: "conversation_reset" });
  }, []);

  const loadConversation = useCallback((conversationId: string) => {
    activeRequestRef.current?.controller.abort();
    dispatch({
      type: "conversation_loaded",
      payload: { conversationId },
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(
    () => () => {
      activeRequestRef.current?.controller.abort();
    },
    []
  );

  const actions = useMemo<ChatActions>(
    () => ({
      sendMessage,
      retryMessage,
      cancelResponse,
      startNewConversation,
      loadConversation,
    }),
    [
      cancelResponse,
      retryMessage,
      sendMessage,
      startNewConversation,
      loadConversation,
    ]
  );

  return (
    <ChatActionsContext value={actions}>
      <ChatPhaseContext value={state.phase}>
        <ChatStateContext value={state}>
          {children}
        </ChatStateContext>
      </ChatPhaseContext>
    </ChatActionsContext>
  );
}
