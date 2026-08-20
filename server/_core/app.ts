import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerReceiptUpload } from "../receiptUpload";

/** Builds the HTTP application without starting a listener. */
export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.status(200).json({ status: "ok" }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerReceiptUpload(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[HTTP] Unhandled request error", error);
    if (!res.headersSent) res.status(500).json({ error: "Terjadi kesalahan pada server" });
  });
  return app;
}
