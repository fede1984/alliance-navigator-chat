export type CitationStatus =
  | "available"
  | "unavailable"
  | "hidden";

export type Citation = {
  id: string;
  sourceType: "power-bi" | "sharepoint" | "crm";
  sourceName: string;
  url: string | null;
  asOf: string;
  status: CitationStatus;
};

export type AllianceProfileCard = {
  kind: "alliance-profile";
  id: string;
  name: string;
  revenue: number | null;
  pipeline: number | null;
};

export type KeyContactCard = {
  kind: "key-contact";
  id: string;
  name: string;
  role: string | null;
  organization: string;
};

export type WinStoryCard = {
  kind: "win-story";
  id: string;
  title: string;
  summary: string | null;
};

// A discriminated union lets TypeScript narrow each card from `kind`.
export type ResultCard =
  | AllianceProfileCard
  | KeyContactCard
  | WinStoryCard;

export type MessageStatus =
  | "streaming"
  | "complete"
  | "error"
  | "cancelled";

export type ChatMessage = {
  id: string;
  requestId: string;
  role: "user" | "assistant";
  status: MessageStatus;
  content: string;
  citations: Citation[];
  cards: ResultCard[];
};

export type ChatPhase = "idle" | "streaming";

export type SavedConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

export type ChatState = {
  conversationId: string | null;
  messages: ChatMessage[];
  phase: ChatPhase;
  error: string | null;
  conversations: SavedConversation[];
};

// These events mirror a realistic backend streaming contract.
export type ChatStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "citation"; citation: Citation }
  | { type: "result_card"; card: ResultCard };

export type ChatRequest = {
  conversationId: string | null;
  prompt: string;
};

export type ChatAction =
  | {
      type: "request_started";
      payload: {
        userMessage: ChatMessage;
        assistantMessage: ChatMessage;
        conversationId: string;
      };
    }
  | {
      type: "retry_started";
      payload: { messageId: string };
    }
  | {
      type: "stream_event_received";
      payload: {
        messageId: string;
        event: ChatStreamEvent;
      };
    }
  | {
      type: "assistant_completed";
      payload: {
        messageId: string;
        conversationId: string;
      };
    }
  | {
      type: "assistant_failed";
      payload: {
        messageId: string;
        error: string;
      };
    }
  | {
      type: "assistant_cancelled";
      payload: { messageId: string };
    }
  | { type: "conversation_reset" }
  | {
      type: "conversation_loaded";
      payload: { conversationId: string };
    }
  | {
      type: "conversation_renamed";
      payload: { conversationId: string; title: string };
    }
  | {
      type: "conversation_deleted";
      payload: { conversationId: string };
    };
