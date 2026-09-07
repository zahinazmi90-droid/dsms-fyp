// Safety net: if this module is ever imported by something that hasn't
// already loaded .env (Next.js's own dev/build/start commands do this
// automatically; standalone scripts need to do it explicitly), load it now.
// dotenv never overwrites a variable that's already set, so this is a
// no-op when Next.js has already populated process.env.
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Singleton pattern so Next.js hot-reload in dev doesn't open a new
// connection pool on every file change.
const globalForDb = globalThis as unknown as { __dsmsPool?: Pool };

const connectionString = process.env.DATABASE_URL;

// Deliberately NOT throwing here: this module is imported by every API
// route, and Next.js loads route modules during `next build` to collect
// metadata -- even before any request is served. Throwing at import time
// would make the project fail to build whenever DATABASE_URL isn't set yet
// (e.g. right after cloning, before .env is filled in), which is confusing
// and unnecessary. If the connection string really is missing, the first
// actual database query will fail with a clear connection error at request
// time instead -- see README "Complete A-Z setup guide" for how to set
// DATABASE_URL correctly.
if (!connectionString && process.env.NODE_ENV !== "test") {
  console.warn(
    "[DSMS] DATABASE_URL is not set. Set it in .env to your PostgreSQL connection string (see README) before running the app."
  );
}

const pool =
  globalForDb.__dsmsPool ??
  new Pool({
    connectionString,
    // Hosted Postgres providers (Neon, Supabase, Railway) require SSL.
    ssl: connectionString?.includes("localhost") ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__dsmsPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
