import { memo } from "react";
import type { ChatMessage } from "../types/chat";

type UserMessageProps = {
  message: ChatMessage;
};

export const UserMessage = memo(
  function UserMessage({
    message,
  }: UserMessageProps) {
    return (
      <article
        className="message message--user"
        aria-label="Your message"
      >
        <span className="message__role">You</span>
        <p>{message.content}</p>
      </article>
    );
  }
);
