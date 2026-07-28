import type { ChatRequest, ChatStreamEvent } from "../types/chat";

export function isChatStreamEvent(value: unknown): value is ChatStreamEvent {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }

  const event = value as Record<string, unknown>;
  if (event.type === "text_delta") {
    return typeof event.delta === "string";
  }

  if (event.type === "citation") {
    const citation = event.citation as Record<string, unknown> | undefined;
    return (
      !!citation &&
      typeof citation.id === "string" &&
      ["power-bi", "sharepoint", "crm"].includes(
        String(citation.sourceType)
      ) &&
      typeof citation.sourceName === "string" &&
      (typeof citation.url === "string" || citation.url === null) &&
      typeof citation.asOf === "string" &&
      ["available", "unavailable", "hidden"].includes(
        String(citation.status)
      )
    );
  }

  if (event.type === "result_card") {
    const card = event.card as Record<string, unknown> | undefined;
    if (!card || typeof card.id !== "string") return false;

    if (card.kind === "alliance-profile") {
      return (
        typeof card.name === "string" &&
        (typeof card.revenue === "number" || card.revenue === null) &&
        (typeof card.pipeline === "number" || card.pipeline === null)
      );
    }
    if (card.kind === "key-contact") {
      return (
        typeof card.name === "string" &&
        (typeof card.role === "string" || card.role === null) &&
        typeof card.organization === "string"
      );
    }
    if (card.kind === "win-story") {
      return (
        typeof card.title === "string" &&
        (typeof card.summary === "string" || card.summary === null)
      );
    }
    return false;
  }

  return false;
}

function getErrorMessage(payload: unknown, status: number) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return `The chat service returned an error (${status}).`;
}

/**
 * The backend responds with NDJSON: every line is one complete stream event.
 * Keeping the parser here lets the rest of the UI consume typed events.
 */
export async function* streamChatResponse(
  request: ChatRequest,
  signal: AbortSignal
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new Error(getErrorMessage(payload, response.status));
  }

  if (!response.body) {
    throw new Error("The chat service returned an empty response.");
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += value ?? "";

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      const event: unknown = JSON.parse(line);
      if (!isChatStreamEvent(event)) {
        throw new Error("The chat service returned an invalid event.");
      }
      yield event;
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event: unknown = JSON.parse(buffer);
    if (!isChatStreamEvent(event)) {
      throw new Error("The chat service returned an invalid event.");
    }
    yield event;
  }
}
