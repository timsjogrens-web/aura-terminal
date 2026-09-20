import { describe, it, expect } from "vitest";
import { dropRepeatedSignals } from "./signalHistory";

describe("dropRepeatedSignals", () => {
  it("drops a signal recorded twice in a row, keeping the first", () => {
    const rows = [
      { id: 1, signal: "BUY" },
      { id: 2, signal: "BUY" },
      { id: 3, signal: "HOLD" },
    ];
    expect(dropRepeatedSignals(rows).map((r) => r.id)).toEqual([1, 3]);
  });

  it("keeps a signal that comes back after a different one (a real new call)", () => {
    const rows = [
      { id: 1, signal: "BUY" },
      { id: 2, signal: "HOLD" },
      { id: 3, signal: "BUY" },
    ];
    expect(dropRepeatedSignals(rows).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("handles empty input", () => {
    expect(dropRepeatedSignals([])).toEqual([]);
  });
});
