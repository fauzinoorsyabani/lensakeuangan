import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const transactionTypes = ["expense", "income"] as const;
export const paymentMethods = ["cash", "debit", "credit", "ewallet", "bank_transfer", "other"] as const;
export const receiptStatuses = ["uploaded", "processing", "needs_review", "approved", "failed"] as const;
export const extractionStatuses = ["processing", "success", "failed"] as const;

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    type: mysqlEnum("type", transactionTypes).notNull().default("expense"),
    color: varchar("color", { length: 16 }).notNull().default("#7A9384"),
    isDefault: boolean("isDefault").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("categories_user_name_unique").on(table.userId, table.name),
    index("categories_user_type_idx").on(table.userId, table.type),
  ],
);

export const receipts = mysqlTable(
  "receipts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 100 }).notNull(),
    status: mysqlEnum("status", receiptStatuses).notNull().default("uploaded"),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("receipts_user_status_idx").on(table.userId, table.status), index("receipts_user_created_idx").on(table.userId, table.createdAt)],
);

export const transactions = mysqlTable(
  "transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    receiptId: varchar("receiptId", { length: 36 }).references(() => receipts.id, { onDelete: "set null" }),
    categoryId: int("categoryId").references(() => categories.id, { onDelete: "set null" }),
    type: mysqlEnum("type", transactionTypes).notNull().default("expense"),
    merchant: varchar("merchant", { length: 255 }),
    occurredAt: timestamp("occurredAt").notNull(),
    total: decimal("total", { precision: 14, scale: 2 }).notNull(),
    subtotal: decimal("subtotal", { precision: 14, scale: 2 }),
    tax: decimal("tax", { precision: 14, scale: 2 }),
    discount: decimal("discount", { precision: 14, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("IDR"),
    paymentMethod: mysqlEnum("paymentMethod", paymentMethods).notNull().default("other"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("transactions_user_occurred_idx").on(table.userId, table.occurredAt),
    index("transactions_user_category_idx").on(table.userId, table.categoryId),
    index("transactions_receipt_idx").on(table.receiptId),
  ],
);

export const transactionItems = mysqlTable(
  "transaction_items",
  {
    id: int("id").autoincrement().primaryKey(),
    transactionId: int("transactionId").notNull().references(() => transactions.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 3 }),
    unitPrice: decimal("unitPrice", { precision: 14, scale: 2 }),
    total: decimal("total", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("transaction_items_transaction_idx").on(table.transactionId)],
);

export const extractionRuns = mysqlTable(
  "extraction_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    receiptId: varchar("receiptId", { length: 36 }).notNull().references(() => receipts.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    model: varchar("model", { length: 100 }).notNull(),
    status: mysqlEnum("status", extractionStatuses).notNull().default("processing"),
    confidence: decimal("confidence", { precision: 5, scale: 4 }),
    resultJson: json("resultJson"),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  (table) => [index("extraction_runs_receipt_idx").on(table.receiptId), index("extraction_runs_user_status_idx").on(table.userId, table.status)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
