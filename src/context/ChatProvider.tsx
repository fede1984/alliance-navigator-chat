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
const FIRST_RESPONSE_TIMEOUT_MS = 20_000;

function restoreMessage(message: ChatMessage): ChatMessage {
  if (message.status !== "streaming") return message;

  return {
    ...message,
    status: "cancelled",
  };
}

function getInitialState(): ChatState {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (!savedState) return initialState;

    const parsed = JSON.parse(savedState) as Partial<ChatState>;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.map(restoreMessage)
      : [];
    const conversations = Array.isArray(parsed.conversations)
      ? parsed.conversations.map((conversation) => ({
          ...conversation,
          messages: conversation.messages.map(restoreMessage),
        }))
      : [];

    return {
      ...initialState,
      conversationId: parsed.conversationId ?? null,
      messages,
      conversations,
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
      let receivedEvent = false;
      let firstResponseTimedOut = false;
      const firstResponseTimeout = window.setTimeout(() => {
        firstResponseTimedOut = true;
        controller.abort();
      }, FIRST_RESPONSE_TIMEOUT_MS);

      try {
        for await (const event of streamChatResponse(
          { prompt, conversationId },
          controller.signal
        )) {
          receivedEvent = true;
          window.clearTimeout(firstResponseTimeout);
          dispatch({
            type: "stream_event_received",
            payload: { messageId, event },
          });
        }

        if (!receivedEvent) {
          throw new Error("The AI provider returned an empty response.");
        }

        dispatch({
          type: "assistant_completed",
          payload: {
            messageId,
            conversationId,
          },
        });
      } catch (error) {
        if (firstResponseTimedOut) {
          dispatch({
            type: "assistant_failed",
            payload: {
              messageId,
              error:
                "The AI provider took too long to start responding. Please retry.",
            },
          });
        } else if (
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
        window.clearTimeout(firstResponseTimeout);
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

  const renameConversation = useCallback(
    (conversationId: string, title: string) => {
      dispatch({
        type: "conversation_renamed",
        payload: { conversationId, title },
      });
    },
    []
  );

  const deleteConversation = useCallback((conversationId: string) => {
    if (stateRef.current.conversationId === conversationId) {
      activeRequestRef.current?.controller.abort();
    }
    dispatch({
      type: "conversation_deleted",
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
      renameConversation,
      deleteConversation,
    }),
    [
      cancelResponse,
      retryMessage,
      sendMessage,
      startNewConversation,
      loadConversation,
      renameConversation,
      deleteConversation,
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
