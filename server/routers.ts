import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import * as db from "./db";
import { paymentMethods, transactionTypes } from "../drizzle/schema";
import { processReceiptWithAI } from "./receiptExtraction";
import { storageGetSignedUrl } from "./storage";

const transactionPatch = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  type: z.enum(transactionTypes).optional(),
  merchant: z.string().trim().max(255).nullable().optional(),
  occurredAt: z.coerce.date().optional(),
  total: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  tax: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  discount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  currency: z.string().length(3).optional(),
  paymentMethod: z.enum(paymentMethods).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

function notFound(message: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    summary: protectedProcedure.query(({ ctx }) => db.getDashboardForUser(ctx.user.id)),
  }),
  categories: router({
    list: protectedProcedure.query(({ ctx }) => db.listCategoriesForUser(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), type: z.enum(transactionTypes) })).mutation(async ({ ctx, input }) => {
      return db.createCategoryForUser({ ...input, userId: ctx.user.id });
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), patch: z.object({ name: z.string().trim().min(1).max(80).optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), type: z.enum(transactionTypes).optional() }) })).mutation(async ({ ctx, input }) => {
      const updated = await db.updateCategoryForUser(ctx.user.id, input.id, input.patch);
      return updated ?? notFound("Kategori tidak ditemukan");
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const deleted = await db.deleteCategoryForUser(ctx.user.id, input.id);
        if (!deleted) notFound("Kategori tidak ditemukan");
        return { success: true } as const;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Kategori tidak dapat dihapus" });
      }
    }),
  }),
  receipts: router({
    list: protectedProcedure.query(({ ctx }) => db.listReceiptsForUser(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => db.getReceiptForUser(ctx.user.id, input.id) ?? notFound("Struk tidak ditemukan")),
    imageUrl: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
      const receipt = await db.getReceiptForUser(ctx.user.id, input.id);
      if (!receipt) notFound("Struk tidak ditemukan");
      return { url: await storageGetSignedUrl(receipt.storageKey) };
    }),
    process: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const receipt = await db.getReceiptForUser(ctx.user.id, input.id);
      if (!receipt) notFound("Struk tidak ditemukan");
      if (receipt.status !== "uploaded") throw new TRPCError({ code: "BAD_REQUEST", message: "Hanya struk yang baru diunggah dapat diproses" });
      return processReceiptWithAI(ctx.user.id, receipt.id);
    }),
    retry: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const receipt = await db.getReceiptForUser(ctx.user.id, input.id);
      if (!receipt) notFound("Struk tidak ditemukan");
      if (receipt.status !== "failed") throw new TRPCError({ code: "BAD_REQUEST", message: "Hanya struk gagal yang dapat dicoba kembali" });
      await db.transitionReceiptForUser({ userId: ctx.user.id, receiptId: receipt.id, from: "failed", to: "processing" });
      return processReceiptWithAI(ctx.user.id, receipt.id);
    }),
  }),
  review: router({
    get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => db.getReviewForReceipt(ctx.user.id, input.id) ?? notFound("Struk tidak ditemukan")),
    approve: protectedProcedure.input(z.object({
      id: z.string().uuid(),
      categoryId: z.number().int().positive().nullable(),
      type: z.enum(transactionTypes),
      merchant: z.string().trim().max(255).nullable(),
      occurredAt: z.coerce.date(),
      total: z.string().regex(/^\d+(\.\d{1,2})?$/),
      subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable(),
      tax: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable(),
      discount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable(),
      currency: z.string().length(3),
      paymentMethod: z.enum(paymentMethods),
      notes: z.string().max(1000).nullable(),
      items: z.array(z.object({ name: z.string().trim().min(1).max(255), quantity: z.string().regex(/^\d+(\.\d{1,3})?$/).nullable(), unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable(), total: z.string().regex(/^\d+(\.\d{1,2})?$/) })).max(100),
    })).mutation(async ({ ctx, input }) => {
      if (input.categoryId) {
        const category = await db.getCategoryForUser(ctx.user.id, input.categoryId);
        if (!category) notFound("Kategori tidak ditemukan");
      }
      const { id, ...review } = input;
      return db.approveReceiptReviewForUser({ ...review, userId: ctx.user.id, receiptId: id });
    }),
    reject: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => db.rejectReceiptForUser(ctx.user.id, input.id)),
  }),
  transactions: router({
    list: protectedProcedure.input(z.object({ query: z.string().trim().max(255).optional(), categoryId: z.number().int().positive().optional(), type: z.enum(transactionTypes).optional(), paymentMethod: z.enum(paymentMethods).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() }).optional()).query(({ ctx, input }) => db.listTransactionsForUser(ctx.user.id, input)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => db.getTransactionForUser(ctx.user.id, input.id) ?? notFound("Transaksi tidak ditemukan")),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), patch: transactionPatch })).mutation(async ({ ctx, input }) => {
      if (input.patch.categoryId) {
        const category = await db.getCategoryForUser(ctx.user.id, input.patch.categoryId);
        if (!category) notFound("Kategori tidak ditemukan");
      }
      const updated = await db.updateTransactionForUser(ctx.user.id, input.id, input.patch);
      return updated ?? notFound("Transaksi tidak ditemukan");
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const existing = await db.getTransactionForUser(ctx.user.id, input.id);
      if (!existing) notFound("Transaksi tidak ditemukan");
      await db.deleteTransactionForUser(ctx.user.id, input.id);
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
