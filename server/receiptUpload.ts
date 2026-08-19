import type { Express, Request, Response } from "express";
import { z } from "zod";
import { createReceiptForUser } from "./db";
import { createContext } from "./_core/context";
import { storagePut } from "./storage";

const MAX_FILES = 5;
const MAX_BYTES_PER_FILE = 6 * 1024 * 1024;
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

const uploadSchema = z.object({
  files: z.array(z.object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(allowedMimeTypes),
    dataUrl: z.string().min(40),
  })).min(1).max(MAX_FILES),
});

function decodeImage(dataUrl: string, mimeType: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1] !== mimeType) throw new Error("Format gambar tidak valid");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.byteLength > MAX_BYTES_PER_FILE) throw new Error("Ukuran gambar harus antara 1 byte dan 6 MB");
  return bytes;
}

function extensionFor(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function uploadReceipts(req: Request, res: Response) {
  const context = await createContext({ req, res } as never);
  if (!context.user) return res.status(401).json({ error: "Silakan masuk untuk mengunggah struk" });
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Data upload tidak valid" });

  try {
    const uploaded = await Promise.all(parsed.data.files.map(async (file) => {
      const id = crypto.randomUUID();
      const bytes = decodeImage(file.dataUrl, file.mimeType);
      const uploadedFile = await storagePut(`receipts/${context.user!.id}/${id}.${extensionFor(file.mimeType)}`, bytes, file.mimeType);
      const receipt = await createReceiptForUser({ id, userId: context.user!.id, storageKey: uploadedFile.key, fileName: file.fileName, mimeType: file.mimeType });
      return { id: receipt!.id, storageKey: receipt!.storageKey, status: receipt!.status, url: uploadedFile.url };
    }));
    return res.status(201).json({ receipts: uploaded });
  } catch (error) {
    console.error("[Receipt upload]", error);
    return res.status(400).json({ error: error instanceof Error ? error.message : "Upload struk gagal" });
  }
}

export function registerReceiptUpload(app: Express) {
  app.post("/api/receipts/upload", uploadReceipts);
}
