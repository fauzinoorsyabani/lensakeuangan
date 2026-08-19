import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl } from "./storage";

export const RECEIPT_MODEL = "gemini-3-flash-preview" as const;

const nullableNumber = z.number().finite().nonnegative().nullable();
const confidenceSchema = z.object({
  overall: z.number().min(0).max(1),
  merchantName: z.number().min(0).max(1),
  date: z.number().min(0).max(1),
  total: z.number().min(0).max(1),
  category: z.number().min(0).max(1),
  paymentMethod: z.number().min(0).max(1),
}).strict();

export const receiptExtractionSchema = z.object({
  merchantName: z.string().max(255).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  total: nullableNumber,
  subtotal: nullableNumber,
  tax: nullableNumber,
  discount: nullableNumber,
  currency: z.string().length(3),
  paymentMethod: z.enum(["cash", "debit", "credit", "ewallet", "bank_transfer", "other"]),
  category: z.string().max(80).nullable(),
  notes: z.string().max(1000).nullable(),
  lineItems: z.array(z.object({
    name: z.string().min(1).max(255),
    quantity: z.number().finite().positive().nullable(),
    unitPrice: nullableNumber,
    total: z.number().finite().nonnegative(),
  }).strict()).max(100),
  confidence: confidenceSchema,
}).strict();

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

const nullableNumberJson = { anyOf: [{ type: "number" }, { type: "null" }] };
const nullableStringJson = { anyOf: [{ type: "string" }, { type: "null" }] };

const RECEIPT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    merchantName: nullableStringJson,
    date: { anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }] },
    total: nullableNumberJson,
    subtotal: nullableNumberJson,
    tax: nullableNumberJson,
    discount: nullableNumberJson,
    currency: { type: "string" },
    paymentMethod: { type: "string", enum: ["cash", "debit", "credit", "ewallet", "bank_transfer", "other"] },
    category: nullableStringJson,
    notes: nullableStringJson,
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, quantity: nullableNumberJson, unitPrice: nullableNumberJson, total: { type: "number" } },
        required: ["name", "quantity", "unitPrice", "total"],
        additionalProperties: false,
      },
    },
    confidence: {
      type: "object",
      properties: { overall: { type: "number" }, merchantName: { type: "number" }, date: { type: "number" }, total: { type: "number" }, category: { type: "number" }, paymentMethod: { type: "number" } },
      required: ["overall", "merchantName", "date", "total", "category", "paymentMethod"],
      additionalProperties: false,
    },
  },
  required: ["merchantName", "date", "total", "subtotal", "tax", "discount", "currency", "paymentMethod", "category", "notes", "lineItems", "confidence"],
  additionalProperties: false,
} as const;

function requireJsonContent(content: string | unknown[]) {
  if (typeof content !== "string") throw new Error("Model tidak menghasilkan JSON text");
  return JSON.parse(content) as unknown;
}

export async function processReceiptWithAI(userId: number, receiptId: string) {
  const receipt = await db.getReceiptForUser(userId, receiptId);
  if (!receipt) throw new Error("Struk tidak ditemukan");
  if (receipt.status === "uploaded") await db.transitionReceiptForUser({ userId, receiptId, from: "uploaded", to: "processing" });
  else if (receipt.status !== "processing") throw new Error("Struk tidak siap diproses");

  const runId = crypto.randomUUID();
  await db.createExtractionRun({ id: runId, receiptId, userId, model: RECEIPT_MODEL });
  try {
    const imageUrl = await storageGetSignedUrl(receipt.storageKey);
    const result = await invokeLLM({
      model: RECEIPT_MODEL,
      max_tokens: 4096,
      messages: [
        { role: "system", content: "You extract receipt facts precisely. Return only supported JSON. Do not invent values: use null when unreadable. Amounts must be non-negative numbers without currency formatting. Convert an identifiable date to YYYY-MM-DD; otherwise null. Use one allowed paymentMethod and a confidence from 0 to 1 for each requested field." },
        { role: "user", content: [{ type: "text", text: "Extract this receipt into the required schema. The target user interface is Indonesian, but preserve the merchant and item language shown on the receipt." }, { type: "image_url", image_url: { url: imageUrl, detail: "high" } }] },
      ],
      response_format: { type: "json_schema", json_schema: { name: "receipt_extraction", strict: true, schema: RECEIPT_RESPONSE_SCHEMA } },
    });
    const raw = requireJsonContent(result.choices[0]?.message.content ?? "");
    const extraction = receiptExtractionSchema.parse(raw);
    await db.completeExtractionRun({ id: runId, userId, status: "success", confidence: String(extraction.confidence.overall), resultJson: extraction });
    await db.transitionReceiptForUser({ userId, receiptId, from: "processing", to: "needs_review" });
    return extraction;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ekstraksi AI gagal";
    await db.completeExtractionRun({ id: runId, userId, status: "failed", errorMessage: message });
    await db.transitionReceiptForUser({ userId, receiptId, from: "processing", to: "failed", errorMessage: message });
    throw new Error(message);
  }
}
