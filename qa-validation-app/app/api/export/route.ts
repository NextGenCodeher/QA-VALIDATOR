import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, generateId, now, ExportRecord } from "@/lib/db";
import fs from "fs";
import path from "path";

const EXPORTS_DIR = path.join(process.cwd(), "exports");

function ensureExportsDir() {
  if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// GET ?session_id=xxx  → generate + save export, return CSV download
// GET ?list=1          → list all saved exports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const list = searchParams.get("list");

    // ── List saved exports ──────────────────────────────────────────────────
    if (list === "1") {
      const db = readDb();
      const exports = (db.exports || []).sort(
        (a: ExportRecord, b: ExportRecord) =>
          new Date(b.exported_at).getTime() - new Date(a.exported_at).getTime()
      );
      return NextResponse.json({ exports });
    }

    // ── Generate export ─────────────────────────────────────────────────────
    const sessionId = searchParams.get("session_id");
    if (!sessionId)
      return NextResponse.json({ error: "session_id required" }, { status: 400 });

    const db = readDb();
    const session = db.sessions.find((s) => s.id === sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const pairs = db.qa_pairs
      .filter((q) => q.session_id === sessionId)
      .sort((a, b) => a.row_index - b.row_index);

    const validationMap = new Map(
      db.validations.filter((v) => v.session_id === sessionId).map((v) => [v.qa_pair_id, v])
    );

    const csvRows = pairs.map((p, i) => {
      const v = validationMap.get(p.id);
      return {
        "#": i + 1,
        Question: p.question,
        Answer: p.answer,
        "Validation Score": v?.validation_score ?? "",
        "Expert Comments": v?.comments ?? "",
        "Validated At": v?.validated_at ?? "",
      };
    });

    const headers = Object.keys(csvRows[0]);
    const lines = [
      headers.map(escapeCSV).join(","),
      ...csvRows.map((row) =>
        headers.map((h) => escapeCSV(String(row[h as keyof typeof row]))).join(",")
      ),
    ];
    const csv = lines.join("\n");

    // Save to disk
    ensureExportsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${session.name.replace(/[^a-z0-9]/gi, "_")}_${timestamp}.csv`;
    const filepath = path.join(EXPORTS_DIR, filename);
    fs.writeFileSync(filepath, csv, "utf-8");

    // Record in DB
    const exportRecord = {
      id: generateId(),
      session_id: sessionId,
      session_name: session.name,
      filename,
      filepath,
      total_rows: pairs.length,
      validated_rows: db.validations.filter((v) => v.session_id === sessionId).length,
      exported_at: now(),
    };
    if (!db.exports) db.exports = [];
    db.exports.push(exportRecord);
    writeDb(db);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

// GET ?download=filename → serve a saved export file
export async function POST(request: NextRequest) {
  try {
    const { filename } = await request.json();
    if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });

    const filepath = path.join(EXPORTS_DIR, path.basename(filename));
    if (!fs.existsSync(filepath))
      return NextResponse.json({ error: "File not found" }, { status: 404 });

    const csv = fs.readFileSync(filepath, "utf-8");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${path.basename(filename)}"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
