import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  listCategoriesForUser: vi.fn(),
  createCategoryForUser: vi.fn(),
  updateCategoryForUser: vi.fn(),
  deleteCategoryForUser: vi.fn(),
  getCategoryForUser: vi.fn(),
  getTransactionForUser: vi.fn(),
  getReviewForReceipt: vi.fn(),
  approveReceiptReviewForUser: vi.fn(),
  rejectReceiptForUser: vi.fn(),
  getReceiptForUser: vi.fn(),
  transitionReceiptForUser: vi.fn(),
}));
vi.mock("./receiptExtraction", () => ({ processReceiptWithAI: vi.fn() }));

import { appRouter } from "./routers";
import * as db from "./db";
import { processReceiptWithAI } from "./receiptExtraction";

const receiptId = "00000000-0000-4000-8000-000000000001";

function createContext(userId: number): TrpcContext {
  return { user: { id: userId, openId: `user-${userId}`, name: "Test User", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("user-scoped finance routers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes category listing and creation to the current authenticated user", async () => {
    vi.mocked(db.listCategoriesForUser).mockResolvedValue([]);
    vi.mocked(db.createCategoryForUser).mockResolvedValue({ id: 1 } as never);
    const caller = appRouter.createCaller(createContext(41));
    await caller.categories.list();
    await caller.categories.create({ name: "Kopi", color: "#123456", type: "expense" });
    expect(db.listCategoriesForUser).toHaveBeenCalledWith(41);
    expect(db.createCategoryForUser).toHaveBeenCalledWith({ userId: 41, name: "Kopi", color: "#123456", type: "expense" });
  });

  it("scopes category update and deletion to the current authenticated user", async () => {
    vi.mocked(db.updateCategoryForUser).mockResolvedValue({ id: 8 } as never);
    vi.mocked(db.deleteCategoryForUser).mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext(42));
    await caller.categories.update({ id: 8, patch: { name: "Kopi baru" } });
    await caller.categories.delete({ id: 8 });
    expect(db.updateCategoryForUser).toHaveBeenCalledWith(42, 8, { name: "Kopi baru" });
    expect(db.deleteCategoryForUser).toHaveBeenCalledWith(42, 8);
  });

  it("scopes transaction lookup to the current authenticated user", async () => {
    vi.mocked(db.getTransactionForUser).mockResolvedValue({ transaction: { id: 7 } } as never);
    await appRouter.createCaller(createContext(43)).transactions.get({ id: 7 });
    expect(db.getTransactionForUser).toHaveBeenCalledWith(43, 7);
  });

  it("scopes review get, approval, and rejection to the current authenticated user", async () => {
    vi.mocked(db.getReviewForReceipt).mockResolvedValue({ receipt: { id: receiptId } } as never);
    vi.mocked(db.getCategoryForUser).mockResolvedValue({ id: 9 } as never);
    vi.mocked(db.approveReceiptReviewForUser).mockResolvedValue({ transaction: { id: 1 } } as never);
    vi.mocked(db.rejectReceiptForUser).mockResolvedValue({ id: receiptId, status: "failed" } as never);
    const caller = appRouter.createCaller(createContext(44));
    await caller.review.get({ id: receiptId });
    await caller.review.approve({ id: receiptId, categoryId: 9, type: "expense", merchant: "Warung", occurredAt: new Date("2026-08-20"), total: "12000", subtotal: null, tax: null, discount: null, currency: "IDR", paymentMethod: "cash", notes: null, items: [] });
    await caller.review.reject({ id: receiptId });
    expect(db.getReviewForReceipt).toHaveBeenCalledWith(44, receiptId);
    expect(db.getCategoryForUser).toHaveBeenCalledWith(44, 9);
    expect(db.approveReceiptReviewForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 44, receiptId }));
    expect(db.rejectReceiptForUser).toHaveBeenCalledWith(44, receiptId);
  });

  it("moves a failed receipt into processing before the retry pipeline runs for the current user", async () => {
    vi.mocked(db.getReceiptForUser).mockResolvedValue({ id: receiptId, status: "failed" } as never);
    vi.mocked(db.transitionReceiptForUser).mockResolvedValue({ id: receiptId, status: "processing" } as never);
    vi.mocked(processReceiptWithAI).mockResolvedValue({ total: 10000 } as never);
    await appRouter.createCaller(createContext(45)).receipts.retry({ id: receiptId });
    expect(db.transitionReceiptForUser).toHaveBeenCalledWith({ userId: 45, receiptId, from: "failed", to: "processing" });
    expect(processReceiptWithAI).toHaveBeenCalledWith(45, receiptId);
  });
});
