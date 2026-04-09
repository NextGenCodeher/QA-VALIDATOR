import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb, generateId, now } from "@/lib/db";

// POST - Single validate or bulk validate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qa_pair_id, session_id, validation_score, comments } = body;

    if (qa_pair_id === undefined || session_id === undefined || validation_score === undefined)
      return NextResponse.json({ error: "qa_pair_id, session_id, and validation_score required" }, { status: 400 });

    if (validation_score < 0 || validation_score > 100)
      return NextResponse.json({ error: "validation_score must be 0–100" }, { status: 400 });

    const db = readDb();
    const existingIdx = db.validations.findIndex((v) => v.qa_pair_id === qa_pair_id);
    const timestamp = now();

    if (existingIdx >= 0) {
      db.validations[existingIdx] = {
        ...db.validations[existingIdx],
        validation_score,
        comments: comments || null,
        updated_at: timestamp,
      };
    } else {
      db.validations.push({
        id: generateId(),
        qa_pair_id,
        session_id,
        validation_score,
        comments: comments || null,
        validated_at: timestamp,
        updated_at: timestamp,
      });
    }

    const sessionIdx = db.sessions.findIndex((s) => s.id === session_id);
    if (sessionIdx >= 0) db.sessions[sessionIdx].updated_at = timestamp;

    writeDb(db);

    const validation = db.validations.find((v) => v.qa_pair_id === qa_pair_id);
    return NextResponse.json({ success: true, validation });
  } catch (err: any) {
    console.error("Validation error:", err);
    return NextResponse.json({ 
      error: "Failed to save validation", 
      details: err.message || String(err),
      stack: err.stack
    }, { status: 500 });
  }
}

// PUT - Bulk save validations
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { validations: incoming, session_id } = body;

    if (!Array.isArray(incoming) || !session_id)
      return NextResponse.json({ error: "validations array and session_id required" }, { status: 400 });

    const db = readDb();
    const timestamp = now();

    for (const v of incoming) {
      const existingIdx = db.validations.findIndex((existing) => existing.qa_pair_id === v.qa_pair_id);
      if (existingIdx >= 0) {
        db.validations[existingIdx] = {
          ...db.validations[existingIdx],
          validation_score: v.validation_score,
          comments: v.comments || null,
          updated_at: timestamp,
        };
      } else {
        db.validations.push({
          id: generateId(),
          qa_pair_id: v.qa_pair_id,
          session_id,
          validation_score: v.validation_score,
          comments: v.comments || null,
          validated_at: timestamp,
          updated_at: timestamp,
        });
      }
    }

    const sessionIdx = db.sessions.findIndex((s) => s.id === session_id);
    if (sessionIdx >= 0) db.sessions[sessionIdx].updated_at = timestamp;
    writeDb(db);

    return NextResponse.json({ success: true, count: incoming.length });
  } catch (err: any) {
    console.error("Bulk Validation error:", err);
    return NextResponse.json({ 
      error: "Failed to bulk save", 
      details: err.message || String(err),
      stack: err.stack
    }, { status: 500 });
  }
}
