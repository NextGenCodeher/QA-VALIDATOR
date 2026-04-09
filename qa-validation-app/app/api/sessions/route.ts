import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";

export async function GET() {
  try {
    const db = readDb();
    const sessions = db.sessions
      .map((s) => {
        const pairs = db.qa_pairs.filter((q) => q.session_id === s.id);
        const validated = db.validations.filter((v) => v.session_id === s.id);
        const avgScore =
          validated.length > 0
            ? Math.round(validated.reduce((sum, v) => sum + v.validation_score, 0) / validated.length)
            : null;
        return {
          ...s,
          validated_count: validated.length,
          total_questions: pairs.length,
          avg_score: avgScore,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ sessions });
  } catch (err: any) {
    console.error("Sessions error:", err);
    return NextResponse.json({ 
      error: "Failed to fetch sessions", 
      details: err.message || String(err),
      stack: err.stack
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Session ID required" }, { status: 400 });

    const db = readDb();
    const pairIds = db.qa_pairs.filter((q) => q.session_id === id).map((q) => q.id);
    db.sessions = db.sessions.filter((s) => s.id !== id);
    db.qa_pairs = db.qa_pairs.filter((q) => q.session_id !== id);
    db.validations = db.validations.filter(
      (v) => v.session_id !== id && !pairIds.includes(v.qa_pair_id)
    );
    writeDb(db);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Session delete error:", err);
    return NextResponse.json({ 
      error: "Failed to delete session", 
      details: err.message || String(err),
      stack: err.stack
    }, { status: 500 });
  }
}
