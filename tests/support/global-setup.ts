import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/**
 * Skapar en ny, separat testdatabas (prisma/test.db) från schemat innan testerna körs.
 * Utvecklingsdatabasen (prisma/dev.db) rörs aldrig.
 */
export default function setup() {
  const testDb = path.resolve(__dirname, "../../prisma/test.db");
  rmSync(testDb, { force: true });
  rmSync(`${testDb}-journal`, { force: true });
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}
