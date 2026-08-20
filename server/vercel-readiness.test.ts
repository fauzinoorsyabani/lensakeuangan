import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getReceiptImagePath } from "./storage";

const root = resolve(import.meta.dirname, "..");

describe("Vercel deployment contract", () => {
  it("routes receipt images through the authenticated API path rather than a Manus-only URL", () => {
    expect(getReceiptImagePath("receipts/7/proof.jpg")).toBe("/api/storage/receipts/7/proof.jpg");
  });

  it("keeps API requests out of the SPA rewrite and declares the Vite build output", () => {
    const config = readFileSync(resolve(root, "vercel.json"), "utf8");
    expect(config).toContain('"outputDirectory": "dist/public"');
    expect(config).toContain('"source": "/((?!api/).*)"');
    expect(config).toContain('"api/index.ts"');
  });

  it("exports an Express application from the Vercel API entrypoint", () => {
    const entrypoint = readFileSync(resolve(root, "api/index.ts"), "utf8");
    expect(entrypoint).toContain("export default app");
  });
});
