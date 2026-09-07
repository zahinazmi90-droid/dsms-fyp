// Cross-platform DB reset: pushes the schema then reseeds. For Postgres
// there's no local file to delete; `drizzle-kit push` will create any
// missing tables, and the seed script clears/reinserts rows itself.
// Standalone scripts run via `npx tsx ...` do NOT automatically load .env
// the way `next dev`/`next build`/`next start` do.
import "dotenv/config";
import { execSync } from "child_process";

console.log("Pushing schema...");
execSync("npx drizzle-kit push --force", { stdio: "inherit" });

console.log("Seeding database...");
execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });

console.log("Database reset complete.");
