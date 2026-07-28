import { memo } from "react";
import type { Citation } from "../types/chat";

type CitationListProps = {
  citations: Citation[];
  onCitationOpen: (citation: Citation) => void;
};

export const CitationList = memo(
  function CitationList({
    citations,
    onCitationOpen,
  }: CitationListProps) {
    if (citations.length === 0) {
      return null;
    }

    return (
      <section
        className="citations"
        aria-label="Sources"
      >
        <h3>Sources</h3>

        <ul>
          {citations.map((citation, index) => (
            <li key={citation.id}>
              {citation.status === "available" &&
              citation.url ? (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${citation.sourceName}, opens in a new tab`}
                  onClick={() =>
                    onCitationOpen(citation)
                  }
                >
                  [{index + 1}] {citation.sourceName}
                </a>
              ) : (
                <span>
                  [{index + 1}] {citation.sourceName}
                  {" · "}Source unavailable
                </span>
              )}

              <small>
                Source: {citation.sourceType} · As of{" "}
                <time dateTime={citation.asOf}>
                  {citation.asOf}
                </time>
              </small>
            </li>
          ))}
        </ul>
      </section>
    );
  }
);
