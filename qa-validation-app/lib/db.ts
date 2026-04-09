import fs from "fs";
import path from "path";
import os from "os";

const isVercel = process.env.VERCEL === "1";
const DATA_DIR = isVercel ? path.join(os.tmpdir(), "data") : path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

console.log(`[DB] Using DATA_DIR: ${DATA_DIR}`);
console.log(`[DB] Environment: ${isVercel ? "Vercel" : "Local"}`);

export interface Session {
  id: string;
  name: string;
  filename: string;
  total_questions: number;
  created_at: string;
  updated_at: string;
}

export interface QAPair {
  id: string;
  session_id: string;
  question: string;
  answer: string;
  row_index: number;
  created_at: string;
}

export interface Validation {
  id: string;
  qa_pair_id: string;
  session_id: string;
  validation_score: number;
  comments: string | null;
  validated_at: string;
  updated_at: string;
}

export interface ExportRecord {
  id: string;
  session_id: string;
  session_name: string;
  filename: string;
  filepath: string;
  total_rows: number;
  validated_rows: number;
  exported_at: string;
}

export interface Database {
  sessions: Session[];
  qa_pairs: QAPair[];
  validations: Validation[];
  exports: ExportRecord[];
}

const defaultDb: Database = {
  sessions: [],
  qa_pairs: [],
  validations: [],
  exports: [],
};


function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readDb(): Database {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
    return structuredClone(defaultDb);
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw) as Database;
  } catch {
    return structuredClone(defaultDb);
  }
}

export function writeDb(data: Database): void {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function now(): string {
  return new Date().toISOString();
}
