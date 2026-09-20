import { describe, it, expect } from "vitest";
import { orderByStalest, isAuxDue, RefreshTarget } from "./refresh";
import { DEFAULT_UNIVERSE, CORE_UNIVERSE, INVESTOR_UNIVERSE } from "./universe";

const t = (ticker: string): RefreshTarget => ({ ticker, name: ticker, sector: "Technology" });

describe("orderByStalest", () => {
  it("puts never-fetched stocks first, then oldest-updated first", () => {
    const targets = [t("A"), t("B"), t("C"), t("D")];
    const updatedAt = new Map<string, string | null>([
      ["A", "2026-09-20T10:00:00Z"],
      ["B", "2026-09-20T08:00:00Z"],
      ["C", null], // row exists but never got a successful update
      // D has no row at all
    ]);
    expect(orderByStalest(targets, updatedAt).map((x) => x.ticker)).toEqual(["C", "D", "B", "A"]);
  });

  it("keeps universe order among ties, so the result is deterministic", () => {
    const targets = [t("Z"), t("Y"), t("X")];
    expect(orderByStalest(targets, new Map()).map((x) => x.ticker)).toEqual(["Z", "Y", "X"]);
  });

  it("does not mutate its input", () => {
    const targets = [t("A"), t("B")];
    orderByStalest(targets, new Map([["A", "2026-09-20T10:00:00Z"]]));
    expect(targets.map((x) => x.ticker)).toEqual(["A", "B"]);
  });
});

describe("isAuxDue", () => {
  const now = new Date("2026-09-20T12:00:00Z").getTime();
  it("is due when never fetched or unparseable", () => {
    expect(isAuxDue(null, now)).toBe(true);
    expect(isAuxDue("not a date", now)).toBe(true);
  });
  it("is not due within 6 hours, and due after", () => {
    expect(isAuxDue("2026-09-20T07:00:00Z", now)).toBe(false); // 5h ago
    expect(isAuxDue("2026-09-20T05:00:00Z", now)).toBe(true); // 7h ago
  });
});

describe("universe", () => {
  it("has no duplicate tickers across the core and investor lists", () => {
    const tickers = DEFAULT_UNIVERSE.map((e) => e.ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
    expect(tickers.length).toBe(CORE_UNIVERSE.length + INVESTOR_UNIVERSE.length);
  });
  it("only contains plain stock symbols", () => {
    for (const e of DEFAULT_UNIVERSE) expect(e.ticker).toMatch(/^[A-Z]{1,5}(\.[A-Z])?$/);
  });
});
