import { describe, expect, it } from "vitest";
import { transitionReceiptImageState } from "../client/src/lib/receiptImageState";

describe("receipt image render state", () => {
  it("moves from loading to loaded when the image load event succeeds", () => {
    const loading = transitionReceiptImageState("loading", "reset");
    const loaded = transitionReceiptImageState(loading, "load");

    expect(loading).toBe("loading");
    expect(loaded).toBe("loaded");
  });

  it("moves to error when the image element signals a load failure", () => {
    expect(transitionReceiptImageState("loading", "error")).toBe("error");
  });
});
