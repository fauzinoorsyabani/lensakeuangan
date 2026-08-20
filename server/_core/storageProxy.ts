import type { Express } from "express";
import { createContext } from "./context";
import { getReceiptByStorageKeyForUser } from "../db";
import { storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get(["/api/storage/*", "/manus-storage/*"], async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      const context = await createContext({ req, res } as never);
      if (!context.user) return res.status(401).send("Silakan masuk untuk membuka gambar struk");
      const receipt = await getReceiptByStorageKeyForUser(context.user.id, key);
      if (!receipt) return res.status(404).send("Gambar struk tidak ditemukan");
      const url = await storageGetSignedUrl(receipt.storageKey);

      res.set("Cache-Control", "private, no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
