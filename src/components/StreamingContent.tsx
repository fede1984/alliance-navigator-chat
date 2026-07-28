import { memo } from "react";

type StreamingContentProps = {
  content: string;
  isStreaming: boolean;
};

export const StreamingContent = memo(function StreamingContent({
  content,
  isStreaming,
}: StreamingContentProps) {
  return (
    <div className="streaming-content" aria-live="off">
      <p>
        {content ||
          (isStreaming ? "Thinking…" : "No response was received.")}
      </p>

      {isStreaming && (
        <span className="streaming-indicator" aria-hidden="true">
          ●
        </span>
      )}
    </div>
  );
});
