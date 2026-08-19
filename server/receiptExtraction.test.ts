import { describe, expect, it } from "vitest";
import { receiptExtractionSchema } from "./receiptExtraction";

const validExtraction = {
  merchantName: "Kedai Nusantara",
  date: "2026-08-20",
  total: 45000,
  subtotal: 50000,
  tax: 0,
  discount: 5000,
  currency: "IDR",
  paymentMethod: "ewallet",
  category: "Makanan",
  notes: null,
  lineItems: [{ name: "Nasi goreng", quantity: 1, unitPrice: 50000, total: 50000 }],
  confidence: { overall: 0.92, merchantName: 0.95, date: 0.86, total: 0.99, category: 0.76, paymentMethod: 0.7 },
};

describe("receipt extraction schema", () => {
  it("accepts a complete structured receipt extraction", () => {
    expect(receiptExtractionSchema.parse(validExtraction)).toMatchObject({ merchantName: "Kedai Nusantara", total: 45000 });
  });

  it("rejects unsupported fields and malformed dates", () => {
    expect(() => receiptExtractionSchema.parse({ ...validExtraction, guessedValue: "should not exist" })).toThrow();
    expect(() => receiptExtractionSchema.parse({ ...validExtraction, date: "20/08/2026" })).toThrow();
  });
});
