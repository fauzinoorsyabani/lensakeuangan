import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  categories,
  extractionRuns,
  type InsertUser,
  receipts,
  transactionItems,
  transactions,
  users,
} from "../drizzle/schema";
import { DEFAULT_CATEGORIES, canTransitionReceiptStatus, type ReceiptStatus } from "./finance";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) values.role = user.role;
  else if (user.openId === ENV.ownerOpenId) values.role = "admin";
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function ensureDefaultCategories(userId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ name: categories.name }).from(categories).where(eq(categories.userId, userId));
  const names = new Set(existing.map((row) => row.name));
  const missing = DEFAULT_CATEGORIES.filter((category) => !names.has(category.name));
  if (missing.length) {
    await db.insert(categories).values(missing.map((category) => ({ ...category, userId, type: "expense" as const, isDefault: true })));
  }
}

export async function listCategoriesForUser(userId: number) {
  await ensureDefaultCategories(userId);
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.userId, userId)).orderBy(categories.type, categories.name);
}

export async function getCategoryForUser(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).limit(1);
  return result[0];
}

export async function createCategoryForUser(input: { userId: number; name: string; color: string; type: "expense" | "income" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const created = await db.insert(categories).values({ ...input, isDefault: false }).$returningId();
  return getCategoryForUser(input.userId, created[0]!.id);
}

export async function updateCategoryForUser(userId: number, id: number, patch: { name?: string; color?: string; type?: "expense" | "income" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(categories).set(patch).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return getCategoryForUser(userId, id);
}

export async function deleteCategoryForUser(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const category = await getCategoryForUser(userId, id);
  if (!category) return false;
  if (category.isDefault) throw new Error("Kategori bawaan tidak dapat dihapus");
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return true;
}

export async function listReceiptsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(receipts).where(eq(receipts.userId, userId)).orderBy(desc(receipts.createdAt));
}

export async function getReceiptForUser(userId: number, receiptId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(receipts).where(and(eq(receipts.id, receiptId), eq(receipts.userId, userId))).limit(1);
  return result[0];
}

export async function getReceiptByStorageKeyForUser(userId: number, storageKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(receipts).where(and(eq(receipts.userId, userId), eq(receipts.storageKey, storageKey))).limit(1);
  return result[0];
}

export async function createReceiptForUser(input: { id: string; userId: number; storageKey: string; fileName: string; mimeType: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(receipts).values({ ...input, status: "uploaded" });
  return getReceiptForUser(input.userId, input.id);
}

export async function transitionReceiptForUser(input: { userId: number; receiptId: string; from: ReceiptStatus; to: ReceiptStatus; errorMessage?: string | null }) {
  if (!canTransitionReceiptStatus(input.from, input.to)) throw new Error(`Invalid receipt transition: ${input.from} → ${input.to}`);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(receipts).set({ status: input.to, errorMessage: input.errorMessage ?? null }).where(and(eq(receipts.id, input.receiptId), eq(receipts.userId, input.userId), eq(receipts.status, input.from)));
  const receipt = await getReceiptForUser(input.userId, input.receiptId);
  if (!receipt || receipt.status !== input.to) throw new Error("Status struk tidak dapat diperbarui");
  return receipt;
}

export async function createExtractionRun(input: { id: string; receiptId: string; userId: number; model: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(extractionRuns).values({ ...input, status: "processing" });
}

export async function completeExtractionRun(input: { id: string; userId: number; status: "success" | "failed"; confidence?: string | null; resultJson?: Record<string, unknown> | null; errorMessage?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { id, userId, ...patch } = input;
  await db.update(extractionRuns).set({ ...patch, completedAt: new Date() }).where(and(eq(extractionRuns.id, id), eq(extractionRuns.userId, userId)));
}

type TransactionFilters = { query?: string; categoryId?: number; type?: "expense" | "income"; paymentMethod?: "cash" | "debit" | "credit" | "ewallet" | "bank_transfer" | "other"; from?: Date; to?: Date };

export async function listTransactionsForUser(userId: number, filters: TransactionFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(transactions.userId, userId)];
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.paymentMethod) conditions.push(eq(transactions.paymentMethod, filters.paymentMethod));
  if (filters.query) conditions.push(like(transactions.merchant, `%${filters.query}%`));
  if (filters.from) conditions.push(gte(transactions.occurredAt, filters.from));
  if (filters.to) conditions.push(lte(transactions.occurredAt, filters.to));
  return db
    .select({ transaction: transactions, categoryName: categories.name, categoryColor: categories.color, receiptStorageKey: receipts.storageKey, receiptStatus: receipts.status })
    .from(transactions)
    .leftJoin(categories, and(eq(transactions.categoryId, categories.id), eq(categories.userId, userId)))
    .leftJoin(receipts, and(eq(transactions.receiptId, receipts.id), eq(receipts.userId, userId)))
    .where(and(...conditions))
    .orderBy(desc(transactions.occurredAt));
}

export async function getTransactionForUser(userId: number, id: number) {
  const rows = await listTransactionsForUser(userId);
  return rows.find((row) => row.transaction.id === id);
}

export async function createTransactionForUser(input: {
  userId: number; receiptId?: string | null; categoryId?: number | null; type: "expense" | "income"; merchant?: string | null; occurredAt: Date; total: string; subtotal?: string | null; tax?: string | null; discount?: string | null; currency: string; paymentMethod: "cash" | "debit" | "credit" | "ewallet" | "bank_transfer" | "other"; notes?: string | null; items?: { name: string; quantity?: string | null; unitPrice?: string | null; total: string }[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { items = [], ...transaction } = input;
  const created = await db.insert(transactions).values(transaction).$returningId();
  if (items.length) await db.insert(transactionItems).values(items.map((item) => ({ ...item, transactionId: created[0]!.id })));
  return getTransactionForUser(input.userId, created[0]!.id);
}

export async function updateTransactionForUser(userId: number, id: number, patch: Partial<{ categoryId: number | null; type: "expense" | "income"; merchant: string | null; occurredAt: Date; total: string; subtotal: string | null; tax: string | null; discount: string | null; currency: string; paymentMethod: "cash" | "debit" | "credit" | "ewallet" | "bank_transfer" | "other"; notes: string | null }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(transactions).set(patch).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  return getTransactionForUser(userId, id);
}

export async function deleteTransactionForUser(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function getReviewForReceipt(userId: number, receiptId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const receipt = await getReceiptForUser(userId, receiptId);
  if (!receipt) return undefined;
  const extraction = await db.select().from(extractionRuns).where(and(eq(extractionRuns.receiptId, receiptId), eq(extractionRuns.userId, userId))).orderBy(desc(extractionRuns.createdAt)).limit(1);
  const transaction = await db.select().from(transactions).where(and(eq(transactions.receiptId, receiptId), eq(transactions.userId, userId))).limit(1);
  const items = transaction[0] ? await db.select().from(transactionItems).where(eq(transactionItems.transactionId, transaction[0].id)) : [];
  return { receipt, extraction: extraction[0] ?? null, transaction: transaction[0] ?? null, items };
}

export async function approveReceiptReviewForUser(input: {
  userId: number; receiptId: string; categoryId: number | null; type: "expense" | "income"; merchant: string | null; occurredAt: Date; total: string; subtotal: string | null; tax: string | null; discount: string | null; currency: string; paymentMethod: "cash" | "debit" | "credit" | "ewallet" | "bank_transfer" | "other"; notes: string | null; items: { name: string; quantity?: string | null; unitPrice?: string | null; total: string }[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const receipt = await getReceiptForUser(input.userId, input.receiptId);
  if (!receipt || receipt.status !== "needs_review") throw new Error("Struk tidak siap untuk disetujui");
  const existing = await db.select().from(transactions).where(and(eq(transactions.receiptId, input.receiptId), eq(transactions.userId, input.userId))).limit(1);
  const { items, userId, receiptId, ...transactionData } = input;
  let transactionId: number;
  if (existing[0]) {
    transactionId = existing[0].id;
    await db.update(transactions).set(transactionData).where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
    await db.delete(transactionItems).where(eq(transactionItems.transactionId, transactionId));
  } else {
    const created = await db.insert(transactions).values({ ...transactionData, userId, receiptId }).$returningId();
    transactionId = created[0]!.id;
  }
  if (items.length) await db.insert(transactionItems).values(items.map((item) => ({ ...item, transactionId })));
  await transitionReceiptForUser({ userId, receiptId, from: "needs_review", to: "approved" });
  return getTransactionForUser(userId, transactionId);
}

export async function rejectReceiptForUser(userId: number, receiptId: string) {
  return transitionReceiptForUser({ userId, receiptId, from: "needs_review", to: "failed", errorMessage: "Ditolak pengguna saat review" });
}

export async function getDashboardForUser(userId: number) {
  const rows = await listTransactionsForUser(userId);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthRows = rows.filter(({ transaction }) => transaction.occurredAt.getMonth() === currentMonth && transaction.occurredAt.getFullYear() === currentYear);
  const sum = (type: "expense" | "income") => monthRows.filter(({ transaction }) => transaction.type === type).reduce((total, { transaction }) => total + Number(transaction.total), 0);
  const categoryMap = new Map<string, number>();
  monthRows.filter(({ transaction }) => transaction.type === "expense").forEach(({ transaction, categoryName }) => categoryMap.set(categoryName ?? "Lainnya", (categoryMap.get(categoryName ?? "Lainnya") ?? 0) + Number(transaction.total)));
  const now = new Date();
  const monthlyTrend = Array.from({ length: 6 }, (_, position) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - position), 1);
    const income = rows.filter(({ transaction }) => transaction.occurredAt.getMonth() === date.getMonth() && transaction.occurredAt.getFullYear() === date.getFullYear() && transaction.type === "income").reduce((total, row) => total + Number(row.transaction.total), 0);
    const expense = rows.filter(({ transaction }) => transaction.occurredAt.getMonth() === date.getMonth() && transaction.occurredAt.getFullYear() === date.getFullYear() && transaction.type === "expense").reduce((total, row) => total + Number(row.transaction.total), 0);
    return { label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date), income, expense };
  });
  return {
    summary: { income: sum("income"), expense: sum("expense"), balance: sum("income") - sum("expense") },
    topCategories: Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, total]) => ({ name, total })),
    monthlyTrend,
    recentTransactions: rows.slice(0, 5),
  };
}
