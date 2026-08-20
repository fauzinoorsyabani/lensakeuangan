import { createApp } from "../server/_core/app";

/** Vercel Function entrypoint. Vercel invokes the exported Express application per request. */
const app = createApp();

export default app;
