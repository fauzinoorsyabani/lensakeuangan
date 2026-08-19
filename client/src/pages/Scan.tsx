import { Camera, CheckCircle2, FileImage, Info, LoaderCircle, Plus, ScanLine, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

type CapturedReceipt = { id: string; file: File; preview: string };
type UploadedReceipt = { id: string; storageKey: string; status: string; url: string };

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gambar tidak dapat dibaca"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function Scan() {
  const [, setLocation] = useLocation();
  const processReceipt = trpc.receipts.process.useMutation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<CapturedReceipt[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedReceipt[]>([]);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Kamera browser tidak tersedia. Pilih foto dari galeri Anda.");
      return;
    }
    try {
      setCameraError(null);
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      setStream(nextStream);
    } catch {
      setCameraError("Izin kamera ditolak atau kamera tidak tersedia. Anda tetap dapat memilih foto dari galeri.");
    }
  }

  function addFiles(files: File[]) {
    const valid = files.filter((file) => acceptedTypes.includes(file.type) && file.size <= 6 * 1024 * 1024);
    if (valid.length !== files.length) toast.error("Hanya JPG, PNG, atau WebP hingga 6 MB yang dapat digunakan.");
    const remaining = Math.max(0, 5 - receipts.length);
    if (!remaining) return toast.error("Maksimal lima foto dapat diproses dalam satu kali scan.");
    setReceipts((current) => [...current, ...valid.slice(0, remaining).map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }))]);
    setUploaded([]);
  }

  function onFilePicker(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return toast.error("Foto tidak dapat dibuat. Coba ambil ulang.");
      addFiles([new File([blob], `struk-${Date.now()}.jpg`, { type: "image/jpeg" })]);
      stopCamera();
    }, "image/jpeg", 0.9);
  }

  function removeReceipt(id: string) {
    setReceipts((current) => {
      const found = current.find((receipt) => receipt.id === id);
      if (found) URL.revokeObjectURL(found.preview);
      return current.filter((receipt) => receipt.id !== id);
    });
    setUploaded([]);
  }

  async function uploadReceipts() {
    if (!receipts.length) return toast.error("Ambil atau pilih setidaknya satu foto struk terlebih dahulu.");
    setUploading(true);
    try {
      const files = await Promise.all(receipts.map(async (receipt) => ({ fileName: receipt.file.name, mimeType: receipt.file.type, dataUrl: await fileToDataUrl(receipt.file) })));
      const response = await fetch("/api/receipts/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files }) });
      const payload = await response.json() as { receipts?: UploadedReceipt[]; error?: string };
      if (!response.ok || !payload.receipts) throw new Error(payload.error || "Upload struk gagal");
      setUploaded(payload.receipts);
      const results = await Promise.allSettled(payload.receipts.map((receipt) => processReceipt.mutateAsync({ id: receipt.id })));
      const failures = results.filter((result) => result.status === "rejected").length;
      if (failures) toast.error(`${failures} foto belum berhasil diproses. Anda dapat mencobanya lagi dari review.`);
      else toast.success(`${payload.receipts.length} struk berhasil diproses dan siap Anda periksa.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload struk gagal");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-500">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e85d48]">Scan struk</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Ambil foto, lalu periksa detailnya.</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#718078]">Pastikan seluruh struk terlihat dan pencahayaan cukup. Anda dapat menambahkan lebih dari satu foto untuk struk yang panjang.</p>
      <section className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="ai-capture overflow-hidden rounded-[2rem] bg-[#163d32] p-4 shadow-[0_18px_45px_rgba(22,61,50,0.17)]">
          <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[1.4rem] border border-white/15 bg-[radial-gradient(circle_at_50%_20%,#305e4f_0%,#1a4739_43%,#123228_100%)]">
            {stream ? <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" /> : null}
            <div className="absolute inset-[12%] rounded-[1.4rem] border-2 border-dashed border-[#f5be73]/90" />
            {!stream ? <div className="relative z-10 text-center text-white"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-[#f5be73]"><ScanLine className="h-7 w-7" /></span><p className="mt-4 text-sm font-bold">Kamera siap digunakan</p><p className="mt-1 max-w-[220px] text-xs leading-5 text-[#cbe1d4]">Fitur kamera akan meminta izin perangkat Anda saat Anda membukanya.</p></div> : <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center"><button onClick={capturePhoto} className="grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-[#f5be73] shadow-xl"><span className="h-10 w-10 rounded-full border-2 border-[#163d32]" /></button></div>}
            <span className="absolute bottom-5 left-5 rounded-full bg-black/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#f1d6ad]">Frame guide</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">{stream ? <button onClick={stopCamera} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-bold text-white transition hover:bg-white/15"><X className="h-4 w-4" />Tutup kamera</button> : <button onClick={openCamera} className="ai-primary flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f5be73] text-sm font-bold text-[#163d32] transition hover:bg-[#ffd494]"><Camera className="h-4 w-4" />Buka kamera</button>}<button onClick={() => inputRef.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 text-sm font-bold text-white transition hover:bg-white/15"><FileImage className="h-4 w-4" />Pilih foto</button></div>
        </div>
        <div className="space-y-4"><article className="rounded-2xl border border-[#e3e8e0] bg-white p-5 shadow-[0_10px_30px_rgba(45,69,57,0.05)]"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e0f0e1] text-[#207047]"><Info className="h-5 w-5" /></div><h2 className="mt-4 font-display text-lg font-bold">Hasil yang lebih jelas</h2><ul className="mt-3 space-y-2 text-sm leading-5 text-[#718078]"><li>• Letakkan struk pada permukaan datar.</li><li>• Hindari pantulan cahaya dan bayangan.</li><li>• Foto bagian atas hingga total pembayaran.</li></ul></article><article className="rounded-2xl border border-[#f4d8cc] bg-[#fff9f6] p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#e85d48]" /><div><h2 className="text-sm font-bold text-[#6e3226]">Foto Anda tetap dalam kontrol</h2><p className="mt-1 text-xs leading-5 text-[#8c6259]">Foto struk disimpan sebagai file terpisah dan data hasil AI selalu menunggu persetujuan Anda.</p></div></div></article></div>
      </section>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFilePicker} />
      <canvas ref={canvasRef} className="hidden" />
      {cameraError ? <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#f4d8cc] bg-[#fff9f6] p-4 text-xs leading-5 text-[#8c6259]"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#e85d48]" />{cameraError}</div> : null}
      {receipts.length ? <section className="mt-7 rounded-[1.5rem] border border-[#e3e8e0] bg-white p-5 shadow-[0_10px_30px_rgba(45,69,57,0.05)]"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-display text-lg font-bold">Foto siap diunggah</p><p className="mt-1 text-xs text-[#7a867e]">Pilih ulang atau hapus foto sebelum memulai pemrosesan AI.</p></div><button onClick={uploadReceipts} disabled={uploading} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#163d32] px-4 text-sm font-bold text-white transition hover:bg-[#245143] disabled:cursor-not-allowed disabled:opacity-60">{uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}{uploading ? "Mengunggah…" : `Unggah ${receipts.length} foto`}</button></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{receipts.map((receipt) => <article key={receipt.id} className="group relative aspect-square overflow-hidden rounded-xl bg-[#eef2ed]"><img src={receipt.preview} alt={`Pratinjau ${receipt.file.name}`} className="h-full w-full object-cover" /><button onClick={() => removeReceipt(receipt.id)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-[#163d32]/85 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Hapus ${receipt.file.name}`}><Trash2 className="h-4 w-4" /></button><span className="absolute inset-x-0 bottom-0 truncate bg-[#163d32]/75 px-2 py-1.5 text-[10px] font-semibold text-white">{receipt.file.name}</span></article>)}<button onClick={() => inputRef.current?.click()} className="grid aspect-square place-items-center rounded-xl border border-dashed border-[#cbd8cb] bg-[#fbfcfa] text-[#699279] transition hover:bg-[#eef6ed]"><span className="flex flex-col items-center gap-2 text-xs font-bold"><Plus className="h-5 w-5" />Tambah</span></button></div></section> : null}
      {uploaded.length ? <section className="mt-5 rounded-2xl border border-[#cde2cf] bg-[#f1f9ef] p-4 text-sm text-[#245e38]"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>{uploaded.length} foto tersimpan aman.</strong> Kami sudah mengirimnya ke AI untuk diekstrak dan menyiapkan setiap hasil untuk review Anda.</p></div><div className="mt-3 flex flex-wrap gap-2">{uploaded.map((receipt, index) => <button key={receipt.id} onClick={() => setLocation(`/review/${receipt.id}`)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#245e38] shadow-sm hover:bg-[#e4f2e2]">Review foto {index + 1}</button>)}</div></section> : null}
    </div>
  );
}
