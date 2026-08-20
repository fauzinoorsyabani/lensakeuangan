import { ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle, RefreshCw, RotateCcw, Save, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

type PaymentMethod = "cash" | "debit" | "credit" | "ewallet" | "bank_transfer" | "other";
type Extraction = {
  merchantName: string | null; date: string | null; total: number | null; subtotal: number | null; tax: number | null; discount: number | null; currency: string; paymentMethod: PaymentMethod; category: string | null; notes: string | null;
  lineItems: { name: string; quantity: number | null; unitPrice: number | null; total: number }[];
  confidence: { overall: number; merchantName: number; date: number; total: number; category: number; paymentMethod: number };
};
type ReviewForm = { categoryId: number | null; type: "expense" | "income"; merchant: string; occurredAt: string; total: string; subtotal: string; tax: string; discount: string; currency: string; paymentMethod: PaymentMethod; notes: string; items: { name: string; quantity: string; unitPrice: string; total: string }[] };

const methodLabels: Record<PaymentMethod, string> = { cash: "Tunai", debit: "Kartu debit", credit: "Kartu kredit", ewallet: "E-wallet", bank_transfer: "Transfer bank", other: "Lainnya" };
const numericString = (value: number | null | undefined) => value === null || value === undefined ? "" : String(value);
const confidenceTone = (value: number) => value >= 0.8 ? "bg-[#e2f3e3] text-[#247247]" : value >= 0.55 ? "bg-[#fff2d9] text-[#9a6615]" : "bg-[#fff0eb] text-[#bf4938]";

function StatusBadge({ status }: { status: string }) {
  const tone = status === "needs_review" ? "bg-[#fff2d9] text-[#9a6615]" : status === "failed" ? "bg-[#fff0eb] text-[#bf4938]" : "bg-[#e2f3e3] text-[#247247]";
  const Icon = status === "needs_review" ? CircleAlert : status === "failed" ? XCircle : CheckCircle2;
  return <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${tone}`}><Icon className="h-4 w-4" />{status.replaceAll("_", " ")}</span>;
}

export default function ReceiptReview() {
  const [, params] = useRoute("/review/:id");
  const receiptId = params?.id ?? "";
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const review = trpc.review.get.useQuery({ id: receiptId }, { enabled: Boolean(receiptId) });
  const categories = trpc.categories.list.useQuery();
  const retry = trpc.receipts.retry.useMutation();
  const approve = trpc.review.approve.useMutation();
  const reject = trpc.review.reject.useMutation();
  const [form, setForm] = useState<ReviewForm | null>(null);

  useEffect(() => {
    const extraction = review.data?.extraction?.resultJson as Extraction | undefined;
    if (!review.data || !extraction) return;
    const suggestedCategory = categories.data?.find((category) => category.name.toLowerCase() === extraction.category?.toLowerCase());
    setForm({
      categoryId: suggestedCategory?.id ?? null,
      type: "expense",
      merchant: extraction.merchantName ?? "",
      occurredAt: extraction.date ?? new Date().toISOString().slice(0, 10),
      total: numericString(extraction.total), subtotal: numericString(extraction.subtotal), tax: numericString(extraction.tax), discount: numericString(extraction.discount),
      currency: extraction.currency || "IDR", paymentMethod: extraction.paymentMethod, notes: extraction.notes ?? "",
      items: extraction.lineItems.map((item) => ({ name: item.name, quantity: numericString(item.quantity), unitPrice: numericString(item.unitPrice), total: numericString(item.total) })),
    });
  }, [review.data, categories.data]);

  const patch = (values: Partial<ReviewForm>) => setForm((current) => current ? { ...current, ...values } : current);

  async function retryReceipt() {
    try {
      await retry.mutateAsync({ id: receiptId });
      await review.refetch();
      toast.success("Struk sedang diproses ulang.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pemrosesan ulang gagal");
    }
  }

  async function rejectReceipt() {
    try {
      await reject.mutateAsync({ id: receiptId });
      toast.success("Struk ditandai gagal dan tidak masuk ke transaksi.");
      setLocation("/scan");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Struk tidak dapat ditolak");
    }
  }

  async function submitApproval() {
    if (!form || !receiptId || !form.total) return toast.error("Nilai total wajib diisi sebelum menyetujui transaksi.");
    try {
      await approve.mutateAsync({
        id: receiptId, categoryId: form.categoryId, type: form.type, merchant: form.merchant || null, occurredAt: new Date(`${form.occurredAt}T00:00:00`),
        total: form.total, subtotal: form.subtotal || null, tax: form.tax || null, discount: form.discount || null, currency: form.currency.toUpperCase(), paymentMethod: form.paymentMethod, notes: form.notes || null,
        items: form.items.filter((item) => item.name && item.total).map((item) => ({ name: item.name, quantity: item.quantity || null, unitPrice: item.unitPrice || null, total: item.total })),
      });
      await utils.dashboard.summary.invalidate();
      await utils.transactions.list.invalidate();
      toast.success("Transaksi disetujui dan masuk ke catatan keuangan Anda.");
      setLocation("/transaksi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Persetujuan transaksi gagal");
    }
  }

  if (review.isLoading) return <div className="grid min-h-[48vh] place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#207047]" /></div>;
  if (review.error || !review.data) return <FailureCard title="Review struk tidak dapat dimuat." description="Silakan kembali ke halaman scan dan pilih struk lain." actionLabel="Kembali ke Scan" onAction={() => setLocation("/scan")} />;

  const status = review.data.receipt.status;
  const extraction = review.data.extraction?.resultJson as Extraction | undefined;
  if (status === "failed") return <div className="animate-in fade-in duration-500"><ReviewHeader status={status} onBack={() => setLocation("/scan")} /><FailureCard title="Ekstraksi belum berhasil." description={review.data.receipt.errorMessage || "Coba ulang dengan foto yang lebih terang dan seluruh total terlihat."} actionLabel="Coba proses lagi" loading={retry.isPending} onAction={retryReceipt} /></div>;
  if (!form || !extraction) return <div className="animate-in fade-in duration-500"><ReviewHeader status={status} onBack={() => setLocation("/scan")} /><FailureCard title="Hasil ekstraksi tidak lengkap." description="Data struk ini belum siap untuk direview. Silakan kembali ke scan atau proses ulang apabila status gagal." actionLabel="Kembali ke Scan" onAction={() => setLocation("/scan")} /></div>;

  const isReviewable = status === "needs_review";
  const visibleForm = form;
  const imageUrl = `/api/storage/${encodeURIComponent(review.data.receipt.storageKey).replace(/%2F/g, "/")}`;
  const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#dfe6dc] bg-white px-3 text-sm text-[#163d32] outline-none transition focus:border-[#4d8a68] focus:ring-2 focus:ring-[#d9efdf] disabled:cursor-not-allowed disabled:bg-[#f6f7f5]";

  function patchItem(index: number, values: Partial<ReviewForm["items"][number]>) {
    const items = [...visibleForm.items];
    items[index] = { ...items[index], ...values };
    patch({ items });
  }

  return (
    <div className="ai-review-workbench animate-in fade-in duration-500">
      <ReviewHeader status={status} onBack={() => setLocation("/scan")} />
      <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="ai-review-source overflow-hidden rounded-[1.5rem] border border-[#e3e8e0] bg-white p-4 shadow-[0_10px_30px_rgba(45,69,57,0.05)]">
          <div className="relative overflow-hidden rounded-xl bg-[#eef2ed]"><img src={imageUrl} alt={`Struk ${review.data.receipt.fileName}`} className="max-h-[650px] w-full object-contain" /></div>
          <div className="mt-4 flex items-center justify-between text-xs text-[#77837c]"><span className="truncate pr-4">{review.data.receipt.fileName}</span><span className={`ai-confidence rounded-full px-2 py-1 text-[10px] font-bold ${confidenceTone(extraction.confidence.overall)}`}>Keyakinan {Math.round(extraction.confidence.overall * 100)}%</span></div>
        </article>
        <article className="ai-review-draft rounded-[1.5rem] border border-[#e3e8e0] bg-white p-5 shadow-[0_10px_30px_rgba(45,69,57,0.05)] lg:p-6">
          <div className="flex items-start justify-between"><div><p className="font-display text-lg font-bold">Detail transaksi</p><p className="mt-1 text-xs text-[#7a867e]">Ubah setiap field yang tidak sesuai dengan struk.</p></div><span className={`ai-confidence rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${confidenceTone(extraction.confidence.overall)}`}>AI {Math.round(extraction.confidence.overall * 100)}%</span></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Merchant" confidence={extraction.confidence.merchantName}><input value={form.merchant} disabled={!isReviewable} onChange={(event) => patch({ merchant: event.target.value })} className={inputClass} /></Field>
            <Field label="Tanggal" confidence={extraction.confidence.date}><input type="date" value={form.occurredAt} disabled={!isReviewable} onChange={(event) => patch({ occurredAt: event.target.value })} className={inputClass} /></Field>
            <Field label="Total" confidence={extraction.confidence.total}><input inputMode="decimal" value={form.total} disabled={!isReviewable} onChange={(event) => patch({ total: event.target.value })} className={inputClass} /></Field>
            <Field label="Kategori" confidence={extraction.confidence.category}><select value={form.categoryId?.toString() ?? "none"} disabled={!isReviewable} onChange={(event) => patch({ categoryId: event.target.value === "none" ? null : Number(event.target.value) })} className={inputClass}><option value="none">Pilih kategori</option>{categories.data?.filter((category) => category.type === form.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
            <Field label="Tipe"><select value={form.type} disabled={!isReviewable} onChange={(event) => patch({ type: event.target.value as ReviewForm["type"] })} className={inputClass}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></Field>
            <Field label="Pembayaran" confidence={extraction.confidence.paymentMethod}><select value={form.paymentMethod} disabled={!isReviewable} onChange={(event) => patch({ paymentMethod: event.target.value as PaymentMethod })} className={inputClass}>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Subtotal"><input inputMode="decimal" value={form.subtotal} disabled={!isReviewable} onChange={(event) => patch({ subtotal: event.target.value })} className={inputClass} /></Field>
            <Field label="Pajak"><input inputMode="decimal" value={form.tax} disabled={!isReviewable} onChange={(event) => patch({ tax: event.target.value })} className={inputClass} /></Field>
            <Field label="Diskon"><input inputMode="decimal" value={form.discount} disabled={!isReviewable} onChange={(event) => patch({ discount: event.target.value })} className={inputClass} /></Field>
            <Field label="Mata uang"><input value={form.currency} maxLength={3} disabled={!isReviewable} onChange={(event) => patch({ currency: event.target.value.toUpperCase() })} className={inputClass} /></Field>
          </div>
          <label className="mt-4 block"><span className="text-xs font-bold text-[#5f7066]">Catatan</span><textarea value={form.notes} disabled={!isReviewable} onChange={(event) => patch({ notes: event.target.value })} className={`${inputClass} h-20 py-2`} /></label>
          <div className="mt-5 border-t border-[#edf0eb] pt-5"><p className="text-sm font-bold">Item belanja</p><p className="mt-1 text-xs text-[#8a968d]">Setiap nama, jumlah, harga satuan, dan total dapat dikoreksi.</p><div className="mt-3 space-y-2">{form.items.length ? form.items.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_74px_94px_94px]"><input placeholder="Nama item" value={item.name} disabled={!isReviewable} onChange={(event) => patchItem(index, { name: event.target.value })} className={inputClass.replace("mt-1.5 ", "")} /><input placeholder="Jml" inputMode="decimal" value={item.quantity} disabled={!isReviewable} onChange={(event) => patchItem(index, { quantity: event.target.value })} className={inputClass.replace("mt-1.5 ", "")} /><input placeholder="Satuan" inputMode="decimal" value={item.unitPrice} disabled={!isReviewable} onChange={(event) => patchItem(index, { unitPrice: event.target.value })} className={inputClass.replace("mt-1.5 ", "")} /><input placeholder="Total" inputMode="decimal" value={item.total} disabled={!isReviewable} onChange={(event) => patchItem(index, { total: event.target.value })} className={inputClass.replace("mt-1.5 ", "")} /></div>) : <p className="text-xs text-[#89948c]">Tidak ada item yang dapat dibaca dari struk ini.</p>}</div></div>
          {isReviewable ? <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#edf0eb] pt-5 sm:flex-row sm:justify-between"><button onClick={rejectReceipt} disabled={reject.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#f0c6bb] px-4 text-xs font-bold text-[#c14c39] hover:bg-[#fff7f4]"><RotateCcw className="h-4 w-4" />Tolak hasil</button><button onClick={submitApproval} disabled={approve.isPending} className="ai-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#163d32] px-5 text-xs font-bold text-white hover:bg-[#245143] disabled:opacity-60">{approve.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Setujui transaksi</button></div> : null}
        </article>
      </section>
    </div>
  );
}

function ReviewHeader({ status, onBack }: { status: string; onBack: () => void }) {
  return <><button onClick={onBack} className="inline-flex items-center gap-2 text-xs font-bold text-[#688078] hover:text-[#163d32]"><ArrowLeft className="h-4 w-4" />Kembali ke Scan</button><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e85d48]">Review hasil AI</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Periksa sebelum dicatat.</h1><p className="mt-2 text-sm text-[#718078]">AI memberi draf; Anda yang memegang keputusan final.</p></div><StatusBadge status={status} /></div></>;
}

function FailureCard({ title, description, actionLabel, onAction, loading = false }: { title: string; description: string; actionLabel: string; onAction: () => void; loading?: boolean }) {
  return <section className="mt-6 rounded-2xl border border-[#f4d8cc] bg-[#fff9f6] p-5"><p className="text-sm font-bold text-[#7a3d30]">{title}</p><p className="mt-1 text-xs leading-5 text-[#91655b]">{description}</p><button onClick={onAction} disabled={loading} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#e85d48] px-4 text-xs font-bold text-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{actionLabel}</button></section>;
}

function Field({ label, confidence, children }: { label: string; confidence?: number; children: React.ReactNode }) {
  return <label className="block"><span className="flex items-center gap-2 text-xs font-bold text-[#5f7066]">{label}{confidence !== undefined ? <i className={`h-1.5 w-1.5 rounded-full ${confidence >= 0.8 ? "bg-[#36a15d]" : confidence >= 0.55 ? "bg-[#e2a83a]" : "bg-[#e85d48]"}`} /> : null}</span>{children}</label>;
}
