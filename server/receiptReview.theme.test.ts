import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ReceiptReview.tsx"), "utf8");

describe("ReceiptReview monokrom status contract", () => {
  it("uses neutral tones for the receipt status and confidence indicators", () => {
    expect(source).toContain('bg-white/15 text-white');
    expect(source).toContain('bg-white/5 text-[var(--ai-mint)]');
    expect(source).toContain('bg-white/10 text-white');
  });

  it("does not retain the previous green, amber, or coral status colors", () => {
    ["#e2f3e3", "#fff2d9", "#fff0eb", "#247247", "#9a6615", "#bf4938", "#36a15d", "#e2a83a", "#e85d48"].forEach((legacyColor) => {
      expect(source).not.toContain(legacyColor);
    });
  });

  it("keeps loading and recovery controls on monochrome tokens", () => {
    expect(source).toContain('animate-spin text-white');
    expect(source).toContain('className="ai-primary mt-4');
    expect(source).toContain('border border-white/20 bg-[var(--ai-panel)]');
  });

  it("offers recovery instead of an indefinite Review loading state", () => {
    expect(source).toContain("window.setTimeout(() => setReviewTimedOut(true), 10_000)");
    expect(source).toContain('"Muat ulang Review"');
    expect(source).toContain("void review.refetch()");
  });

  it("loads the protected receipt image with preview-safe authentication", () => {
    expect(source).toContain('credentials: "include"');
    expect(source).toContain("getPreviewAuthHeaders()");
    expect(source).toContain("URL.createObjectURL(image)");
    expect(source).toContain("data-receipt-image-state={imageState}");
    expect(source).toContain('transitionReceiptImageState(state, "load")');
  });
});
