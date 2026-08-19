export const DEFAULT_CATEGORIES = [
  { name: "Makanan", color: "#E88D6C" },
  { name: "Transport", color: "#4F8E82" },
  { name: "Belanja", color: "#8670B8" },
  { name: "Tagihan", color: "#D29A38" },
  { name: "Hiburan", color: "#DD6F8D" },
  { name: "Kesehatan", color: "#4B9DB5" },
  { name: "Pendidikan", color: "#798A49" },
  { name: "Lainnya", color: "#7A9384" },
] as const;

export const RECEIPT_STATUS_TRANSITIONS = {
  uploaded: ["processing"],
  processing: ["needs_review", "failed"],
  needs_review: ["approved", "failed"],
  approved: [],
  failed: ["processing"],
} as const;

export type ReceiptStatus = keyof typeof RECEIPT_STATUS_TRANSITIONS;

export function canTransitionReceiptStatus(from: ReceiptStatus, to: ReceiptStatus) {
  return (RECEIPT_STATUS_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}
