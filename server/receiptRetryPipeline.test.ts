import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const receiptId = "00000000-0000-4000-8000-000000000003";
let status: "failed" | "processing" | "needs_review" = "failed";

vi.mock("./db", () => ({
  getReceiptForUser: vi.fn(), transitionReceiptForUser: vi.fn(), createExtractionRun: vi.fn(), completeExtractionRun: vi.fn(),
}));
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import { appRouter } from "./routers";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl } from "./storage";

const context: TrpcContext = { user: { id: 55, openId: "retry-user", name: "Retry User", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };

describe("receipt retry pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    status = "failed";
    vi.mocked(db.getReceiptForUser).mockImplementation(async () => ({ id: receiptId, userId: 55, storageKey: "receipts/55/retry.jpg", status } as never));
    vi.mocked(db.transitionReceiptForUser).mockImplementation(async (input) => { status = input.to as typeof status; return { id: receiptId, status } as never; });
    vi.mocked(storageGetSignedUrl).mockResolvedValue("https://signed.example/retry.jpg");
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ merchantName: "Toko Retry", date: "2026-08-20", total: 32000, subtotal: 32000, tax: 0, discount: 0, currency: "IDR", paymentMethod: "cash", category: "Belanja", notes: null, lineItems: [], confidence: { overall: 0.9, merchantName: 0.8, date: 0.8, total: 0.9, category: 0.7, paymentMethod: 0.8 } }) } }] } as never);
  });

  it("takes a failed receipt through retry processing into needs_review", async () => {
    const result = await appRouter.createCaller(context).receipts.retry({ id: receiptId });
    expect(result.total).toBe(32000);
    expect(status).toBe("needs_review");
    expect(db.transitionReceiptForUser).toHaveBeenNthCalledWith(1, { userId: 55, receiptId, from: "failed", to: "processing" });
    expect(db.transitionReceiptForUser).toHaveBeenNthCalledWith(2, { userId: 55, receiptId, from: "processing", to: "needs_review" });
  });
});
