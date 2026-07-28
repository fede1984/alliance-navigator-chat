import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../types/chat";
import { chatReducer, initialState } from "./chatReducer";

function message(
  role: ChatMessage["role"],
  id: string
): ChatMessage {
  return {
    id,
    requestId: "request-1",
    role,
    status: role === "user" ? "complete" : "streaming",
    content: role === "user" ? "Show pipeline" : "",
    citations: [],
    cards: [],
  };
}

describe("chatReducer", () => {
  it("starts a request atomically with user and assistant messages", () => {
    const state = chatReducer(initialState, {
      type: "request_started",
      payload: {
        userMessage: message("user", "user-1"),
        assistantMessage: message("assistant", "assistant-1"),
        conversationId: "conversation-1",
      },
    });

    expect(state.phase).toBe("streaming");
    expect(state.messages.map(({ role }) => role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("appends deltas only to the targeted message", () => {
    const started = chatReducer(initialState, {
      type: "request_started",
      payload: {
        userMessage: message("user", "user-1"),
        assistantMessage: message("assistant", "assistant-1"),
        conversationId: "conversation-1",
      },
    });

    const next = chatReducer(started, {
      type: "stream_event_received",
      payload: {
        messageId: "assistant-1",
        event: { type: "text_delta", delta: "Hello" },
      },
    });

    expect(next.messages[1].content).toBe("Hello");
    // Referential equality is what makes React.memo effective.
    expect(next.messages[0]).toBe(started.messages[0]);
    expect(next.messages[1]).not.toBe(started.messages[1]);
  });

  it("deduplicates replayed citations", () => {
    const started = chatReducer(initialState, {
      type: "request_started",
      payload: {
        userMessage: message("user", "user-1"),
        assistantMessage: message("assistant", "assistant-1"),
        conversationId: "conversation-1",
      },
    });
    const event = {
      type: "citation" as const,
      citation: {
        id: "source-1",
        sourceType: "crm" as const,
        sourceName: "CRM",
        url: "https://example.com",
        asOf: "2026-07-20",
        status: "available" as const,
      },
    };

    const once = chatReducer(started, {
      type: "stream_event_received",
      payload: { messageId: "assistant-1", event },
    });
    const twice = chatReducer(once, {
      type: "stream_event_received",
      payload: { messageId: "assistant-1", event },
    });

    expect(twice.messages[1].citations).toHaveLength(1);
  });

  it("marks cancellation without discarding partial content", () => {
    const state = {
      ...initialState,
      phase: "streaming" as const,
      messages: [
        {
          ...message("assistant", "assistant-1"),
          content: "Partial answer",
        },
      ],
    };

    const next = chatReducer(state, {
      type: "assistant_cancelled",
      payload: { messageId: "assistant-1" },
    });

    expect(next.phase).toBe("idle");
    expect(next.messages[0]).toMatchObject({
      status: "cancelled",
      content: "Partial answer",
    });
  });

  it("keeps a conversation in history and can load it again", () => {
    const started = chatReducer(initialState, {
      type: "request_started",
      payload: {
        userMessage: message("user", "user-1"),
        assistantMessage: message("assistant", "assistant-1"),
        conversationId: "conversation-1",
      },
    });
    const reset = chatReducer(started, { type: "conversation_reset" });

    expect(reset.messages).toEqual([]);
    expect(reset.conversations).toHaveLength(1);
    expect(reset.conversations[0]).toMatchObject({
      id: "conversation-1",
      title: "Show pipeline",
    });

    const restored = chatReducer(reset, {
      type: "conversation_loaded",
      payload: { conversationId: "conversation-1" },
    });

    expect(restored.conversationId).toBe("conversation-1");
    expect(restored.messages).toHaveLength(2);
  });
});
