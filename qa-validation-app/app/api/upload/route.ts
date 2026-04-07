import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, generateId, now } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const sessionName = formData.get("sessionName") as string;

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".csv"))
      return NextResponse.json({ error: "Only CSV files are supported" }, { status: 400 });

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0)
      return NextResponse.json({ error: "CSV file is empty or has no data rows" }, { status: 400 });

    // Auto-detect Question / Answer columns
    const headerKeys = Object.keys(rows[0]);
    const normalizedHeaders = headerKeys.map((h) => ({ original: h, lower: h.toLowerCase().trim() }));

    const questionCol = normalizedHeaders.find(
      (h) => h.lower === "question" || h.lower === "q" || h.lower.includes("question")
    );
    const answerCol = normalizedHeaders.find(
      (h) =>
        h.lower === "answer" ||
        h.lower === "a" ||
        h.lower.includes("answer") ||
        h.lower.includes("response") ||
        h.lower.includes("generated")
    );

    if (!questionCol || !answerCol) {
      return NextResponse.json(
        {
          error: `Could not detect Question/Answer columns. Found columns: ${headerKeys.join(", ")}. Please ensure your CSV has columns named "Question" and "Answer".`,
        },
        { status: 400 }
      );
    }

    const db = readDb();
    const sessionId = generateId();
    const name = sessionName?.trim() || file.name.replace(/\.csv$/i, "");
    const createdAt = now();

    const session = {
      id: sessionId,
      name,
      filename: file.name,
      total_questions: rows.length,
      created_at: createdAt,
      updated_at: createdAt,
    };

    const qaPairs = rows.map((row, i) => ({
      id: generateId(),
      session_id: sessionId,
      question: row[questionCol.original]?.trim() || "",
      answer: row[answerCol.original]?.trim() || "",
      row_index: i,
      created_at: createdAt,
    }));

    db.sessions.push(session);
    db.qa_pairs.push(...qaPairs);
    writeDb(db);

    return NextResponse.json({ success: true, session });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length < 2) return [];

  const headers = parseCSVLine(nonEmpty[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseCSVLine(nonEmpty[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
