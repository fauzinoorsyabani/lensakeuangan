import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, RECEIPT_STATUS_TRANSITIONS, canTransitionReceiptStatus } from "./finance";

describe("default categories", () => {
  it("provides the required Indonesian finance categories", () => {
    const names = DEFAULT_CATEGORIES.map((category) => category.name);
    expect(names).toEqual(expect.arrayContaining(["Makanan", "Transport", "Belanja", "Tagihan", "Hiburan", "Kesehatan"]));
    expect(names).toContain("Lainnya");
  });
});

describe("receipt status pipeline", () => {
  it("allows only the prescribed transitions", () => {
    expect(canTransitionReceiptStatus("uploaded", "processing")).toBe(true);
    expect(canTransitionReceiptStatus("processing", "needs_review")).toBe(true);
    expect(canTransitionReceiptStatus("needs_review", "approved")).toBe(true);
    expect(canTransitionReceiptStatus("processing", "failed")).toBe(true);
    expect(canTransitionReceiptStatus("failed", "processing")).toBe(true);
  });

  it("rejects status jumps and keeps approval terminal", () => {
    expect(canTransitionReceiptStatus("uploaded", "approved")).toBe(false);
    expect(canTransitionReceiptStatus("needs_review", "processing")).toBe(false);
    expect(canTransitionReceiptStatus("approved", "processing")).toBe(false);
    expect(RECEIPT_STATUS_TRANSITIONS.approved).toEqual([]);
  });
});
