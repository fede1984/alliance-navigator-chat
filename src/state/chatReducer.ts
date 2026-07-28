import type {
  ChatAction,
  ChatMessage,
  ChatState,
  ChatStreamEvent,
} from "../types/chat";

export const initialState: ChatState = {
  conversationId: null,
  messages: [],
  phase: "idle",
  error: null,
  conversations: [],
};

function saveCurrentConversation(state: ChatState): ChatState {
  if (!state.conversationId || state.messages.length === 0) {
    return state;
  }

  const firstUserMessage = state.messages.find(
    (message) => message.role === "user"
  );
  const existingIndex = state.conversations.findIndex(
    ({ id }) => id === state.conversationId
  );
  const existingConversation = state.conversations[existingIndex];
  const conversation = {
    id: state.conversationId,
    title:
      existingConversation?.title ||
      firstUserMessage?.content.trim().slice(0, 48) ||
      "Untitled chat",
    messages: state.messages,
    updatedAt: new Date().toISOString(),
  };
  const conversations =
    existingIndex === -1
      ? [conversation, ...state.conversations]
      : state.conversations.map((item, index) =>
          index === existingIndex ? conversation : item
        );

  return { ...state, conversations };
}

function withSavedConversation(state: ChatState) {
  return saveCurrentConversation(state);
}

function applyStreamEvent(
  message: ChatMessage,
  event: ChatStreamEvent
): ChatMessage {
  switch (event.type) {
    case "text_delta":
      return {
        ...message,
        content: message.content + event.delta,
      };

    case "citation":
      if (
        message.citations.some(
          (citation) => citation.id === event.citation.id
        )
      ) {
        return message;
      }

      return {
        ...message,
        citations: [...message.citations, event.citation],
      };

    case "result_card":
      if (message.cards.some((card) => card.id === event.card.id)) {
        return message;
      }

      return {
        ...message,
        cards: [...message.cards, event.card],
      };
  }
}

function updateMessage(
  messages: ChatMessage[],
  messageId: string,
  update: (message: ChatMessage) => ChatMessage
) {
  return messages.map((message) =>
    message.id === messageId ? update(message) : message
  );
}

export function chatReducer(
  state: ChatState,
  action: ChatAction
): ChatState {
  switch (action.type) {
    case "request_started":
      return withSavedConversation({
        ...state,
        conversationId: action.payload.conversationId,
        phase: "streaming",
        error: null,
        messages: [
          ...state.messages,
          action.payload.userMessage,
          action.payload.assistantMessage,
        ],
      });

    case "retry_started":
      return withSavedConversation({
        ...state,
        phase: "streaming",
        error: null,
        messages: updateMessage(
          state.messages,
          action.payload.messageId,
          (message) => ({
            ...message,
            status: "streaming",
            content: "",
            citations: [],
            cards: [],
          })
        ),
      });

    case "stream_event_received":
      return withSavedConversation({
        ...state,
        messages: updateMessage(
          state.messages,
          action.payload.messageId,
          (message) =>
            applyStreamEvent(message, action.payload.event)
        ),
      });

    case "assistant_completed":
      return withSavedConversation({
        ...state,
        conversationId: action.payload.conversationId,
        phase: "idle",
        error: null,
        messages: updateMessage(
          state.messages,
          action.payload.messageId,
          (message) => ({ ...message, status: "complete" })
        ),
      });

    case "assistant_failed":
      return withSavedConversation({
        ...state,
        phase: "idle",
        error: action.payload.error,
        messages: updateMessage(
          state.messages,
          action.payload.messageId,
          (message) => ({ ...message, status: "error" })
        ),
      });

    case "assistant_cancelled":
      return withSavedConversation({
        ...state,
        phase: "idle",
        error: null,
        messages: updateMessage(
          state.messages,
          action.payload.messageId,
          (message) => ({ ...message, status: "cancelled" })
        ),
      });

    case "conversation_reset": {
      const savedState = saveCurrentConversation(state);
      return {
        ...initialState,
        conversations: savedState.conversations,
      };
    }

    case "conversation_loaded": {
      const savedState = saveCurrentConversation(state);
      const conversation = savedState.conversations.find(
        ({ id }) => id === action.payload.conversationId
      );

      if (!conversation) {
        return savedState;
      }

      return {
        ...savedState,
        conversationId: conversation.id,
        messages: conversation.messages,
        phase: "idle",
        error: null,
      };
    }

    case "conversation_renamed": {
      const title = action.payload.title.trim().slice(0, 60);
      if (!title) return state;

      return {
        ...state,
        conversations: state.conversations.map((conversation) =>
          conversation.id === action.payload.conversationId
            ? { ...conversation, title }
            : conversation
        ),
      };
    }

    case "conversation_deleted": {
      const conversations = state.conversations.filter(
        ({ id }) => id !== action.payload.conversationId
      );

      if (state.conversationId === action.payload.conversationId) {
        return { ...initialState, conversations };
      }

      return { ...state, conversations };
    }

    default:
      return state;
  }
}
