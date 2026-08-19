import { beforeEach, describe, expect, it, vi } from "vitest";

const receiptId = "00000000-0000-4000-8000-000000000002";
const validPayload = {
  merchantName: "Warung Uji", date: "2026-08-20", total: 25000, subtotal: 25000, tax: 0, discount: 0, currency: "IDR", paymentMethod: "cash", category: "Makanan", notes: null,
  lineItems: [{ name: "Teh", quantity: 1, unitPrice: 25000, total: 25000 }],
  confidence: { overall: 0.9, merchantName: 0.9, date: 0.9, total: 0.9, category: 0.8, paymentMethod: 0.8 },
};

vi.mock("./db", () => ({
  getReceiptForUser: vi.fn(),
  transitionReceiptForUser: vi.fn(),
  createExtractionRun: vi.fn(),
  completeExtractionRun: vi.fn(),
}));
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl } from "./storage";
import { processReceiptWithAI, RECEIPT_MODEL } from "./receiptExtraction";

describe("receipt AI pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("processes an uploaded receipt through needs_review with the required model", async () => {
    vi.mocked(db.getReceiptForUser).mockResolvedValue({ id: receiptId, status: "uploaded", storageKey: "receipts/77/example.jpg" } as never);
    vi.mocked(db.transitionReceiptForUser).mockResolvedValue({ id: receiptId, status: "needs_review" } as never);
    vi.mocked(storageGetSignedUrl).mockResolvedValue("https://signed.example/receipt.jpg");
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validPayload) } }] } as never);

    const result = await processReceiptWithAI(77, receiptId);

    expect(result.total).toBe(25000);
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: RECEIPT_MODEL }));
    expect(db.transitionReceiptForUser).toHaveBeenNthCalledWith(1, expect.objectContaining({ userId: 77, receiptId, from: "uploaded", to: "processing" }));
    expect(db.transitionReceiptForUser).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: 77, receiptId, from: "processing", to: "needs_review" }));
  });
});
