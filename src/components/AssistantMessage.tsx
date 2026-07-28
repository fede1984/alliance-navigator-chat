import { memo, useCallback, useMemo } from "react";
import { useChatActions } from "../context/chatContext";
import type { ChatMessage, Citation } from "../types/chat";
import { CitationList } from "./CitationList";
import {
  ResultCardList,
  type CardsByType,
} from "./ResultCardList";
import { StreamingContent } from "./StreamingContent";

type AssistantMessageProps = {
  message: ChatMessage;
};

export const AssistantMessage = memo(function AssistantMessage({
  message,
}: AssistantMessageProps) {
  const { retryMessage } = useChatActions();

  // Derived arrays stay referentially stable until their source changes.
  const visibleCitations = useMemo(
    () =>
      message.citations.filter(
        (citation) => citation.status !== "hidden"
      ),
    [message.citations]
  );

  const cardsByType = useMemo<CardsByType>(
    () => ({
      alliances: message.cards.filter(
        (card) => card.kind === "alliance-profile"
      ),
      contacts: message.cards.filter(
        (card) => card.kind === "key-contact"
      ),
      stories: message.cards.filter(
        (card) => card.kind === "win-story"
      ),
    }),
    [message.cards]
  );

  const handleCitationOpen = useCallback(
    (citation: Citation) => {
      // Replace with the product analytics client in production.
      console.info("citation_opened", {
        messageId: message.id,
        citationId: citation.id,
        sourceType: citation.sourceType,
      });
    },
    [message.id]
  );

  const handleRetry = useCallback(() => {
    void retryMessage(message.id);
  }, [message.id, retryMessage]);

  return (
    <article
      className="message message--assistant"
      aria-label="Assistant message"
      data-status={message.status}
    >
      <span className="message__role">Assistant</span>

      <StreamingContent
        content={message.content}
        isStreaming={message.status === "streaming"}
      />

      <ResultCardList groups={cardsByType} />
      <CitationList
        citations={visibleCitations}
        onCitationOpen={handleCitationOpen}
      />

      {message.status === "cancelled" && (
        <p className="message-status">Response stopped.</p>
      )}

      {message.status === "error" && (
        <button
          className="secondary-button retry-button"
          type="button"
          onClick={handleRetry}
        >
          Retry response
        </button>
      )}
    </article>
  );
});
