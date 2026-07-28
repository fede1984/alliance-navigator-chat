import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Citation } from "../types/chat";
import { CitationList } from "./CitationList";

const available: Citation = {
  id: "source-1",
  sourceType: "power-bi",
  sourceName: "Revenue dashboard",
  url: "https://example.com/report",
  asOf: "2026-07-20",
  status: "available",
};

describe("CitationList", () => {
  it("renders a deep link with provenance and an as-of date", () => {
    render(
      <CitationList
        citations={[available]}
        onCitationOpen={vi.fn()}
      />
    );

    expect(
      screen.getByRole("link", { name: /revenue dashboard/i })
    ).toHaveAttribute("href", available.url);
    expect(screen.getByText(/power-bi/i)).toBeInTheDocument();
    expect(screen.getByText("2026-07-20")).toBeInTheDocument();
  });

  it("renders unavailable sources without a broken link", () => {
    render(
      <CitationList
        citations={[
          {
            ...available,
            status: "unavailable",
            url: null,
          },
        ]}
        onCitationOpen={vi.fn()}
      />
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/source unavailable/i)).toBeInTheDocument();
  });
});
