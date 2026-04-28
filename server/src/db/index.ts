import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const DEFAULT_DB_PATH = path.resolve(process.cwd(), "data", "ligma.db");

export type Db = Database.Database;

export function createDb(databaseUrl?: string): Db {
  const dbPath = databaseUrl ? path.resolve(databaseUrl) : DEFAULT_DB_PATH;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

export function migrateDb(db: Db): void {
  const schemaPath = path.resolve(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schemaSql);
}
