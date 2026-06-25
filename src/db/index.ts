import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

// Reuse the client across hot reloads / serverless invocations.
const globalForDb = globalThis as unknown as { client?: ReturnType<typeof createClient> };

const client =
  globalForDb.client ??
  createClient(authToken ? { url, authToken } : { url });

if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
