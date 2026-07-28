import { describe, expect, it } from "vitest";
import { isChatStreamEvent } from "./chatStream";

describe("isChatStreamEvent", () => {
  it("accepts text, citation and structured result events", () => {
    expect(
      isChatStreamEvent({ type: "text_delta", delta: "Hello" })
    ).toBe(true);
    expect(
      isChatStreamEvent({
        type: "citation",
        citation: {
          id: "sharepoint-demo",
          sourceType: "sharepoint",
          sourceName: "Alliance brief",
          url: null,
          asOf: "2026-07-28",
          status: "unavailable",
        },
      })
    ).toBe(true);
    expect(
      isChatStreamEvent({
        type: "result_card",
        card: {
          id: "power-bi-demo",
          kind: "alliance-profile",
          name: "Strategic Alliances",
          revenue: 1,
          pipeline: 2,
        },
      })
    ).toBe(true);
  });

  it("rejects malformed structured events", () => {
    expect(
      isChatStreamEvent({
        type: "citation",
        citation: { id: "missing-fields" },
      })
    ).toBe(false);
    expect(
      isChatStreamEvent({
        type: "result_card",
        card: { id: "wrong-kind", kind: "unknown" },
      })
    ).toBe(false);
  });
});
